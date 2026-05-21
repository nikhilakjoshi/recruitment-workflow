import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import {
  applicationApprovedFinalizerWorker,
  type ApplicationApprovedFinalizerOutput,
} from "./application-approved-finalizer";
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
    data: { email: "finalizer@example.com", passwordHash: await hashPassword("x") },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  opportunity = await prisma.opportunity.create({
    data: {
      title: "Senior Backend Engineer",
      company: "Acme Inc",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "JD body.",
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
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function makeArtifact(type: ArtifactType, state: ArtifactState) {
  return prisma.artifact.create({
    data: {
      applicationId: application.id,
      type,
      state,
      contentJson: {},
      contentText: null,
      versionNumber: 1,
      generatedByWorker: "test",
      generationContext: {},
      approvedAt: state === ArtifactState.APPROVED ? new Date() : null,
    },
  });
}

async function makeContext(event: Event): Promise<WorkerContext> {
  return {
    event,
    candidate,
    application,
    scopedMemory: { tokenBudgetUsed: 0, excludedReasons: [] },
    governance: { approvalRequired: false },
    input: event.payloadJson,
  };
}

describe("applicationApprovedFinalizerWorker", () => {
  it("subscribes to COVER_LETTER_APPROVED only and uses cheap model", () => {
    expect(applicationApprovedFinalizerWorker.subscribes).toEqual([
      EventType.COVER_LETTER_APPROVED,
    ]);
    expect(applicationApprovedFinalizerWorker.model).toBe("cheap");
  });

  it("transitions TAILORING -> APPROVED when both artifacts are APPROVED", async () => {
    await makeArtifact(ArtifactType.TAILORED_RESUME, ArtifactState.APPROVED);
    await makeArtifact(ArtifactType.COVER_LETTER, ArtifactState.APPROVED);

    const event = await emitEvent({
      type: EventType.COVER_LETTER_APPROVED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const result = (await applicationApprovedFinalizerWorker.run(
      await makeContext(event),
    )) as { output: ApplicationApprovedFinalizerOutput };
    expect(result.output.transitioned).toBe(true);

    const refreshed = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(refreshed.state).toBe(ApplicationState.APPROVED);
  });

  it("does nothing when only the cover letter is APPROVED (resume still PENDING_REVIEW)", async () => {
    await makeArtifact(ArtifactType.TAILORED_RESUME, ArtifactState.PENDING_REVIEW);
    await makeArtifact(ArtifactType.COVER_LETTER, ArtifactState.APPROVED);

    const event = await emitEvent({
      type: EventType.COVER_LETTER_APPROVED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const result = (await applicationApprovedFinalizerWorker.run(
      await makeContext(event),
    )) as { output: ApplicationApprovedFinalizerOutput };
    expect(result.output.transitioned).toBe(false);
    expect(result.output.reason).toBe("resume_not_approved");

    const refreshed = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(refreshed.state).toBe(ApplicationState.TAILORING);
  });

  it("is idempotent — does not retransition once the Application is already APPROVED", async () => {
    await makeArtifact(ArtifactType.TAILORED_RESUME, ArtifactState.APPROVED);
    await makeArtifact(ArtifactType.COVER_LETTER, ArtifactState.APPROVED);

    const event1 = await emitEvent({
      type: EventType.COVER_LETTER_APPROVED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    await applicationApprovedFinalizerWorker.run(await makeContext(event1));

    const event2 = await emitEvent({
      type: EventType.COVER_LETTER_APPROVED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const r2 = (await applicationApprovedFinalizerWorker.run(
      await makeContext(event2),
    )) as { output: ApplicationApprovedFinalizerOutput };
    expect(r2.output.transitioned).toBe(false);
    expect(r2.output.reason).toBe("already_approved");
  });
});
