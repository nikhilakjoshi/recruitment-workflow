import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
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
import { resolveScopedMemory } from "./scoped-memory";
import { EMPTY_SCOPE, type WorkerScope } from "./types";

let candidate: Candidate;
let opportunity: Opportunity;
let application: Application;

async function reset() {
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
    data: { email: "scoped-memory@example.com", passwordHash: await hashPassword("x") },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  opportunity = await prisma.opportunity.create({
    data: {
      title: "Staff Engineer",
      company: "Acme",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "JD body",
    },
  });
  application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      opportunityId: opportunity.id,
      targetRoleSnapshot: {},
    },
  });
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.masterCV.deleteMany({});
  await prisma.rolePreference.deleteMany({});
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function makeEvent(applicationId: string | null = application.id): Promise<Event> {
  return emitEvent({
    type: EventType.APPLICATION_CREATED,
    candidateId: candidate.id,
    applicationId,
    payload: {},
    emittedBy: "test",
  });
}

describe("resolveScopedMemory", () => {
  it("returns only what the scope declares (empty scope → no inclusions but counters present)", async () => {
    const event = await makeEvent();
    const scoped = await resolveScopedMemory(EMPTY_SCOPE, event, { maxTokens: 30_000 });

    expect(scoped.candidate).toBeDefined();
    expect(scoped.candidate?.masterCV).toBeUndefined();
    expect(scoped.candidate?.rolePreference).toBeUndefined();
    expect(scoped.application).toBeUndefined();
    expect(scoped.tokenBudgetUsed).toBe(0);
    expect(scoped.excludedReasons).toEqual([]);
  });

  it("includes MasterCV + RolePreference when declared", async () => {
    await prisma.masterCV.create({
      data: { candidateId: candidate.id, rawText: "Engineer with 10 years", structuredJson: {} },
    });
    await prisma.rolePreference.create({
      data: {
        candidateId: candidate.id,
        targetRoles: ["Staff Engineer"],
        targetIndustries: [],
        targetCompanies: [],
        excludedCompanies: [],
        geoLocations: [],
      },
    });

    const event = await makeEvent();
    const scope: WorkerScope = {
      candidate: { masterCV: true, rolePreference: true },
    };
    const scoped = await resolveScopedMemory(scope, event, { maxTokens: 30_000 });

    expect(scoped.candidate?.masterCV?.rawText).toBe("Engineer with 10 years");
    expect(scoped.candidate?.rolePreference?.targetRoles).toEqual(["Staff Engineer"]);
    expect(scoped.tokenBudgetUsed).toBeGreaterThan(0);
    expect(scoped.excludedReasons).toEqual([]);
  });

  it("includes the application + opportunity when scope.application.opportunity = true", async () => {
    const event = await makeEvent();
    const scope: WorkerScope = {
      candidate: { masterCV: false, rolePreference: false },
      application: { opportunity: true },
    };
    const scoped = await resolveScopedMemory(scope, event, { maxTokens: 30_000 });

    expect(scoped.application?.id).toBe(application.id);
    expect(scoped.application?.opportunity?.jdText).toBe("JD body");
  });

  it("includes artifacts when scope requests them, latest-only when flagged", async () => {
    const v1 = await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.EVALUATION,
        state: ArtifactState.APPROVED,
        contentJson: { score: 50 },
        versionNumber: 1,
        generatedByWorker: "match-scorer",
        generationContext: {},
      },
    });
    await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.EVALUATION,
        state: ArtifactState.APPROVED,
        contentJson: { score: 80 },
        versionNumber: 2,
        parentVersionId: v1.id,
        generatedByWorker: "match-scorer",
        generationContext: {},
      },
    });

    const event = await makeEvent();
    const scope: WorkerScope = {
      candidate: { masterCV: false, rolePreference: false },
      application: {
        opportunity: false,
        artifacts: { types: [ArtifactType.EVALUATION], latestVersionsOnly: true },
      },
    };
    const scoped = await resolveScopedMemory(scope, event, { maxTokens: 30_000 });
    expect(scoped.application?.artifacts).toHaveLength(1);
    expect(scoped.application?.artifacts?.[0].versionNumber).toBe(2);
  });

  it("trims MasterCV.rawText first when over budget; logs excludedReasons", async () => {
    const huge = "x".repeat(60_000);
    await prisma.masterCV.create({
      data: { candidateId: candidate.id, rawText: huge, structuredJson: {} },
    });

    const event = await makeEvent();
    const scope: WorkerScope = {
      candidate: { masterCV: true, rolePreference: false },
      application: { opportunity: true },
    };
    const scoped = await resolveScopedMemory(scope, event, { maxTokens: 5_000 });

    expect(scoped.candidate?.masterCV?.rawText.length).toBeLessThan(huge.length);
    expect(scoped.excludedReasons.join(" ")).toMatch(/MasterCV.rawText trimmed/);
  });

  it("trims JD text when MasterCV trim is not enough", async () => {
    const cv = "c".repeat(40_000);
    const jd = "j".repeat(40_000);
    await prisma.masterCV.create({
      data: { candidateId: candidate.id, rawText: cv, structuredJson: {} },
    });
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { jdText: jd },
    });

    const event = await makeEvent();
    const scope: WorkerScope = {
      candidate: { masterCV: true, rolePreference: false },
      application: { opportunity: true },
    };
    const scoped = await resolveScopedMemory(scope, event, { maxTokens: 3_000 });

    expect(scoped.application?.opportunity?.jdText.length).toBeLessThan(jd.length);
    expect(scoped.excludedReasons.some((r) => r.includes("Opportunity.jdText"))).toBe(true);

    // reset JD for other tests
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { jdText: "JD body" },
    });
  });

  it("throws when budget is below 1000 tokens (sanity floor)", async () => {
    const event = await makeEvent();
    await expect(resolveScopedMemory(EMPTY_SCOPE, event, { maxTokens: 100 })).rejects.toThrow(
      /below floor/,
    );
  });
});
