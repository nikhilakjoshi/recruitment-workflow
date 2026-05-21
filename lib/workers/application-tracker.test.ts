import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApplicationState, EventType, OpportunitySource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { acknowledgeFollowUp } from "@/lib/follow-ups/acknowledge";
import { applicationTrackerWorker, isStale } from "./application-tracker";
import type { ScheduledWorkerContext } from "./types";

let candidateId: string;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.followUp.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.rolePreference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "tracker@example.com", passwordHash: await hashPassword("x") },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.followUp.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function makeApplication(
  state: ApplicationState,
  updatedDaysAgo: number,
): Promise<string> {
  const opportunity = await prisma.opportunity.create({
    data: {
      title: `Role ${Math.random().toString(36).slice(2, 8)}`,
      company: `Co ${Math.random().toString(36).slice(2, 8)}`,
      jdText: "Build things.",
      sourcePlatform: OpportunitySource.MANUAL,
    },
  });
  const created = await prisma.application.create({
    data: {
      candidateId,
      opportunityId: opportunity.id,
      state,
      targetRoleSnapshot: {},
    },
  });
  // Backdate updatedAt by raw SQL (Prisma blocks direct updatedAt writes).
  const ts = new Date(Date.now() - updatedDaysAgo * 24 * 60 * 60 * 1000);
  await prisma.$executeRawUnsafe(
    `UPDATE "Application" SET "updatedAt" = $1::timestamptz WHERE "id" = $2`,
    ts.toISOString(),
    created.id,
  );
  return created.id;
}

async function ctxAt(now: Date): Promise<ScheduledWorkerContext> {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  return {
    candidate,
    scopedMemory: { tokenBudgetUsed: 0, excludedReasons: [] },
    runAt: now,
  };
}

describe("isStale", () => {
  it("returns null for terminal states", () => {
    const now = new Date();
    const app = {
      id: "x",
      state: ApplicationState.REJECTED,
      updatedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    } as never;
    expect(isStale(app, now)).toBeNull();
  });

  it("returns a detection when above threshold", () => {
    const now = new Date();
    const app = {
      id: "x",
      state: ApplicationState.SHORTLISTED,
      updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    } as never;
    const got = isStale(app, now);
    expect(got).not.toBeNull();
    expect(got?.daysSinceLastActivity).toBeGreaterThanOrEqual(10);
    expect(got?.nextAction).toMatch(/review/i);
  });

  it("returns null when fresher than threshold", () => {
    const now = new Date();
    const app = {
      id: "x",
      state: ApplicationState.SUBMITTED,
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    } as never;
    expect(isStale(app, now)).toBeNull();
  });
});

describe("application-tracker worker", () => {
  it("is registered as a scheduled worker at 9am UTC", () => {
    expect(applicationTrackerWorker.name).toBe("application-tracker");
    expect(applicationTrackerWorker.schedule).toBe("0 9 * * *");
  });

  it("creates FollowUp + FOLLOW_UP_SCHEDULED event only for stale applications", async () => {
    const staleId = await makeApplication(ApplicationState.SHORTLISTED, 10);
    await makeApplication(ApplicationState.SUBMITTED, 2);
    await makeApplication(ApplicationState.REJECTED, 30);
    await makeApplication(ApplicationState.APPROVED, 5);

    const { output } = await applicationTrackerWorker.run(await ctxAt(new Date()));
    expect(output.scanned).toBe(4);
    expect(output.followUpsCreated).toBe(2);

    const followUps = await prisma.followUp.findMany();
    expect(followUps).toHaveLength(2);
    const staleFollowUp = followUps.find((f) => f.applicationId === staleId);
    expect(staleFollowUp).toBeDefined();
    expect(staleFollowUp?.acknowledged).toBe(false);
    expect(staleFollowUp?.suggestedAction).toMatch(/review/i);

    const events = await prisma.event.findMany({
      where: { type: EventType.FOLLOW_UP_SCHEDULED },
    });
    expect(events).toHaveLength(2);
  });

  it("is idempotent — does not create a second FollowUp while one is unacknowledged", async () => {
    await makeApplication(ApplicationState.EVALUATED, 5);

    await applicationTrackerWorker.run(await ctxAt(new Date()));
    await applicationTrackerWorker.run(await ctxAt(new Date()));

    expect(await prisma.followUp.count()).toBe(1);
  });

  it("schedules a new follow-up once the prior one is acknowledged", async () => {
    await makeApplication(ApplicationState.EVALUATED, 5);
    await applicationTrackerWorker.run(await ctxAt(new Date()));

    const fu = await prisma.followUp.findFirstOrThrow();
    await acknowledgeFollowUp(fu.id);

    await applicationTrackerWorker.run(await ctxAt(new Date()));
    expect(await prisma.followUp.count()).toBe(2);

    const refreshed = await prisma.followUp.findUniqueOrThrow({ where: { id: fu.id } });
    expect(refreshed.acknowledged).toBe(true);
    expect(refreshed.acknowledgedAt).not.toBeNull();
  });
});
