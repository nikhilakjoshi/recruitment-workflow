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
import {
  tailoredResumeBuilderWorker,
  tailoredResumeScope,
  type TailoredResumeBuilderOutput,
} from "./tailored-resume-builder";
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
    data: { email: "tailored-resume@example.com", passwordHash: await hashPassword("x") },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  await prisma.masterCV.create({
    data: {
      candidateId: candidate.id,
      rawText:
        "Jane Doe — Senior Software Engineer. 8 years building distributed systems at FAANG. Led migration of monolith to microservices serving 50M req/day. Hands-on with Go, Kubernetes, Postgres.",
      structuredJson: { skills: ["Go", "Kubernetes", "Postgres"] },
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
      company: "Acme Inc",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "We need a senior backend engineer skilled in distributed systems and Go.",
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
      state: ApplicationState.EVALUATED,
      targetRoleSnapshot: {},
      shortlistedAt: new Date(),
    },
  });
  await prisma.artifact.create({
    data: {
      applicationId: application.id,
      type: ArtifactType.EVALUATION,
      state: ArtifactState.APPROVED,
      contentJson: {
        score: 82,
        fit: "STRONG",
        confidence: "HIGH",
        strengths: ["8 years distributed systems"],
        gaps: ["JD mentions Kafka; CV does not list it"],
        rationale: "Strong overlap on backend + distributed systems.",
      },
      contentText: "# Match Evaluation\n\n**Score:** 82",
      versionNumber: 1,
      generatedByWorker: "match-scorer",
      generationContext: {},
      approvedAt: new Date(),
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

const VALID_RESUME = {
  candidateName: "Jane Doe",
  contactBlock: {
    email: "jane@example.com",
    phone: "+1-555-1234",
    linkedinUrl: "https://linkedin.com/in/janedoe",
    location: "Remote",
  },
  sections: [
    {
      type: "HEADER",
      title: "Jane Doe",
      bullets: [],
      order: 0,
    },
    {
      type: "SUMMARY",
      title: "Summary",
      bullets: [
        {
          text: "Senior engineer with 8 years building distributed backends serving 50M req/day.",
          rationale: "Anchors seniority signal in the JD opener.",
          evidenceFromMasterCV: "8 years building distributed systems at FAANG",
        },
      ],
      order: 1,
    },
    {
      type: "EXPERIENCE",
      title: "Experience",
      bullets: [
        {
          text: "Led monolith-to-microservices migration, sustaining 50M req/day with negligible regressions.",
          rationale: "Maps to JD's distributed systems requirement.",
          evidenceFromMasterCV: "Led migration of monolith to microservices serving 50M req/day",
        },
        {
          text: "Hands-on with Go, Kubernetes, and Postgres across production deployments.",
          rationale: "Direct stack overlap with the JD's listed tooling.",
          evidenceFromMasterCV: "Hands-on with Go, Kubernetes, Postgres",
        },
      ],
      order: 2,
    },
  ],
  overallRationale:
    "This resume emphasizes the candidate's distributed systems leadership and Go expertise, directly matching the JD's stated needs while honestly omitting Kafka which the candidate has not used.",
};

async function makeContext(event: Event): Promise<WorkerContext> {
  const scopedMemory = await resolveScopedMemory(tailoredResumeScope, event, {
    maxTokens: 80_000,
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

describe("tailoredResumeBuilderWorker", () => {
  it("subscribes to EVALUATION_GENERATED and TAILORED_RESUME_REGENERATION_REQUESTED", () => {
    expect(tailoredResumeBuilderWorker.name).toBe("tailored-resume-builder");
    expect(tailoredResumeBuilderWorker.subscribes).toContain(EventType.EVALUATION_GENERATED);
    expect(tailoredResumeBuilderWorker.subscribes).toContain(
      EventType.TAILORED_RESUME_REGENERATION_REQUESTED,
    );
    expect(tailoredResumeBuilderWorker.model).toBe("heavy");
  });

  it("writes a TAILORED_RESUME artifact (PENDING_REVIEW), transitions to TAILORING, emits RESUME_GENERATED", async () => {
    _setGenerateTextForTests(fakeGenerateOnce(JSON.stringify(VALID_RESUME)) as never);

    const event = await emitEvent({
      type: EventType.EVALUATION_GENERATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { applicationId: application.id },
      emittedBy: "match-scorer",
    });

    const result = (await tailoredResumeBuilderWorker.run(await makeContext(event))) as {
      output: TailoredResumeBuilderOutput;
    };

    expect(result.output.failed).not.toBe(true);
    expect(result.output.versionNumber).toBe(1);

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(artifact.type).toBe(ArtifactType.TAILORED_RESUME);
    expect(artifact.state).toBe(ArtifactState.PENDING_REVIEW);
    expect(artifact.generatedByWorker).toBe("tailored-resume-builder");
    expect(artifact.contentText).toMatch(/Summary/);

    const refreshed = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(refreshed.state).toBe(ApplicationState.TAILORING);

    const generatedEvent = await prisma.event.findFirst({
      where: { type: EventType.RESUME_GENERATED, applicationId: application.id },
    });
    expect(generatedEvent).not.toBeNull();
  });

  it("includes the latest EVALUATION in the prompt", async () => {
    const mock = fakeGenerateOnce(JSON.stringify(VALID_RESUME));
    _setGenerateTextForTests(mock as never);

    const event = await emitEvent({
      type: EventType.EVALUATION_GENERATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "match-scorer",
    });
    await tailoredResumeBuilderWorker.run(await makeContext(event));

    const call = mock.mock.calls[0]?.[0] as { messages: { content: { text: string }[] }[] };
    const flat = call.messages.map((m) => m.content.map((c) => c.text).join("")).join("\n");
    expect(flat).toMatch(/Kafka/);
    expect(flat).toMatch(/STRONG/);
  });

  it("retries once on parse failure with temperature 0, succeeds on retry", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence(["not json at all", JSON.stringify(VALID_RESUME)]) as never,
    );

    const event = await emitEvent({
      type: EventType.EVALUATION_GENERATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "match-scorer",
    });
    const result = (await tailoredResumeBuilderWorker.run(await makeContext(event))) as {
      output: TailoredResumeBuilderOutput;
    };
    expect(result.output.failed).not.toBe(true);
  });

  it("emits RESUME_GENERATION_FAILED after two parse failures", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence(["{bad", "still bad"]) as never,
    );

    const event = await emitEvent({
      type: EventType.EVALUATION_GENERATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "match-scorer",
    });
    const result = (await tailoredResumeBuilderWorker.run(await makeContext(event))) as {
      output: TailoredResumeBuilderOutput;
    };
    expect(result.output.failed).toBe(true);
    expect(result.output.reason).toBe("schema_parse_failure");

    const refreshed = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(refreshed.state).toBe(ApplicationState.EVALUATED);

    const failed = await prisma.event.findFirst({
      where: { type: EventType.RESUME_GENERATION_FAILED, applicationId: application.id },
    });
    expect(failed).not.toBeNull();
  });

  it("regenerate produces a v2 artifact with parentVersionId set", async () => {
    _setGenerateTextForTests(
      fakeGenerateSequence([JSON.stringify(VALID_RESUME), JSON.stringify(VALID_RESUME)]) as never,
    );

    const created = await emitEvent({
      type: EventType.EVALUATION_GENERATED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "match-scorer",
    });
    const r1 = (await tailoredResumeBuilderWorker.run(await makeContext(created))) as {
      output: TailoredResumeBuilderOutput;
    };
    expect(r1.output.versionNumber).toBe(1);

    const regen = await emitEvent({
      type: EventType.TAILORED_RESUME_REGENERATION_REQUESTED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { reason: "manual" },
      emittedBy: "user",
    });
    const r2 = (await tailoredResumeBuilderWorker.run(await makeContext(regen))) as {
      output: TailoredResumeBuilderOutput;
    };
    expect(r2.output.versionNumber).toBe(2);

    const v2 = await prisma.artifact.findUniqueOrThrow({ where: { id: r2.output.artifactId } });
    expect(v2.parentVersionId).toBe(r1.output.artifactId);
  });
});
