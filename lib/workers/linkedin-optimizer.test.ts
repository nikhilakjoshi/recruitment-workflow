import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ArtifactState,
  ArtifactType,
  EventType,
  type Candidate,
  type Event,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { emitEvent } from "@/lib/events";
import { _setGenerateTextForTests } from "@/lib/ai/client";
import { resolveScopedMemory } from "./scoped-memory";
import {
  linkedinOptimizerScope,
  linkedinOptimizerWorker,
  type LinkedinOptimizerOutput,
} from "./linkedin-optimizer";
import type { WorkerContext } from "./types";

let candidate: Candidate;

async function reset() {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.masterCV.deleteMany({});
  await prisma.rolePreference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: {
      email: "linkedin-opt@example.com",
      passwordHash: await hashPassword("x"),
    },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  await prisma.masterCV.create({
    data: {
      candidateId: candidate.id,
      rawText:
        "Jane Doe — Senior Software Engineer. 8 years building distributed systems at FAANG.",
      structuredJson: {},
    },
  });
  await prisma.rolePreference.create({
    data: {
      candidateId: candidate.id,
      targetRoles: ["Staff Engineer"],
      targetIndustries: [],
      targetCompanies: [],
      excludedCompanies: [],
      geoLocations: ["Remote"],
    },
  });
});

beforeEach(async () => {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
});

afterEach(() => {
  _setGenerateTextForTests(null);
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

function fakeGenerate(text: string) {
  return vi.fn().mockResolvedValueOnce({
    text,
    usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 0 } },
  });
}

function fakeGenerateSequence(texts: string[]) {
  const mock = vi.fn();
  for (const t of texts) {
    mock.mockResolvedValueOnce({
      text: t,
      usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 0 } },
    });
  }
  return mock;
}

const VALID_REWRITE = {
  headline: {
    current: "Software Engineer",
    suggested: "Staff Engineer — Distributed systems @ scale",
    rationale: "Pulls the Staff bar forward; signals the JD's seniority anchor.",
  },
  about: {
    current: "I build software.",
    suggested:
      "Eight years building distributed backends for FAANG-scale workloads. Recently led monolith-to-microservices migration serving 50M req/day.",
    rationale: "Anchors specific evidence in the first 200 chars where recruiters skim.",
  },
  experienceImprovements: [],
  keywordsToAdd: ["distributed systems", "kubernetes"],
};

async function makeContext(event: Event): Promise<WorkerContext> {
  const scopedMemory = await resolveScopedMemory(linkedinOptimizerScope, event, {
    maxTokens: 30_000,
  });
  return {
    event,
    candidate,
    application: null,
    scopedMemory,
    governance: { approvalRequired: false },
    input: event.payloadJson,
  };
}

describe("linkedinOptimizerWorker", () => {
  it("subscribes to LINKEDIN_OPTIMIZATION_REQUESTED", () => {
    expect(linkedinOptimizerWorker.name).toBe("linkedin-optimizer");
    expect(linkedinOptimizerWorker.subscribes).toEqual([
      EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
    ]);
    expect(linkedinOptimizerWorker.model).toBe("standard");
    expect(linkedinOptimizerWorker.runtime).toBe("always-on");
  });

  it("writes a LINKEDIN_REWRITE artifact in PENDING_REVIEW state (approval gate before use)", async () => {
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_REWRITE)) as never);
    const event = await emitEvent({
      type: EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
      candidateId: candidate.id,
      payload: {
        linkedinText:
          "Headline: Software Engineer. About: I build software. Experience: did stuff at FAANG.",
      },
      emittedBy: "user",
    });
    const result = (await linkedinOptimizerWorker.run(
      await makeContext(event),
    )) as { output: LinkedinOptimizerOutput };
    expect(result.output.failed).not.toBe(true);
    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(artifact.type).toBe(ArtifactType.LINKEDIN_REWRITE);
    expect(artifact.state).toBe(ArtifactState.PENDING_REVIEW);
    expect(artifact.generatedByWorker).toBe("linkedin-optimizer");
    expect(artifact.contentText).toMatch(/Staff Engineer/);
  });

  it("creates a synthetic LinkedIn application on first run and reuses it on subsequent runs", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence([JSON.stringify(VALID_REWRITE), JSON.stringify(VALID_REWRITE)]) as never,
    );
    const e1 = await emitEvent({
      type: EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
      candidateId: candidate.id,
      payload: { linkedinText: "Something" },
      emittedBy: "user",
    });
    const r1 = (await linkedinOptimizerWorker.run(
      await makeContext(e1),
    )) as { output: LinkedinOptimizerOutput };

    const e2 = await emitEvent({
      type: EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
      candidateId: candidate.id,
      payload: { linkedinText: "Different text" },
      emittedBy: "user",
    });
    const r2 = (await linkedinOptimizerWorker.run(
      await makeContext(e2),
    )) as { output: LinkedinOptimizerOutput };

    expect(r1.output.versionNumber).toBe(1);
    expect(r2.output.versionNumber).toBe(2);
    const a1 = await prisma.artifact.findUniqueOrThrow({ where: { id: r1.output.artifactId } });
    const a2 = await prisma.artifact.findUniqueOrThrow({ where: { id: r2.output.artifactId } });
    expect(a2.applicationId).toBe(a1.applicationId);
    expect(a2.parentVersionId).toBe(a1.id);
    const apps = await prisma.application.findMany();
    expect(apps).toHaveLength(1);
  });

  it("returns failed=true on two parse failures and writes no artifact", async () => {
    _setGenerateTextForTests(fakeGenerateSequence(["nope", "still nope"]) as never);
    const event = await emitEvent({
      type: EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
      candidateId: candidate.id,
      payload: { linkedinText: "anything" },
      emittedBy: "user",
    });
    const result = (await linkedinOptimizerWorker.run(
      await makeContext(event),
    )) as { output: LinkedinOptimizerOutput };
    expect(result.output.failed).toBe(true);
    const artifacts = await prisma.artifact.findMany({
      where: { type: ArtifactType.LINKEDIN_REWRITE },
    });
    expect(artifacts).toHaveLength(0);
  });

  it("throws when payload has no linkedinText", async () => {
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_REWRITE)) as never);
    const event = await emitEvent({
      type: EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
      candidateId: candidate.id,
      payload: {},
      emittedBy: "user",
    });
    await expect(
      linkedinOptimizerWorker.run(await makeContext(event)),
    ).rejects.toThrow(/linkedinText/);
  });
});
