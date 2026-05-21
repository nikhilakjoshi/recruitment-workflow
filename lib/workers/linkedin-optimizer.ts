import {
  ArtifactState,
  ArtifactType,
  EventType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import { parseLLMJson } from "@/lib/ai/parse-json";
import {
  linkedinRewriteSchema,
  type LinkedInRewrite,
} from "@/lib/schemas/linkedin-rewrite";
import {
  SYSTEM_PROMPT,
  STRICT_REMINDER,
  buildCachedBlock,
  buildUncachedBlock,
} from "./linkedin-optimizer.prompts";
import type { Worker, WorkerScope } from "./types";

export const linkedinOptimizerScope: WorkerScope = {
  candidate: { masterCV: true, rolePreference: true },
};

export type LinkedinOptimizerOutput = {
  artifactId: string;
  versionNumber: number;
  failed?: boolean;
  reason?: string;
};

type OptimizationPayload = {
  linkedinText?: string;
  applicationId?: string;
};

function parseRewrite(text: string): LinkedInRewrite | null {
  const json = parseLLMJson(text);
  if (json === null) return null;
  const parsed = linkedinRewriteSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function summarizeRolePreference(rp: unknown): string {
  if (!rp || typeof rp !== "object") return "(none provided)";
  return JSON.stringify(rp, null, 2);
}

function renderRewriteMarkdown(r: LinkedInRewrite): string {
  const lines: string[] = [];
  lines.push(`# LinkedIn rewrite suggestions`);
  lines.push("");
  lines.push(`## Headline`);
  lines.push(`**Current:** ${r.headline.current || "(empty)"}`);
  lines.push(`**Suggested:** ${r.headline.suggested}`);
  lines.push(`_Why:_ ${r.headline.rationale}`);
  lines.push("");
  lines.push(`## About`);
  lines.push(`**Current:** ${r.about.current || "(empty)"}`);
  lines.push(`**Suggested:** ${r.about.suggested}`);
  lines.push(`_Why:_ ${r.about.rationale}`);
  lines.push("");
  if (r.experienceImprovements.length > 0) {
    lines.push(`## Experience improvements`);
    for (const e of r.experienceImprovements) {
      lines.push(`### ${e.section}`);
      lines.push(`**Current:** ${e.current || "(empty)"}`);
      lines.push(`**Suggested:** ${e.suggested}`);
      lines.push(`_Why:_ ${e.rationale}`);
      lines.push("");
    }
  }
  if (r.keywordsToAdd.length > 0) {
    lines.push(`## Keywords to add`);
    lines.push(r.keywordsToAdd.map((k) => `\`${k}\``).join(" · "));
  }
  return lines.join("\n").trimEnd();
}

async function findOrCreateLinkedinApplication(
  candidateId: string,
): Promise<string> {
  // LINKEDIN_REWRITE artifacts are candidate-scope, but our Artifact table
  // requires an applicationId. We adopt a synthetic "LinkedIn profile"
  // opportunity + application per candidate, idempotently created the first
  // time the optimizer fires. Same pattern future candidate-scope artifacts
  // can follow.
  const slug = "__linkedin_profile__";
  let opportunity = await prisma.opportunity.findFirst({
    where: { company: slug, sourcePlatform: "MANUAL" },
  });
  if (!opportunity) {
    opportunity = await prisma.opportunity.create({
      data: {
        title: "LinkedIn profile",
        company: slug,
        sourcePlatform: "MANUAL",
        jdText: "Synthetic record for candidate-scope LinkedIn rewrite artifacts.",
      },
    });
  }
  const existing = await prisma.application.findUnique({
    where: {
      candidateId_opportunityId: {
        candidateId,
        opportunityId: opportunity.id,
      },
    },
  });
  if (existing) return existing.id;
  const created = await prisma.application.create({
    data: {
      candidateId,
      opportunityId: opportunity.id,
      state: "DISCOVERED",
      targetRoleSnapshot: {},
    },
  });
  return created.id;
}

export const linkedinOptimizerWorker: Worker<unknown, LinkedinOptimizerOutput> = {
  name: "linkedin-optimizer",
  runtime: "always-on",
  scope: linkedinOptimizerScope,
  model: "standard",
  subscribes: [EventType.LINKEDIN_OPTIMIZATION_REQUESTED],
  timeoutMs: 90_000,
  async run(ctx) {
    const candidate = ctx.scopedMemory.candidate;
    const masterCv = candidate?.masterCV?.rawText;
    if (!masterCv) {
      throw new Error("linkedin-optimizer: candidate has no MasterCV — cannot suggest rewrites");
    }
    const payload = (ctx.event.payloadJson ?? {}) as OptimizationPayload;
    const linkedinText = (payload.linkedinText ?? "").trim();
    if (!linkedinText) {
      throw new Error("linkedin-optimizer: event has no linkedinText payload");
    }

    const promptInputs = {
      masterCv,
      rolePreferences: summarizeRolePreference(candidate?.rolePreference),
      linkedinText,
    };
    const cached = buildCachedBlock(promptInputs);
    const uncached = buildUncachedBlock(promptInputs);
    const baseMessages: LLMMessage[] = [
      { role: "user", content: cached, cache: true },
      { role: "user", content: uncached },
    ];

    const applicationId =
      payload.applicationId ??
      (await findOrCreateLinkedinApplication(ctx.candidate.id));

    const rewrite = await runWithRetry(ctx.event.id, applicationId, baseMessages);
    if (!rewrite) {
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
      where: { applicationId, type: ArtifactType.LINKEDIN_REWRITE },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (prior?.versionNumber ?? 0) + 1;

    const artifact = await prisma.artifact.create({
      data: {
        applicationId,
        type: ArtifactType.LINKEDIN_REWRITE,
        state: ArtifactState.PENDING_REVIEW,
        contentJson: rewrite as unknown as Prisma.InputJsonValue,
        contentText: renderRewriteMarkdown(rewrite),
        versionNumber,
        parentVersionId: prior?.id ?? null,
        generatedByWorker: "linkedin-optimizer",
        generationContext: {
          scopedMemoryTokens: ctx.scopedMemory.tokenBudgetUsed,
          modelUsed: "standard",
          triggeredByEventId: ctx.event.id,
        },
      },
    });

    return { output: { artifactId: artifact.id, versionNumber } };
  },
};

async function runWithRetry(
  eventId: string,
  applicationId: string,
  messages: LLMMessage[],
): Promise<LinkedInRewrite | null> {
  const first = await callLLM({
    worker: "linkedin-optimizer",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 4_000,
    temperature: 0.4,
    eventId,
    applicationId,
  });
  const firstParsed = parseRewrite(first.text);
  if (firstParsed) return firstParsed;

  const retryMessages: LLMMessage[] = [
    ...messages,
    { role: "user", content: STRICT_REMINDER },
  ];
  const second = await callLLM({
    worker: "linkedin-optimizer",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages: retryMessages,
    maxTokens: 4_000,
    temperature: 0,
    eventId,
    applicationId,
  });
  return parseRewrite(second.text);
}
