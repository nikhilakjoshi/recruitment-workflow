import {
  ArtifactState,
  ArtifactType,
  EventType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import { coverLetterSchema, type CoverLetter } from "@/lib/schemas/cover-letter";
import {
  SYSTEM_PROMPT,
  STRICT_REMINDER,
  buildCachedBlock,
  buildUncachedBlock,
} from "./cover-letter-generator.prompts";
import type { Worker, WorkerScope } from "./types";

export const coverLetterScope: WorkerScope = {
  candidate: { masterCV: true, rolePreference: true },
  application: {
    opportunity: true,
    artifacts: {
      types: [ArtifactType.EVALUATION, ArtifactType.TAILORED_RESUME],
      latestVersionsOnly: true,
    },
  },
};

export type CoverLetterGeneratorOutput = {
  artifactId: string;
  versionNumber: number;
  failed?: boolean;
  reason?: string;
};

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function parseLetter(text: string): CoverLetter | null {
  const json = tryParseJson(text);
  if (json === null) return null;
  const parsed = coverLetterSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function renderLetterMarkdown(letter: CoverLetter): string {
  const lines: string[] = [];
  lines.push(`# Cover Letter — ${letter.recipient.company}`);
  if (letter.recipient.name) lines.push(`To: ${letter.recipient.name}`);
  if (letter.recipient.address) lines.push(letter.recipient.address);
  lines.push("");
  for (const p of letter.paragraphs) {
    lines.push(p.text);
    lines.push("");
  }
  lines.push(letter.signoff);
  lines.push(letter.signature);
  return lines.join("\n").trimEnd();
}

function summarizeRolePreference(rp: unknown): string {
  if (!rp || typeof rp !== "object") return "(none provided)";
  return JSON.stringify(rp, null, 2);
}

function summarizeOpportunity(opp: { title: string; company: string; jdText: string }): string {
  return [`Title: ${opp.title}`, `Company: ${opp.company}`, "", opp.jdText].join("\n");
}

function summarizeJson(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  return JSON.stringify(json, null, 2);
}

export const coverLetterGeneratorWorker: Worker<unknown, CoverLetterGeneratorOutput> = {
  name: "cover-letter-generator",
  runtime: "per-application",
  scope: coverLetterScope,
  model: "heavy",
  subscribes: [
    EventType.RESUME_APPROVED,
    EventType.COVER_LETTER_REGENERATION_REQUESTED,
  ],
  timeoutMs: 90_000,
  async run(ctx) {
    const application = ctx.scopedMemory.application;
    if (!application || !application.opportunity) {
      throw new Error(
        "cover-letter-generator: missing application or opportunity in scoped memory",
      );
    }
    const candidate = ctx.scopedMemory.candidate;
    const masterCv = candidate?.masterCV?.rawText;
    if (!masterCv) {
      throw new Error("cover-letter-generator: candidate has no MasterCV");
    }

    const resumeArtifact = await prisma.artifact.findFirst({
      where: {
        applicationId: application.id,
        type: ArtifactType.TAILORED_RESUME,
        state: ArtifactState.APPROVED,
      },
      orderBy: { versionNumber: "desc" },
    });
    if (!resumeArtifact) {
      throw new Error(
        "cover-letter-generator: no APPROVED tailored resume — cannot generate cover letter",
      );
    }

    const evaluationArtifact = application.artifacts?.find(
      (a) => a.type === ArtifactType.EVALUATION,
    );

    const promptInputs = {
      masterCv,
      rolePreferences: summarizeRolePreference(candidate?.rolePreference),
      opportunity: summarizeOpportunity(application.opportunity),
      evaluation: summarizeJson(evaluationArtifact?.contentJson, "(no evaluation)"),
      tailoredResume: summarizeJson(resumeArtifact.contentJson, "(no resume)"),
    };

    const cached = buildCachedBlock(promptInputs);
    const uncached = buildUncachedBlock(promptInputs);

    const baseMessages: LLMMessage[] = [
      { role: "user", content: cached, cache: true },
      { role: "user", content: uncached },
    ];

    const letter = await runWithRetry(ctx.event.id, application.id, baseMessages);

    if (!letter) {
      await emitEvent({
        type: EventType.COVER_LETTER_GENERATION_FAILED,
        candidateId: ctx.candidate.id,
        applicationId: application.id,
        payload: {
          reason: "schema_parse_failure",
          triggeredByEventId: ctx.event.id,
        },
        emittedBy: "cover-letter-generator",
      });
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
      where: { applicationId: application.id, type: ArtifactType.COVER_LETTER },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (prior?.versionNumber ?? 0) + 1;

    const artifact = await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.COVER_LETTER,
        state: ArtifactState.PENDING_REVIEW,
        contentJson: letter as unknown as Prisma.InputJsonValue,
        contentText: renderLetterMarkdown(letter),
        versionNumber,
        parentVersionId: prior?.id ?? null,
        generatedByWorker: "cover-letter-generator",
        generationContext: {
          scopedMemoryTokens: ctx.scopedMemory.tokenBudgetUsed,
          modelUsed: "heavy",
          triggeredByEventId: ctx.event.id,
          resumeArtifactId: resumeArtifact.id,
          evaluationArtifactId: evaluationArtifact?.id ?? null,
        },
      },
    });

    await emitEvent({
      type: EventType.COVER_LETTER_GENERATED,
      candidateId: ctx.candidate.id,
      applicationId: application.id,
      payload: {
        artifactId: artifact.id,
        versionNumber,
        triggeredByEventId: ctx.event.id,
      },
      emittedBy: "cover-letter-generator",
    });

    return {
      output: {
        artifactId: artifact.id,
        versionNumber,
      },
    };
  },
};

async function runWithRetry(
  eventId: string,
  applicationId: string,
  messages: LLMMessage[],
): Promise<CoverLetter | null> {
  const first = await callLLM({
    worker: "cover-letter-generator",
    model: "heavy",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 4_000,
    temperature: 0.5,
    eventId,
    applicationId,
  });
  const firstParsed = parseLetter(first.text);
  if (firstParsed) return firstParsed;

  const retryMessages: LLMMessage[] = [
    ...messages,
    { role: "user", content: STRICT_REMINDER },
  ];
  const second = await callLLM({
    worker: "cover-letter-generator",
    model: "heavy",
    system: SYSTEM_PROMPT,
    messages: retryMessages,
    maxTokens: 4_000,
    temperature: 0,
    eventId,
    applicationId,
  });
  return parseLetter(second.text);
}
