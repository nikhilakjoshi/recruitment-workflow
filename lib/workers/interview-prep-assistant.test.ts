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
  InterviewType,
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
  interviewPrepAssistantWorker,
  interviewPrepScope,
  type InterviewPrepOutput,
} from "./interview-prep-assistant";
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
      email: "interview-prep@example.com",
      passwordHash: await hashPassword("x"),
    },
  });
  candidate = await prisma.candidate.create({ data: { userId: user.id } });
  await prisma.masterCV.create({
    data: {
      candidateId: candidate.id,
      rawText:
        "Jane Doe — Senior Software Engineer. 8 years building distributed systems at FAANG. Led migration of monolith to microservices serving 50M req/day.",
      structuredJson: { skills: ["Go", "Kubernetes", "Postgres"] },
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
      jdText: "We need a senior backend engineer skilled in distributed systems and Go.",
    },
  });
});

beforeEach(async () => {
  await prisma.lLMCall.deleteMany({});
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.interview.deleteMany({});
  await prisma.application.deleteMany({});
  application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      opportunityId: opportunity.id,
      state: ApplicationState.INTERVIEWING,
      targetRoleSnapshot: {},
      shortlistedAt: new Date(),
    },
  });
  await prisma.artifact.create({
    data: {
      applicationId: application.id,
      type: ArtifactType.EVALUATION,
      state: ArtifactState.APPROVED,
      contentJson: { score: 82, fit: "STRONG", strengths: ["s1"], gaps: ["g1"] },
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

const VALID_PREP = {
  interviewType: "TECHNICAL_SCREEN",
  expectedQuestions: [
    {
      category: "TECHNICAL",
      question: "Walk me through how you designed the monolith-to-microservices migration.",
      why: "Direct callback to the headline experience on the resume.",
      starPrompt: "Focus on tradeoffs at decision points.",
    },
    {
      category: "BEHAVIORAL",
      question: "Tell me about a time you led a difficult migration.",
      why: "Behavioral signal on leadership under pressure.",
    },
    {
      category: "TECHNICAL",
      question: "How do you approach reliability for systems at 50M req/day?",
      why: "Maps to JD reliability requirements.",
    },
    {
      category: "LEADERSHIP",
      question: "How do you grow engineers below you?",
      why: "Staff Engineer rubric signal.",
    },
    {
      category: "CULTURE_FIT",
      question: "How do you weigh shipping fast vs. shipping safely?",
      why: "Standard culture-fit probe.",
    },
  ],
  starStories: [
    {
      label: "Monolith-to-microservices migration",
      situation: "Legacy monolith was bottlenecking deploys.",
      task: "Lead the migration without downtime.",
      action: "Designed strangler fig pattern with feature flags.",
      result: "Reduced deploy lead time by 70% with zero outages.",
      relevantTo: ["distributed systems", "leadership"],
    },
    {
      label: "Owning Postgres reliability",
      situation: "Repeated planner regressions during peak hours.",
      task: "Restore stability to query latencies.",
      action: "Introduced query plan baselines and alerting.",
      result: "Cut p99 latency by 40%.",
      relevantTo: ["Postgres"],
    },
    {
      label: "Kubernetes cost cleanup",
      situation: "Cluster spend ballooning.",
      task: "Find and fix waste.",
      action: "Resourced down idle workloads and tuned HPA.",
      result: "$200k/year saved.",
      relevantTo: ["Kubernetes"],
    },
  ],
  questionsToAsk: [
    "What does success look like in the first 90 days for this role?",
    "How is reliability owned between platform and product teams?",
    "What's the most painful operational issue you'd want me to take on first?",
  ],
};

async function makeContext(event: Event): Promise<WorkerContext> {
  const scopedMemory = await resolveScopedMemory(interviewPrepScope, event, {
    maxTokens: 60_000,
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

describe("interviewPrepAssistantWorker", () => {
  it("subscribes to INTERVIEW_SCHEDULED only and uses standard model", () => {
    expect(interviewPrepAssistantWorker.name).toBe("interview-prep-assistant");
    expect(interviewPrepAssistantWorker.subscribes).toEqual([EventType.INTERVIEW_SCHEDULED]);
    expect(interviewPrepAssistantWorker.model).toBe("standard");
  });

  it("writes INTERVIEW_PREP artifact (APPROVED) and emits INTERVIEW_PREP_GENERATED with interviewId echoed", async () => {
    _setGenerateTextForTests(fakeGenerate(JSON.stringify(VALID_PREP)) as never);

    const interview = await prisma.interview.create({
      data: {
        applicationId: application.id,
        scheduledFor: new Date(),
        durationMinutes: 60,
        interviewType: InterviewType.TECHNICAL_SCREEN,
      },
    });
    const event = await emitEvent({
      type: EventType.INTERVIEW_SCHEDULED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: { interviewId: interview.id, interviewType: "TECHNICAL_SCREEN" },
      emittedBy: "user",
    });

    const result = (await interviewPrepAssistantWorker.run(
      await makeContext(event),
    )) as { output: InterviewPrepOutput };

    expect(result.output.failed).not.toBe(true);
    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: result.output.artifactId },
    });
    expect(artifact.type).toBe(ArtifactType.INTERVIEW_PREP);
    expect(artifact.state).toBe(ArtifactState.APPROVED);
    expect(artifact.generatedByWorker).toBe("interview-prep-assistant");
    expect(artifact.contentText).toMatch(/STAR/);
    expect(artifact.contentText).toMatch(/monolith/i);

    const generated = await prisma.event.findFirst({
      where: { type: EventType.INTERVIEW_PREP_GENERATED, applicationId: application.id },
    });
    expect(generated).not.toBeNull();
    expect((generated!.payloadJson as Record<string, unknown>).interviewId).toBe(interview.id);
  });

  it("returns failed=true on two parse failures and writes no artifact", async () => {
    _setGenerateTextForTests(fakeGenerateSequence(["bad", "still bad"]) as never);
    const event = await emitEvent({
      type: EventType.INTERVIEW_SCHEDULED,
      candidateId: candidate.id,
      applicationId: application.id,
      payload: {},
      emittedBy: "user",
    });
    const result = (await interviewPrepAssistantWorker.run(
      await makeContext(event),
    )) as { output: InterviewPrepOutput };
    expect(result.output.failed).toBe(true);
    const artifacts = await prisma.artifact.findMany({
      where: { applicationId: application.id, type: ArtifactType.INTERVIEW_PREP },
    });
    expect(artifacts).toHaveLength(0);
  });
});
