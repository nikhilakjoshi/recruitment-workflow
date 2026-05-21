import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ApplicationState,
  EventType,
  OpportunitySource,
  type Event,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { emitEvent } from "@/lib/events";
import { applicationCreatorWorker, type ApplicationCreatorInput } from "./application-creator";
import type { WorkerContext } from "./types";

let candidateId: string;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.rolePreference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: {
      email: "app-creator@example.com",
      passwordHash: await hashPassword("x"),
    },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.rolePreference.deleteMany({});
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function makeOpportunity() {
  return prisma.opportunity.create({
    data: {
      title: "Senior Engineer",
      company: "Acme",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "JD body",
    },
  });
}

async function makeContext(event: Event): Promise<WorkerContext<ApplicationCreatorInput>> {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  return {
    event,
    candidate,
    application: null,
    scopedMemory: { candidate, application: null, event },
    governance: { approvalRequired: false },
    input: event.payloadJson as ApplicationCreatorInput,
  };
}

describe("applicationCreatorWorker", () => {
  it("subscribes to JOB_SHORTLISTED", () => {
    expect(applicationCreatorWorker.subscribes).toContain(EventType.JOB_SHORTLISTED);
    expect(applicationCreatorWorker.name).toBe("application-creator");
  });

  it("creates a SHORTLISTED Application and emits APPLICATION_CREATED", async () => {
    const opportunity = await makeOpportunity();
    const event = await emitEvent({
      type: EventType.JOB_SHORTLISTED,
      candidateId,
      payload: { opportunityId: opportunity.id },
      emittedBy: "user",
    });

    const result = await applicationCreatorWorker.run(await makeContext(event));

    expect(result.output.created).toBe(true);
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: result.output.applicationId },
    });
    expect(app.state).toBe(ApplicationState.SHORTLISTED);
    expect(app.candidateId).toBe(candidateId);
    expect(app.opportunityId).toBe(opportunity.id);
    expect(app.shortlistedAt).not.toBeNull();

    const emitted = await prisma.event.findFirst({
      where: { type: EventType.APPLICATION_CREATED, applicationId: app.id },
    });
    expect(emitted).not.toBeNull();
    expect(emitted?.emittedBy).toBe("application-creator");
  });

  it("snapshots role preferences into targetRoleSnapshot when present", async () => {
    await prisma.rolePreference.create({
      data: {
        candidateId,
        targetRoles: ["Staff Engineer"],
        targetIndustries: ["fintech"],
        geoLocations: ["Remote"],
        remotePolicy: "REMOTE",
      },
    });

    const opportunity = await makeOpportunity();
    const event = await emitEvent({
      type: EventType.JOB_SHORTLISTED,
      candidateId,
      payload: { opportunityId: opportunity.id },
      emittedBy: "user",
    });
    const result = await applicationCreatorWorker.run(await makeContext(event));
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: result.output.applicationId },
    });
    const snapshot = app.targetRoleSnapshot as Record<string, unknown>;
    expect(snapshot.targetRoles).toEqual(["Staff Engineer"]);
    expect(snapshot.remotePolicy).toBe("REMOTE");
  });

  it("is idempotent — a second shortlist for the same opportunity does not create a duplicate", async () => {
    const opportunity = await makeOpportunity();
    const ev1 = await emitEvent({
      type: EventType.JOB_SHORTLISTED,
      candidateId,
      payload: { opportunityId: opportunity.id },
      emittedBy: "user",
    });
    const ev2 = await emitEvent({
      type: EventType.JOB_SHORTLISTED,
      candidateId,
      payload: { opportunityId: opportunity.id },
      emittedBy: "user",
    });

    const r1 = await applicationCreatorWorker.run(await makeContext(ev1));
    const r2 = await applicationCreatorWorker.run(await makeContext(ev2));

    expect(r1.output.created).toBe(true);
    expect(r2.output.created).toBe(false);
    expect(r2.output.applicationId).toBe(r1.output.applicationId);

    const apps = await prisma.application.findMany({
      where: { candidateId, opportunityId: opportunity.id },
    });
    expect(apps).toHaveLength(1);

    const createdEvents = await prisma.event.findMany({
      where: { type: EventType.APPLICATION_CREATED, applicationId: r1.output.applicationId },
    });
    expect(createdEvents).toHaveLength(1);
  });

  it("throws when payload lacks string opportunityId", async () => {
    const event = await emitEvent({
      type: EventType.JOB_SHORTLISTED,
      candidateId,
      payload: { wrong: "shape" },
      emittedBy: "user",
    });
    await expect(applicationCreatorWorker.run(await makeContext(event))).rejects.toThrow(
      /opportunityId/,
    );
  });
});
