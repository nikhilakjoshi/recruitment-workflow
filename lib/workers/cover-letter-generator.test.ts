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
  coverLetterGeneratorWorker,
  coverLetterScope,
  type CoverLetterGeneratorOutput,
} from "./cover-letter-generator";
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
    data: { email: "cover-letter@example.com", passwordHash: await hashPassword("x") },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  await prisma.masterCV.create({
    data: {
      candidateId: candidate.id,
      rawText: "Jane Doe — 8 years of distributed systems at FAANG. Go, Kubernetes, Postgres.",
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
      company: "Acme Inc",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "We need a senior backend engineer skilled in distributed systems.",
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
      state: ApplicationState.TAILORING,
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
        strengths: ["distributed systems"],
        gaps: ["Kafka"],
        rationale: "Strong overlap.",
      },
      contentText: "# Match",
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

async function makeApprovedResume() {
  return prisma.artifact.create({
    data: {
      applicationId: application.id,
      type: ArtifactType.TAILORED_RESUME,
      state: ArtifactState.APPROVED,
      contentJson: {
        candidateName: "Jane Doe",
        contactBlock: { email: "jane@example.com" },
        sections: [
          { type: "HEADER", title: "Jane Doe", bullets: [], order: 0 },
          {
            type: "EXPERIENCE",
            title: "Experience",
            bullets: [
              {
                text: "Led monolith-to-microservices migration.",
                rationale: "x",
                evidenceFromMasterCV: "y",
              },
            ],
            order: 1,
          },
        ],
        overallRationale:
          "Emphasizes distributed systems leadership and Go expertise per the JD's stated needs.",
      },
      contentText: "# Jane Doe",
      versionNumber: 1,
      generatedByWorker: "tailored-resume-builder",
      generationContext: {},
      approvedAt: new Date(),
    },
  });
}

function fakeGenerateOnce(text: string) {
  return vi.fn().mockResolvedValueOnce({
    text,
    usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 0 } },
  });
}

const VALID_LETTER = {
  recipient: { name: "Hiring Team", company: "Acme Inc" },
  paragraphs: [
    {
      kind: "OPENING",
      text:
        "Writing to express interest in the Senior Backend Engineer role at Acme — distributed systems work has been the thread of my eight years at FAANG and is exactly the kind of scale problem the JD describes.",
    },
    {
      kind: "WHY_ME",
      text:
        "Most directly, the monolith-to-microservices migration I led sustained 50M req/day with negligible regression, which mirrors the kind of throughput Acme is dealing with. I shipped Go-based services in production over multiple years and ran them on Kubernetes; Postgres has been the durable backbone behind that stack.",
    },
    {
      kind: "WHY_YOU",
      text:
        "Acme's bet on backend reliability resonates with the way I think about systems: backend work is mostly invisible when it goes right, and the cultural respect for that quiet craft shows up in your engineering blog posts. The team's stated focus on long-term ownership matches how I work best.",
    },
    {
      kind: "CLOSE",
      text:
        "Kafka is one area I have not run at scale; I have used adjacent log-based systems and would be excited to ramp on it inside Acme's environment. Happy to share more about the migration work or any of the systems referenced in the resume in a conversation. Thank you for considering my application.",
    },
  ],
  signoff: "Sincerely,",
  signature: "Jane Doe",
};

async function makeContext(event: Event): Promise<WorkerContext> {
  const scopedMemory = await resolveScopedMemory(coverLetterScope, event, {
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

describe("coverLetterGeneratorWorker", () => {
  it("subscribes to RESUME_APPROVED and COVER_LETTER_REGENERATION_REQUESTED", () => {
    expect(coverLetterGeneratorWorker.name).toBe("cover-letter-generator");
    expect(coverLetterGeneratorWorker.subscribes).toContain(EventType.RESUME_APPROVED);
    expect(coverLetterGeneratorWorker.subscribes).toContain(
      EventType.COVER_LETTER_REGENERATION_REQUESTED,
    );
    expect(coverLetterGeneratorWorker.model).toBe("heavy");
  });

  it("writes a COVER_LETTER artifact (PENDING_REVIEW) when an APPROVED TAILORED_RESUME exists", async () => {
    await makeApprovedResume();
    _setGenerateTextForTests(fakeGenerateOnce(JSON.stringify(VALID_LETTER)) as never);

    const event = await emitEvent({
      type: EventType.RESUME_APPROVED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { applicationId: application.id },
      emittedBy: "user",
    });

    const result = (await coverLetterGeneratorWorker.run(await makeContext(event))) as {
      output: CoverLetterGeneratorOutput;
    };
    expect(result.output.failed).not.toBe(true);

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(artifact.type).toBe(ArtifactType.COVER_LETTER);
    expect(artifact.state).toBe(ArtifactState.PENDING_REVIEW);

    const generatedEvent = await prisma.event.findFirst({
      where: { type: EventType.COVER_LETTER_GENERATED, applicationId: application.id },
    });
    expect(generatedEvent).not.toBeNull();
  });

  it("throws when no APPROVED tailored resume exists for the application", async () => {
    _setGenerateTextForTests(fakeGenerateOnce(JSON.stringify(VALID_LETTER)) as never);

    const event = await emitEvent({
      type: EventType.RESUME_APPROVED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });

    await expect(coverLetterGeneratorWorker.run(await makeContext(event))).rejects.toThrow(
      /APPROVED tailored resume/,
    );
  });
});
