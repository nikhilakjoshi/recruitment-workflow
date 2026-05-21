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
  companyResearchAssistantWorker,
  companyResearchScope,
  _setSearchForTests,
  type CompanyResearchOutput,
} from "./company-research-assistant";
import type { WorkerContext } from "./types";

let candidate: Candidate;
let opportunity: Opportunity;
let application: Application;

async function reset() {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.interview.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.recruiter.deleteMany({});
  await prisma.masterCV.deleteMany({});
  await prisma.rolePreference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: {
      email: "company-research@example.com",
      passwordHash: await hashPassword("x"),
    },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
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
      state: ApplicationState.SUBMITTED,
      targetRoleSnapshot: {},
      shortlistedAt: new Date(),
    },
  });
});

afterEach(() => {
  _setGenerateTextForTests(null);
  _setSearchForTests(null);
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

const VALID_RESEARCH = {
  businessModel:
    "Acme Inc sells SaaS workflow tooling to mid-market engineering teams. Revenue is per-seat subscription. Primary buyer is the VP of Engineering.",
  recentNews: [
    {
      headline: "Acme raises $50M Series B",
      summary: "Acme announced a Series B led by Foo Capital to expand its platform team.",
      url: "https://news.example.com/acme-series-b",
      publishedDate: "2026-04-12",
    },
  ],
  smartQuestions: [
    "How is the engineering org structured between platform and product teams right now?",
    "What does success look like in the first six months for the role I am interviewing for?",
    "How does the team weigh fast iteration against long-term reliability investments?",
  ],
  redFlags: [],
};

async function makeContext(event: Event): Promise<WorkerContext> {
  const scopedMemory = await resolveScopedMemory(companyResearchScope, event, {
    maxTokens: 30_000,
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

describe("companyResearchAssistantWorker", () => {
  it("subscribes to RECRUITER_REPLY_DETECTED and INTERVIEW_SCHEDULED", () => {
    expect(companyResearchAssistantWorker.name).toBe("company-research-assistant");
    expect(companyResearchAssistantWorker.subscribes).toContain(
      EventType.RECRUITER_REPLY_DETECTED,
    );
    expect(companyResearchAssistantWorker.subscribes).toContain(
      EventType.INTERVIEW_SCHEDULED,
    );
    expect(companyResearchAssistantWorker.model).toBe("standard");
    expect(companyResearchAssistantWorker.runtime).toBe("per-interview");
  });

  it("calls Brave with company-name query + freshness=pm, then writes COMPANY_RESEARCH artifact in APPROVED state and emits COMPANY_RESEARCH_GENERATED", async () => {
    const searchMock = vi.fn().mockResolvedValueOnce([
      {
        title: "Acme raises $50M Series B",
        description: "Foo Capital led the round.",
        url: "https://news.example.com/acme-series-b",
        publishedDate: "2026-04-12",
      },
    ]);
    _setSearchForTests(searchMock as never);
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_RESEARCH)) as never);

    const event = await emitEvent({
      type: EventType.INTERVIEW_SCHEDULED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { applicationId: application.id },
      emittedBy: "user",
    });
    const result = (await companyResearchAssistantWorker.run(
      await makeContext(event),
    )) as { output: CompanyResearchOutput };

    expect(searchMock).toHaveBeenCalledWith("Acme Inc news", {
      freshness: "pm",
      count: 5,
    });
    expect(result.output.failed).not.toBe(true);

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(artifact.type).toBe(ArtifactType.COMPANY_RESEARCH);
    expect(artifact.state).toBe(ArtifactState.APPROVED);
    expect(artifact.generatedByWorker).toBe("company-research-assistant");
    expect(artifact.contentText).toMatch(/Acme/);
    expect(artifact.contentText).toMatch(/Series B/);

    const generatedEvent = await prisma.event.findFirst({
      where: {
        type: EventType.COMPANY_RESEARCH_GENERATED,
        applicationId: application.id,
      },
    });
    expect(generatedEvent).not.toBeNull();
  });

  it("retries the LLM once on parse failure and succeeds on retry", async () => {
    _setSearchForTests(vi.fn().mockResolvedValueOnce([]) as never);
    _setGenerateTextForTests(
      fakeGenerateSequence(["not json", JSON.stringify(VALID_RESEARCH)]) as never,
    );
    const event = await emitEvent({
      type: EventType.RECRUITER_REPLY_DETECTED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const result = (await companyResearchAssistantWorker.run(
      await makeContext(event),
    )) as { output: CompanyResearchOutput };
    expect(result.output.failed).not.toBe(true);
  });

  it("returns failed=true after two parse failures and writes no artifact", async () => {
    _setSearchForTests(vi.fn().mockResolvedValueOnce([]) as never);
    _setGenerateTextForTests(
      fakeGenerateSequence(["bad", "still bad"]) as never,
    );
    const event = await emitEvent({
      type: EventType.RECRUITER_REPLY_DETECTED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const result = (await companyResearchAssistantWorker.run(
      await makeContext(event),
    )) as { output: CompanyResearchOutput };
    expect(result.output.failed).toBe(true);
    const artifacts = await prisma.artifact.findMany({
      where: { applicationId: application.id },
    });
    expect(artifacts).toHaveLength(0);
  });

  it("falls back to empty search results if Brave throws, still produces an artifact", async () => {
    _setSearchForTests(
      vi.fn().mockRejectedValueOnce(new Error("rate limited")) as never,
    );
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_RESEARCH)) as never);
    const event = await emitEvent({
      type: EventType.INTERVIEW_SCHEDULED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const result = (await companyResearchAssistantWorker.run(
      await makeContext(event),
    )) as { output: CompanyResearchOutput };
    expect(result.output.failed).not.toBe(true);
    const a = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(a.type).toBe(ArtifactType.COMPANY_RESEARCH);
  });
});
