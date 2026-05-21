import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { emitEvent } from "./events";

let candidateId: string;

async function reset() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "events-fixture@example.com", passwordHash: await hashPassword("x") },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("emitEvent", () => {
  it("writes a row with the provided fields and returns the inserted Event", async () => {
    const ev = await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: { source: "manual", title: "Test" },
      emittedBy: "system",
    });

    expect(ev.id).toBeTruthy();
    expect(ev.type).toBe(EventType.JOB_DISCOVERED);
    expect(ev.candidateId).toBe(candidateId);
    expect(ev.emittedBy).toBe("system");

    const fetched = await prisma.event.findUnique({ where: { id: ev.id } });
    expect(fetched).not.toBeNull();
    expect(fetched?.payloadJson).toMatchObject({ source: "manual", title: "Test" });
  });

  it("accepts a null applicationId", async () => {
    const ev = await emitEvent({
      type: EventType.CANDIDATE_PROFILE_UPDATED,
      candidateId,
      payload: {},
      emittedBy: "user",
    });
    expect(ev.applicationId).toBeNull();
  });
});

describe("Event append-only invariant", () => {
  it("UPDATE on an Event row throws 'events table is append-only'", async () => {
    const ev = await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: { source: "manual" },
      emittedBy: "system",
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "Event" SET "emittedBy" = 'mutated' WHERE id = $1`, ev.id),
    ).rejects.toThrow(/events table is append-only/);
  });

  it("DELETE on an Event row throws 'events table is append-only'", async () => {
    const ev = await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: { source: "manual" },
      emittedBy: "system",
    });

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "Event" WHERE id = $1`, ev.id),
    ).rejects.toThrow(/events table is append-only/);
  });
});
