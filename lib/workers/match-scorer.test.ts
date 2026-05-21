import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApplicationState,
  ArtifactState,
  ArtifactType,
  EventType,
  OpportunitySource,
  type Application,
  type Candidate,
  type Event,
  type Opportunity,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { emitEvent } from "@/lib/events";
import { _setGenerateTextForTests } from "@/lib/ai/client";
import { resolveScopedMemory } from "./scoped-memory";
import { matchScorerWorker, matchScorerScope, type MatchScorerOutput } from "./match-scorer";
import type { WorkerContext } from "./types";

let candidate: Candidate;
let opportunity: Opportunity;
let application: Application;

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
    data: { email: "match-scorer@example.com", passwordHash: await hashPassword("x") },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  await prisma.masterCV.create({
    data: {
      candidateId: candidate.id,
      rawText: "Senior software engineer with 8 years building distributed systems at FAANG.",
      structuredJson: { skills: ["Go", "Kubernetes"] },
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
  opportunity = await prisma.opportunity.create({
    data: {
      title: "Senior Backend Engineer",
      company: "Acme",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "We need a senior backend engineer skilled in distributed systems and Go.",
    },
  });
  application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      opportunityId: opportunity.id,
      state: ApplicationState.SHORTLISTED,
      targetRoleSnapshot: {},
      shortlistedAt: new Date(),
    },
  });
});

beforeEach(async () => {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      opportunityId: opportunity.id,
      state: ApplicationState.SHORTLISTED,
      targetRoleSnapshot: {},
      shortlistedAt: new Date(),
    },
  });
});

afterEach(() => {
  _setGenerateTextForTests(null);
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

function fakeGenerateOnce(text: string) {
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

const VALID_PAYLOAD = {
  score: 82,
  fit: "WEAK", // intentionally WRONG — worker must overwrite via fitFromScore
  confidence: "HIGH",
  strengths: ["8 years of distributed systems experience matches the JD's seniority bar"],
  gaps: ["JD mentions Kafka; CV does not list it"],
  rationale:
    "Strong overlap on backend + distributed systems. The candidate's FAANG tenure aligns with the role's scope; minor gaps on specific tooling that are likely closable.",
};

async function makeContext(event: Event): Promise<WorkerContext> {
  const scopedMemory = await resolveScopedMemory(matchScorerScope, event, {
    maxTokens: 30_000,
  });
  return {
    event,
    candidate,
    application,
    scopedMemory,
    governance: { approvalRequired: false },
    input: event.payloadJson,
  };
}

describe("matchScorerWorker", () => {
  it("subscribes to APPLICATION_CREATED and EVALUATION_REGENERATION_REQUESTED", () => {
    expect(matchScorerWorker.name).toBe("match-scorer");
    expect(matchScorerWorker.subscribes).toContain(EventType.APPLICATION_CREATED);
    expect(matchScorerWorker.subscribes).toContain(EventType.EVALUATION_REGENERATION_REQUESTED);
    expect(matchScorerWorker.model).toBe("standard");
  });

  it("writes an EVALUATION artifact, transitions to EVALUATED, and emits EVALUATION_GENERATED", async () => {
    _setGenerateTextForTests(fakeGenerateOnce(JSON.stringify(VALID_PAYLOAD)) as never);

    const event = await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { applicationId: application.id },
      emittedBy: "application-creator",
    });

    const result = (await matchScorerWorker.run(await makeContext(event))) as {
      output: MatchScorerOutput;
    };

    expect(result.output.failed).not.toBe(true);
    expect(result.output.fit).toBe("STRONG"); // overwritten by deterministic threshold (82 >= 75)
    expect(result.output.score).toBe(82);

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(artifact.type).toBe(ArtifactType.EVALUATION);
    expect(artifact.state).toBe(ArtifactState.APPROVED);
    expect(artifact.versionNumber).toBe(1);
    expect((artifact.contentJson as Record<string, unknown>).fit).toBe("STRONG");
    expect(artifact.contentText).toMatch(/Match Evaluation/);
    expect(artifact.contentText).toMatch(/STRONG/);
    expect(artifact.generatedByWorker).toBe("match-scorer");

    const refreshed = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(refreshed.state).toBe(ApplicationState.EVALUATED);

    const generatedEvent = await prisma.event.findFirst({
      where: { type: EventType.EVALUATION_GENERATED, applicationId: application.id },
    });
    expect(generatedEvent).not.toBeNull();
  });

  it("fit label is computed from score, not trusted from the LLM", async () => {
    const payload = { ...VALID_PAYLOAD, score: 35, fit: "STRONG" as const };
    _setGenerateTextForTests(fakeGenerateOnce(JSON.stringify(payload)) as never);

    const event = await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "application-creator",
    });
    const result = (await matchScorerWorker.run(await makeContext(event))) as {
      output: MatchScorerOutput;
    };
    expect(result.output.fit).toBe("WEAK"); // 35 < 50 → WEAK
  });

  it("retries once on parse failure with temperature 0, succeeds on retry", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence(["not json at all", JSON.stringify(VALID_PAYLOAD)]) as never,
    );

    const event = await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "application-creator",
    });
    const result = (await matchScorerWorker.run(await makeContext(event))) as {
      output: MatchScorerOutput;
    };
    expect(result.output.failed).not.toBe(true);
    expect(result.output.fit).toBe("STRONG");
  });

  it("emits EVALUATION_GENERATION_FAILED after two parse failures and leaves state in SHORTLISTED", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence(["{bad", "still bad"]) as never,
    );

    const event = await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "application-creator",
    });
    const result = (await matchScorerWorker.run(await makeContext(event))) as {
      output: MatchScorerOutput;
    };
    expect(result.output.failed).toBe(true);
    expect(result.output.reason).toBe("schema_parse_failure");

    const refreshed = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(refreshed.state).toBe(ApplicationState.SHORTLISTED);

    const failed = await prisma.event.findFirst({
      where: { type: EventType.EVALUATION_GENERATION_FAILED, applicationId: application.id },
    });
    expect(failed).not.toBeNull();

    const artifacts = await prisma.artifact.findMany({ where: { applicationId: application.id } });
    expect(artifacts).toHaveLength(0);
  });

  it("regenerate produces a v2 artifact with parentVersionId set; no second transition attempt", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence([JSON.stringify(VALID_PAYLOAD), JSON.stringify({ ...VALID_PAYLOAD, score: 60 })]) as never,
    );

    // First run on APPLICATION_CREATED
    const created = await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "application-creator",
    });
    const r1 = (await matchScorerWorker.run(await makeContext(created))) as {
      output: MatchScorerOutput;
    };
    expect(r1.output.versionNumber).toBe(1);

    // Second run on EVALUATION_REGENERATION_REQUESTED
    const regen = await emitEvent({
      type: EventType.EVALUATION_REGENERATION_REQUESTED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { reason: "manual" },
      emittedBy: "user",
    });
    const r2 = (await matchScorerWorker.run(await makeContext(regen))) as {
      output: MatchScorerOutput;
    };
    expect(r2.output.versionNumber).toBe(2);
    expect(r2.output.score).toBe(60);

    const v2 = await prisma.artifact.findUniqueOrThrow({ where: { id: r2.output.artifactId } });
    expect(v2.parentVersionId).toBe(r1.output.artifactId);
  });

  it("strips a ```json fenced block from the LLM response before parsing", async () => {
    const fenced = `Here is your evaluation:\n\`\`\`json\n${JSON.stringify(VALID_PAYLOAD)}\n\`\`\``;
    _setGenerateTextForTests(fakeGenerateOnce(fenced) as never);

    const event = await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "application-creator",
    });
    const result = (await matchScorerWorker.run(await makeContext(event))) as {
      output: MatchScorerOutput;
    };
    expect(result.output.failed).not.toBe(true);
    expect(result.output.fit).toBe("STRONG");
  });
});
