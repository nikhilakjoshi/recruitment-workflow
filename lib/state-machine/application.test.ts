import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApplicationState, OpportunitySource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { canTransition, transition, TRANSITIONS } from "./application";
import { InvalidTransitionError } from "./errors";

async function ensureFixture() {
  // Single-tenant constraint blocks a second Candidate; wipe first.
  // Event is append-only at the row level — use TRUNCATE which bypasses row triggers.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
  const user = await prisma.user.create({
    data: {
      email: "sm-fixture@example.com",
      passwordHash: await hashPassword("fixture"),
    },
  });
  await prisma.candidate.create({ data: { userId: user.id } });
}

async function freshApplication(state: ApplicationState = ApplicationState.DISCOVERED) {
  const user = await prisma.user.findFirstOrThrow();
  const candidate = await prisma.candidate.findFirstOrThrow({ where: { userId: user.id } });
  const opportunity = await prisma.opportunity.create({
    data: {
      title: `Role-${Math.random().toString(36).slice(2, 8)}`,
      company: "Acme",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "JD body",
    },
  });
  const app = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      opportunityId: opportunity.id,
      state,
      targetRoleSnapshot: {},
    },
  });
  return app;
}

async function cleanup() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
}

beforeAll(async () => {
  await cleanup();
  await ensureFixture();
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  // Release the single-tenant Candidate slot so subsequent seeds/tests start clean.
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe("canTransition", () => {
  it("accepts every transition in the table", () => {
    for (const [from, allowed] of Object.entries(TRANSITIONS) as [
      ApplicationState,
      ReadonlyArray<ApplicationState>,
    ][]) {
      for (const to of allowed) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("rejects backward and out-of-table transitions", () => {
    const invalidPairs: Array<[ApplicationState, ApplicationState]> = [
      [ApplicationState.DISCOVERED, ApplicationState.SUBMITTED],
      [ApplicationState.SHORTLISTED, ApplicationState.DISCOVERED],
      [ApplicationState.EVALUATED, ApplicationState.APPROVED],
      [ApplicationState.SUBMITTED, ApplicationState.TAILORING],
      [ApplicationState.ACCEPTED, ApplicationState.NEGOTIATING],
    ];
    for (const [from, to] of invalidPairs) {
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it("treats ARCHIVED as terminal", () => {
    for (const to of Object.values(ApplicationState)) {
      expect(canTransition(ApplicationState.ARCHIVED, to)).toBe(false);
    }
  });
});

describe("transition()", () => {
  it("updates state, sets the per-state timestamp, and emits an event", async () => {
    const app = await freshApplication(ApplicationState.DISCOVERED);

    const updated = await transition(app.id, ApplicationState.SHORTLISTED, { actor: "user" });
    expect(updated.state).toBe(ApplicationState.SHORTLISTED);
    expect(updated.shortlistedAt).not.toBeNull();

    const events = await prisma.event.findMany({ where: { applicationId: app.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("APPLICATION_STATE_CHANGED");
    const payload = events[0].payloadJson as { from: string; to: string; actor: string };
    expect(payload.from).toBe(ApplicationState.DISCOVERED);
    expect(payload.to).toBe(ApplicationState.SHORTLISTED);
    expect(payload.actor).toBe("user");
  });

  it("sets submittedAt when moving APPROVED -> SUBMITTED", async () => {
    const app = await freshApplication(ApplicationState.APPROVED);
    const updated = await transition(app.id, ApplicationState.SUBMITTED, { actor: "user" });
    expect(updated.submittedAt).not.toBeNull();
  });

  it("sets rejectedAt / acceptedAt / archivedAt on the right transitions", async () => {
    const app1 = await freshApplication(ApplicationState.SUBMITTED);
    const rejected = await transition(app1.id, ApplicationState.REJECTED, { actor: "user" });
    expect(rejected.rejectedAt).not.toBeNull();

    const app2 = await freshApplication(ApplicationState.NEGOTIATING);
    const accepted = await transition(app2.id, ApplicationState.ACCEPTED, { actor: "user" });
    expect(accepted.acceptedAt).not.toBeNull();

    const app3 = await freshApplication(ApplicationState.ACCEPTED);
    const archived = await transition(app3.id, ApplicationState.ARCHIVED, { actor: "user" });
    expect(archived.archivedAt).not.toBeNull();
  });

  it("throws InvalidTransitionError on invalid transitions", async () => {
    const app = await freshApplication(ApplicationState.DISCOVERED);
    await expect(
      transition(app.id, ApplicationState.SUBMITTED, { actor: "user" }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("ARCHIVED is terminal — any further transition throws", async () => {
    const app = await freshApplication(ApplicationState.ARCHIVED);
    for (const to of [
      ApplicationState.SHORTLISTED,
      ApplicationState.SUBMITTED,
      ApplicationState.ACCEPTED,
    ]) {
      await expect(transition(app.id, to, { actor: "user" })).rejects.toBeInstanceOf(
        InvalidTransitionError,
      );
    }
  });
});
