import type { ArtifactType, Event } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ScopedApplication,
  ScopedCandidate,
  ScopedMemory,
  WorkerScope,
} from "./types";

export type ResolveBudget = { maxTokens: number };

const MIN_BUDGET = 1_000;
const CHARS_PER_TOKEN = 3.5;

function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function clampLastFraction(text: string, fraction: number): string {
  const targetChars = Math.floor(text.length * fraction);
  return text.slice(text.length - targetChars);
}

function clampFirstFraction(text: string, fraction: number): string {
  const targetChars = Math.floor(text.length * fraction);
  return text.slice(0, targetChars);
}

export async function resolveScopedMemory(
  scope: WorkerScope,
  event: Event,
  budget: ResolveBudget,
): Promise<ScopedMemory> {
  if (budget.maxTokens < MIN_BUDGET) {
    throw new Error(`resolveScopedMemory: budget ${budget.maxTokens} below floor ${MIN_BUDGET}`);
  }

  const excludedReasons: string[] = [];

  const candidateRow = await prisma.candidate.findUnique({
    where: { id: event.candidateId },
    include: {
      masterCV: scope.candidate.masterCV,
      rolePreference: scope.candidate.rolePreference,
    },
  });

  let candidate: ScopedCandidate | undefined;
  if (candidateRow) {
    candidate = candidateRow;
  }

  let application: ScopedApplication | undefined;
  if (scope.application && event.applicationId) {
    const appRow = await prisma.application.findUnique({
      where: { id: event.applicationId },
      include: {
        opportunity: scope.application.opportunity,
      },
    });
    if (appRow) {
      application = appRow;

      if (scope.application.artifacts) {
        const { types, latestVersionsOnly } = scope.application.artifacts;
        const artifacts = await prisma.artifact.findMany({
          where: {
            applicationId: appRow.id,
            type: { in: types as ArtifactType[] },
          },
          orderBy: [{ type: "asc" }, { versionNumber: "desc" }],
        });
        application.artifacts = latestVersionsOnly
          ? dedupeLatestByType(artifacts)
          : artifacts;
      }

      if (scope.application.recentEvents) {
        application.events = await prisma.event.findMany({
          where: { applicationId: appRow.id },
          orderBy: { emittedAt: "desc" },
          take: scope.application.recentEvents.limit,
        });
      }
    }
  }

  let tokenBudgetUsed = computeUsage(candidate, application);

  if (tokenBudgetUsed > budget.maxTokens && candidate?.masterCV?.rawText) {
    const before = candidate.masterCV.rawText;
    candidate.masterCV = {
      ...candidate.masterCV,
      rawText: clampLastFraction(before, 2 / 3),
    };
    excludedReasons.push(
      `MasterCV.rawText trimmed to last 2/3 (${before.length} -> ${candidate.masterCV.rawText.length} chars)`,
    );
    tokenBudgetUsed = computeUsage(candidate, application);
  }

  if (tokenBudgetUsed > budget.maxTokens && application?.opportunity?.jdText) {
    const before = application.opportunity.jdText;
    application.opportunity = {
      ...application.opportunity,
      jdText: clampFirstFraction(before, 0.75),
    };
    excludedReasons.push(
      `Opportunity.jdText trimmed to first 75% (${before.length} -> ${application.opportunity.jdText.length} chars)`,
    );
    tokenBudgetUsed = computeUsage(candidate, application);
  }

  if (tokenBudgetUsed > budget.maxTokens) {
    excludedReasons.push(
      `tokenBudgetUsed=${tokenBudgetUsed} still exceeds budget=${budget.maxTokens}; RolePreference is fixed-size and not trimmed`,
    );
  }

  return { candidate, application, tokenBudgetUsed, excludedReasons };
}

function dedupeLatestByType<T extends { type: ArtifactType; versionNumber: number }>(
  rows: T[],
): T[] {
  const seen = new Map<ArtifactType, T>();
  for (const r of rows) {
    const prior = seen.get(r.type);
    if (!prior || r.versionNumber > prior.versionNumber) {
      seen.set(r.type, r);
    }
  }
  return Array.from(seen.values());
}

function computeUsage(
  candidate: ScopedCandidate | undefined,
  application: ScopedApplication | undefined,
): number {
  let used = 0;
  if (candidate?.masterCV?.rawText) used += estimateTokens(candidate.masterCV.rawText);
  if (candidate?.masterCV?.structuredJson)
    used += estimateTokens(JSON.stringify(candidate.masterCV.structuredJson));
  if (candidate?.rolePreference)
    used += estimateTokens(JSON.stringify(candidate.rolePreference));
  if (application?.opportunity?.jdText) used += estimateTokens(application.opportunity.jdText);
  if (application?.opportunity?.jdStructuredJson)
    used += estimateTokens(JSON.stringify(application.opportunity.jdStructuredJson));
  return used;
}
