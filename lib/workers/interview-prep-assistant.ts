import {
  ArtifactState,
  ArtifactType,
  EventType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import { parseLLMJson } from "@/lib/ai/parse-json";
import {
  interviewPrepSchema,
  type InterviewPrep,
} from "@/lib/schemas/interview-prep";
import {
  SYSTEM_PROMPT,
  STRICT_REMINDER,
  buildCachedBlock,
  buildUncachedBlock,
} from "./interview-prep-assistant.prompts";
import type { Worker, WorkerScope } from "./types";

export const interviewPrepScope: WorkerScope = {
  candidate: { masterCV: true, rolePreference: true },
  application: {
    opportunity: true,
    artifacts: {
      types: [ArtifactType.EVALUATION, ArtifactType.TAILORED_RESUME],
      latestVersionsOnly: true,
    },
  },
};

export type InterviewPrepOutput = {
  artifactId: string;
  versionNumber: number;
  failed?: boolean;
  reason?: string;
};

type InterviewScheduledPayload = {
  interviewId?: string;
  interviewType?: string;
};

function parsePrep(text: string): InterviewPrep | null {
  const json = parseLLMJson(text);
  if (json === null) return null;
  const parsed = interviewPrepSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function summarizeRolePreference(rp: unknown): string {
  if (!rp || typeof rp !== "object") return "(none provided)";
  return JSON.stringify(rp, null, 2);
}

function summarizeOpportunity(opp: {
  title: string;
  company: string;
  jdText: string;
}): string {
  return [`Title: ${opp.title}`, `Company: ${opp.company}`, "", opp.jdText].join("\n");
}

function summarizeJson(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  return JSON.stringify(json, null, 2);
}

function renderPrepMarkdown(prep: InterviewPrep): string {
  const lines: string[] = [];
  lines.push(`# Interview prep — ${prep.interviewType}`);
  lines.push("");
  lines.push(`## Expected questions`);
  for (const q of prep.expectedQuestions) {
    lines.push(`- **[${q.category}]** ${q.question}`);
    lines.push(`  _Why:_ ${q.why}`);
    if (q.starPrompt) lines.push(`  _STAR prompt:_ ${q.starPrompt}`);
  }
  lines.push("");
  lines.push(`## STAR stories`);
  for (const s of prep.starStories) {
    lines.push(`### ${s.label}`);
    lines.push(`- **Situation:** ${s.situation}`);
    lines.push(`- **Task:** ${s.task}`);
    lines.push(`- **Action:** ${s.action}`);
    lines.push(`- **Result:** ${s.result}`);
    if (s.relevantTo.length > 0) {
      lines.push(`- _Relevant to:_ ${s.relevantTo.join(", ")}`);
    }
  }
  lines.push("");
  lines.push(`## Questions to ask the interviewer`);
  for (const q of prep.questionsToAsk) lines.push(`- ${q}`);
  return lines.join("\n").trimEnd();
}

export const interviewPrepAssistantWorker: Worker<unknown, InterviewPrepOutput> = {
  name: "interview-prep-assistant",
  runtime: "per-interview",
  scope: interviewPrepScope,
  model: "standard",
  subscribes: [EventType.INTERVIEW_SCHEDULED],
  timeoutMs: 90_000,
  async run(ctx) {
    const application = ctx.scopedMemory.application;
    if (!application || !application.opportunity) {
      throw new Error(
        "interview-prep-assistant: missing application or opportunity in scoped memory",
      );
    }
    const candidate = ctx.scopedMemory.candidate;
    const masterCv = candidate?.masterCV?.rawText;
    if (!masterCv) {
      throw new Error(
        "interview-prep-assistant: candidate has no MasterCV — cannot prep",
      );
    }

    const payload = (ctx.event.payloadJson ?? {}) as InterviewScheduledPayload;
    let interviewType = payload.interviewType ?? "OTHER";
    const interviewId = payload.interviewId ?? null;
    if (interviewId) {
      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        select: { interviewType: true },
      });
      if (interview) interviewType = interview.interviewType;
    }

    const evaluation = application.artifacts?.find(
      (a) => a.type === ArtifactType.EVALUATION,
    );
    const resume = application.artifacts?.find(
      (a) => a.type === ArtifactType.TAILORED_RESUME,
    );

    const promptInputs = {
      masterCv,
      rolePreferences: summarizeRolePreference(candidate?.rolePreference),
      opportunity: summarizeOpportunity(application.opportunity),
      evaluation: summarizeJson(evaluation?.contentJson, "(no evaluation)"),
      tailoredResume: summarizeJson(resume?.contentJson, "(no tailored resume)"),
      interviewType,
    };

    const cached = buildCachedBlock(promptInputs);
    const uncached = buildUncachedBlock(promptInputs);

    const baseMessages: LLMMessage[] = [
      { role: "user", content: cached, cache: true },
      { role: "user", content: uncached },
    ];

    const prep = await runWithRetry(ctx.event.id, application.id, baseMessages);

    if (!prep) {
      return {
        output: {
          artifactId: "",
          versionNumber: 0,
          failed: true,
          reason: "schema_parse_failure",
        },
      };
    }

    const prior = await prisma.artifact.findFirst({
      where: {
        applicationId: application.id,
        type: ArtifactType.INTERVIEW_PREP,
      },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (prior?.versionNumber ?? 0) + 1;

    const artifact = await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.INTERVIEW_PREP,
        state: ArtifactState.APPROVED,
        contentJson: prep as unknown as Prisma.InputJsonValue,
        contentText: renderPrepMarkdown(prep),
        versionNumber,
        parentVersionId: prior?.id ?? null,
        generatedByWorker: "interview-prep-assistant",
        generationContext: {
          scopedMemoryTokens: ctx.scopedMemory.tokenBudgetUsed,
          modelUsed: "standard",
          triggeredByEventId: ctx.event.id,
          interviewId,
        },
        approvedAt: new Date(),
      },
    });

    await emitEvent({
      type: EventType.INTERVIEW_PREP_GENERATED,
      candidateId: ctx.candidate.id,
      applicationId: application.id,
      payload: {
        artifactId: artifact.id,
        versionNumber,
        interviewId,
        triggeredByEventId: ctx.event.id,
      },
      emittedBy: "interview-prep-assistant",
    });

    return {
      output: { artifactId: artifact.id, versionNumber },
    };
  },
};

async function runWithRetry(
  eventId: string,
  applicationId: string,
  messages: LLMMessage[],
): Promise<InterviewPrep | null> {
  const first = await callLLM({
    worker: "interview-prep-assistant",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 4_000,
    temperature: 0.4,
    eventId,
    applicationId,
  });
  const firstParsed = parsePrep(first.text);
  if (firstParsed) return firstParsed;

  const retryMessages: LLMMessage[] = [
    ...messages,
    { role: "user", content: STRICT_REMINDER },
  ];
  const second = await callLLM({
    worker: "interview-prep-assistant",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages: retryMessages,
    maxTokens: 4_000,
    temperature: 0,
    eventId,
    applicationId,
  });
  return parsePrep(second.text);
}
