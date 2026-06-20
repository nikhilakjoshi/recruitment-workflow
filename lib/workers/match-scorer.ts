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
import { callLLMObject, type LLMMessage } from "@/lib/ai/client";
import {
  evaluationSchema,
  fitFromScore,
  type Evaluation,
} from "@/lib/schemas/evaluation";
import {
  SYSTEM_PROMPT,
  buildCachedBlock,
  buildUncachedBlock,
} from "./match-scorer.prompts";
import type { Worker, WorkerScope } from "./types";

export const matchScorerScope: WorkerScope = {
  candidate: { masterCV: true, rolePreference: true },
  application: { opportunity: true },
};

export type MatchScorerOutput = {
  artifactId: string;
  versionNumber: number;
  fit: Evaluation["fit"];
  score: number;
  failed?: boolean;
  reason?: string;
};

function renderEvaluationMarkdown(ev: Evaluation): string {
  const lines = [
    `# Match Evaluation`,
    ``,
    `**Score:** ${ev.score}`,
    `**Fit:** ${ev.fit}`,
    `**Confidence:** ${ev.confidence}`,
    ``,
    `## Strengths`,
    ...ev.strengths.map((s) => `- ${s}`),
    ``,
    `## Gaps`,
    ...(ev.gaps.length > 0 ? ev.gaps.map((g) => `- ${g}`) : ["- (none identified)"]),
    ``,
    `## Rationale`,
    ev.rationale,
  ];
  return lines.join("\n");
}

function summarizeRolePreference(rp: unknown): string {
  if (!rp || typeof rp !== "object") return "(none provided)";
  return JSON.stringify(rp, null, 2);
}

export const matchScorerWorker: Worker<unknown, MatchScorerOutput> = {
  name: "match-scorer",
  runtime: "per-application",
  scope: matchScorerScope,
  model: "standard",
  subscribes: [EventType.APPLICATION_CREATED, EventType.EVALUATION_REGENERATION_REQUESTED],
  timeoutMs: 120_000,
  async run(ctx) {
    const application = ctx.scopedMemory.application;
    if (!application || !application.opportunity) {
      throw new Error("match-scorer: missing application or opportunity in scoped memory");
    }
    const candidate = ctx.scopedMemory.candidate;
    const masterCv = candidate?.masterCV?.rawText;
    if (!masterCv) {
      throw new Error("match-scorer: candidate has no MasterCV — cannot score");
    }

    const promptInputs = {
      masterCv,
      rolePreferences: summarizeRolePreference(candidate?.rolePreference),
      jobDescription: application.opportunity.jdText,
    };

    const cached = buildCachedBlock(promptInputs);
    const uncached = buildUncachedBlock(promptInputs);

    const baseMessages: LLMMessage[] = [
      { role: "user", content: cached, cache: true },
      { role: "user", content: uncached },
    ];

    let evaluation: Evaluation | null = null;
    try {
      const result = await callLLMObject({
        worker: "match-scorer",
        model: "standard",
        system: SYSTEM_PROMPT,
        messages: baseMessages,
        schema: evaluationSchema,
        schemaName: "Evaluation",
        schemaDescription: "Match evaluation of a candidate against a job description.",
        maxTokens: 8_000,
        temperature: 0.3,
        eventId: ctx.event.id,
        applicationId: application.id,
      });
      evaluation = result.object;
    } catch (err) {
      console.error(
        "[match-scorer] structured output failed:",
        err instanceof Error ? err.message : err,
      );
    }
    if (!evaluation) {
      await emitEvent({
        type: EventType.EVALUATION_GENERATION_FAILED,
        candidateId: ctx.candidate.id,
        applicationId: application.id,
        payload: {
          reason: "schema_parse_failure",
          triggeredByEventId: ctx.event.id,
        },
        emittedBy: "match-scorer",
      });
      return {
        output: {
          artifactId: "",
          versionNumber: 0,
          fit: "WEAK",
          score: 0,
          failed: true,
          reason: "schema_parse_failure",
        },
      };
    }

    const fit = fitFromScore(evaluation.score);
    const normalized: Evaluation = { ...evaluation, fit };

    const prior = await prisma.artifact.findFirst({
      where: { applicationId: application.id, type: ArtifactType.EVALUATION },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (prior?.versionNumber ?? 0) + 1;

    const artifact = await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.EVALUATION,
        state: ArtifactState.APPROVED,
        contentJson: normalized as unknown as Prisma.InputJsonValue,
        contentText: renderEvaluationMarkdown(normalized),
        versionNumber,
        parentVersionId: prior?.id ?? null,
        generatedByWorker: "match-scorer",
        generationContext: {
          scopedMemoryTokens: ctx.scopedMemory.tokenBudgetUsed,
          modelUsed: "standard",
          triggeredByEventId: ctx.event.id,
        },
        approvedAt: new Date(),
      },
    });

    await emitEvent({
      type: EventType.EVALUATION_GENERATED,
      candidateId: ctx.candidate.id,
      applicationId: application.id,
      payload: {
        artifactId: artifact.id,
        versionNumber,
        score: normalized.score,
        fit: normalized.fit,
        confidence: normalized.confidence,
        triggeredByEventId: ctx.event.id,
      },
      emittedBy: "match-scorer",
    });

    if (application.state === ApplicationState.SHORTLISTED) {
      await transition(application.id, ApplicationState.EVALUATED, {
        actor: "match-scorer",
        reason: "Evaluation generated",
      });
    }

    return {
      output: {
        artifactId: artifact.id,
        versionNumber,
        fit: normalized.fit,
        score: normalized.score,
      },
    };
  },
};
