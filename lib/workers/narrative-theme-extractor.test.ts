import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ApplicationState,
  ArtifactState,
  ArtifactType,
  InsightType,
  OpportunitySource,
  type Candidate,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { _setGenerateTextForTests } from "@/lib/ai/client";
import {
  NARRATIVE_THEME_SCHEDULE,
  runNarrativeThemeExtractor,
  runNarrativeThemeExtractorForCandidate,
} from "./narrative-theme-extractor";

let candidate: Candidate;

async function reset() {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.insight.deleteMany({});
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.masterCV.deleteMany({});
  await prisma.rolePreference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedApprovedResumes(count: number) {
  for (let i = 0; i < count; i++) {
    const opportunity = await prisma.opportunity.create({
      data: {
        title: `Role ${i}`,
        company: `Co ${i}`,
        sourcePlatform: OpportunitySource.MANUAL,
        jdText: `JD ${i}`,
      },
    });
    const application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        opportunityId: opportunity.id,
        state: ApplicationState.SUBMITTED,
        targetRoleSnapshot: {},
      },
    });
    await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.TAILORED_RESUME,
        state: ArtifactState.APPROVED,
        contentJson: { dummy: true },
        contentText: `Resume ${i} content — distributed systems leadership @ scale.`,
        versionNumber: 1,
        generatedByWorker: "tailored-resume-builder",
        generationContext: {},
        approvedAt: new Date(),
      },
    });
  }
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "ntx@example.com", passwordHash: await hashPassword("x") },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
});

beforeEach(async () => {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.insight.deleteMany({});
  await prisma.artifact.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
});

afterEach(() => {
  _setGenerateTextForTests(null);
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

function fakeGenerate(text: string) {
  return vi.fn().mockResolvedValueOnce({
    text,
    usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 0 } },
  });
}

const VALID_THEMES = {
  themes: [
    {
      label: "Distributed systems leadership",
      description: "Repeated emphasis on owning distributed-system migrations end to end.",
      frequency: 4,
      representativeBullets: ["Led monolith-to-microservices migration."],
    },
  ],
  emergent: ["AI-product latency"],
  fading: ["Java enterprise"],
};

describe("narrativeThemeExtractor", () => {
  it("declares the Sundays 10am UTC cron schedule", () => {
    expect(NARRATIVE_THEME_SCHEDULE).toBe("0 10 * * 0");
  });

  it("skips when fewer than 2 approved resumes exist", async () => {
    await seedApprovedResumes(1);
    const result = await runNarrativeThemeExtractorForCandidate(candidate.id);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("insufficient_data");
    expect(result.insightId).toBeUndefined();
    const insights = await prisma.insight.findMany({
      where: { candidateId: candidate.id },
    });
    expect(insights).toHaveLength(0);
  });

  it("writes a NARRATIVE_THEME Insight when at least 2 approved resumes exist", async () => {
    await seedApprovedResumes(3);
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_THEMES)) as never);
    const result = await runNarrativeThemeExtractorForCandidate(candidate.id);
    expect(result.skipped).not.toBe(true);
    expect(result.insightId).toBeTruthy();
    expect(result.resumesConsidered).toBe(3);

    const insight = await prisma.insight.findUniqueOrThrow({
      where: { id: result.insightId! },
    });
    expect(insight.type).toBe(InsightType.NARRATIVE_THEME);
    const json = insight.contentJson as Record<string, unknown>;
    expect((json.themes as unknown[]).length).toBe(1);
  });

  it("respects the limit option (only loads most recent N resumes)", async () => {
    await seedApprovedResumes(5);
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_THEMES)) as never);
    const result = await runNarrativeThemeExtractorForCandidate(candidate.id, { limit: 2 });
    expect(result.resumesConsidered).toBe(2);
  });

  it("runNarrativeThemeExtractor iterates every candidate", async () => {
    await seedApprovedResumes(2);
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_THEMES)) as never);
    const results = await runNarrativeThemeExtractor();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.find((r) => r.candidateId === candidate.id)?.insightId).toBeTruthy();
  });
});
