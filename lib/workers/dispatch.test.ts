import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EventConsumptionStatus, EventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { emitEvent } from "@/lib/events";
import { _resetRegistryForTests, registerWorker } from "./registry";
import { echoWorker } from "./echo-worker";
import { dispatchOnce } from "./dispatch";
import { EMPTY_SCOPE, type Worker } from "./types";

let candidateId: string;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "dispatch-fixture@example.com", passwordHash: await hashPassword("x") },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  _resetRegistryForTests();
});

afterEach(() => {
  _resetRegistryForTests();
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("dispatchOnce", () => {
  it("invokes subscribed workers for pending events and writes SUCCEEDED rows", async () => {
    registerWorker(echoWorker);

    const ev1 = await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: { source: "manual", title: "Role A" },
      emittedBy: "system",
    });
    const ev2 = await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: { source: "manual", title: "Role B" },
      emittedBy: "system",
    });

    const result = await dispatchOnce();
    expect(result).toEqual({ processed: 2, errors: 0 });

    const consumptions = await prisma.eventConsumption.findMany({
      where: { workerName: "echo" },
      orderBy: { consumedAt: "asc" },
    });
    expect(consumptions).toHaveLength(2);
    for (const c of consumptions) {
      expect(c.status).toBe(EventConsumptionStatus.SUCCEEDED);
      expect(c.errorMessage).toBeNull();
    }
    expect(consumptions.map((c) => c.eventId).sort()).toEqual([ev1.id, ev2.id].sort());
  });

  it("is idempotent on replay — already-consumed events are skipped", async () => {
    registerWorker(echoWorker);
    await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: {},
      emittedBy: "system",
    });

    const first = await dispatchOnce();
    expect(first.processed).toBe(1);

    const second = await dispatchOnce();
    expect(second).toEqual({ processed: 0, errors: 0 });

    expect(await prisma.eventConsumption.count({ where: { workerName: "echo" } })).toBe(1);
  });

  it("records FAILED EventConsumption rows when a worker throws and continues to next event", async () => {
    const flaky: Worker<unknown, null> = {
      name: "flaky",
      runtime: "always-on",
      scope: EMPTY_SCOPE,
      model: "cheap",
      subscribes: [EventType.JOB_DISCOVERED],
      async run() {
        throw new Error("boom");
      },
    };
    registerWorker(flaky);

    const ev = await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: {},
      emittedBy: "system",
    });

    const result = await dispatchOnce();
    expect(result).toEqual({ processed: 0, errors: 1 });

    const consumption = await prisma.eventConsumption.findFirst({
      where: { workerName: "flaky", eventId: ev.id },
    });
    expect(consumption?.status).toBe(EventConsumptionStatus.FAILED);
    expect(consumption?.errorMessage).toContain("boom");

    const replay = await dispatchOnce();
    expect(replay).toEqual({ processed: 0, errors: 0 });
  });

  it("only invokes workers subscribed to the event type", async () => {
    registerWorker(echoWorker);
    await emitEvent({
      type: EventType.APPLICATION_STATE_CHANGED,
      candidateId,
      payload: {},
      emittedBy: "system",
    });

    const result = await dispatchOnce();
    expect(result).toEqual({ processed: 0, errors: 0 });
    expect(await prisma.eventConsumption.count()).toBe(0);
  });
});
