import {
  ApplicationState,
  ArtifactState,
  ArtifactType,
  EventType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { transition } from "@/lib/state-machine/application";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import {
  tailoredResumeSchema,
  type TailoredResume,
} from "@/lib/schemas/tailored-resume";
import {
  SYSTEM_PROMPT,
  STRICT_REMINDER,
  buildCachedBlock,
  buildUncachedBlock,
} from "./tailored-resume-builder.prompts";
import type { Worker, WorkerScope } from "./types";

export const tailoredResumeScope: WorkerScope = {
  candidate: { masterCV: true, rolePreference: true },
  application: {
    opportunity: true,
    artifacts: { types: [ArtifactType.EVALUATION], latestVersionsOnly: true },
  },
};

export type TailoredResumeBuilderOutput = {
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

function parseResume(text: string): TailoredResume | null {
  const json = tryParseJson(text);
  if (json === null) return null;
  const parsed = tailoredResumeSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function renderResumeMarkdown(resume: TailoredResume): string {
  const lines: string[] = [];
  lines.push(`# ${resume.candidateName}`);
  const contactParts = [
    resume.contactBlock.email,
    resume.contactBlock.phone,
    resume.contactBlock.linkedinUrl,
    resume.contactBlock.location,
  ].filter(Boolean);
  if (contactParts.length > 0) lines.push(contactParts.join(" · "));
  lines.push("");
  const ordered = [...resume.sections].sort((a, b) => a.order - b.order);
  for (const section of ordered) {
    if (section.type === "HEADER") continue;
    lines.push(`## ${section.title}`);
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function summarizeRolePreference(rp: unknown): string {
  if (!rp || typeof rp !== "object") return "(none provided)";
  return JSON.stringify(rp, null, 2);
}

function summarizeOpportunity(opp: { title: string; company: string; jdText: string }): string {
  return [`Title: ${opp.title}`, `Company: ${opp.company}`, "", opp.jdText].join("\n");
}

function summarizeEvaluation(json: unknown): string {
  if (!json || typeof json !== "object") return "(no evaluation available)";
  return JSON.stringify(json, null, 2);
}

export const tailoredResumeBuilderWorker: Worker<unknown, TailoredResumeBuilderOutput> = {
  name: "tailored-resume-builder",
  runtime: "per-application",
  scope: tailoredResumeScope,
  model: "heavy",
  subscribes: [
    EventType.EVALUATION_GENERATED,
    EventType.TAILORED_RESUME_REGENERATION_REQUESTED,
  ],
  timeoutMs: 120_000,
  async run(ctx) {
    const application = ctx.scopedMemory.application;
    if (!application || !application.opportunity) {
      throw new Error(
        "tailored-resume-builder: missing application or opportunity in scoped memory",
      );
    }
    const candidate = ctx.scopedMemory.candidate;
    const masterCv = candidate?.masterCV?.rawText;
    if (!masterCv) {
      throw new Error(
        "tailored-resume-builder: candidate has no MasterCV — cannot tailor",
      );
    }

    const evaluationArtifact = application.artifacts?.find(
      (a) => a.type === ArtifactType.EVALUATION,
    );

    const promptInputs = {
      masterCv,
      rolePreferences: summarizeRolePreference(candidate?.rolePreference),
      opportunity: summarizeOpportunity(application.opportunity),
      evaluation: summarizeEvaluation(evaluationArtifact?.contentJson),
    };

    const cached = buildCachedBlock(promptInputs);
    const uncached = buildUncachedBlock(promptInputs);

    const baseMessages: LLMMessage[] = [
      { role: "user", content: cached, cache: true },
      { role: "user", content: uncached },
    ];

    const resume = await runWithRetry(ctx.event.id, application.id, baseMessages);

    if (!resume) {
      await emitEvent({
        type: EventType.RESUME_GENERATION_FAILED,
        candidateId: ctx.candidate.id,
        applicationId: application.id,
        payload: {
          reason: "schema_parse_failure",
          triggeredByEventId: ctx.event.id,
        },
        emittedBy: "tailored-resume-builder",
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
      where: { applicationId: application.id, type: ArtifactType.TAILORED_RESUME },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (prior?.versionNumber ?? 0) + 1;

    const artifact = await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.TAILORED_RESUME,
        state: ArtifactState.PENDING_REVIEW,
        contentJson: resume as unknown as Prisma.InputJsonValue,
        contentText: renderResumeMarkdown(resume),
        versionNumber,
        parentVersionId: prior?.id ?? null,
        generatedByWorker: "tailored-resume-builder",
        generationContext: {
          scopedMemoryTokens: ctx.scopedMemory.tokenBudgetUsed,
          modelUsed: "heavy",
          triggeredByEventId: ctx.event.id,
          evaluationArtifactId: evaluationArtifact?.id ?? null,
        },
      },
    });

    await emitEvent({
      type: EventType.RESUME_GENERATED,
      candidateId: ctx.candidate.id,
      applicationId: application.id,
      payload: {
        artifactId: artifact.id,
        versionNumber,
        triggeredByEventId: ctx.event.id,
      },
      emittedBy: "tailored-resume-builder",
    });

    if (application.state === ApplicationState.EVALUATED) {
      await transition(application.id, ApplicationState.TAILORING, {
        actor: "tailored-resume-builder",
        reason: "Tailored resume generated",
      });
    }

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
): Promise<TailoredResume | null> {
  const first = await callLLM({
    worker: "tailored-resume-builder",
    model: "heavy",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 6_000,
    temperature: 0.4,
    eventId,
    applicationId,
  });
  const firstParsed = parseResume(first.text);
  if (firstParsed) return firstParsed;

  const retryMessages: LLMMessage[] = [
    ...messages,
    { role: "user", content: STRICT_REMINDER },
  ];
  const second = await callLLM({
    worker: "tailored-resume-builder",
    model: "heavy",
    system: SYSTEM_PROMPT,
    messages: retryMessages,
    maxTokens: 6_000,
    temperature: 0,
    eventId,
    applicationId,
  });
  return parseResume(second.text);
}
