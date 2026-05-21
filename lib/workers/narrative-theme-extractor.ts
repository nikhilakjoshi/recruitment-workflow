import {
  ArtifactState,
  ArtifactType,
  InsightType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import { parseLLMJson } from "@/lib/ai/parse-json";
import {
  narrativeThemesSchema,
  type NarrativeThemes,
} from "@/lib/schemas/narrative-themes";
import {
  SYSTEM_PROMPT,
  STRICT_REMINDER,
  buildBlock,
} from "./narrative-theme-extractor.prompts";

export const NARRATIVE_THEME_WINDOW = 30;
export const NARRATIVE_THEME_SCHEDULE = "0 10 * * 0"; // Sundays 10:00 UTC

export type NarrativeThemeExtractorResult = {
  candidateId: string;
  insightId?: string;
  resumesConsidered: number;
  skipped?: boolean;
  reason?: string;
};

function parseThemes(text: string): NarrativeThemes | null {
  const json = parseLLMJson(text);
  if (json === null) return null;
  const parsed = narrativeThemesSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

async function loadRecentResumes(
  candidateId: string,
  limit: number,
): Promise<{ generatedAt: Date; contentText: string }[]> {
  const rows = await prisma.artifact.findMany({
    where: {
      type: ArtifactType.TAILORED_RESUME,
      state: ArtifactState.APPROVED,
      contentText: { not: null },
      application: { candidateId },
    },
    orderBy: { generatedAt: "desc" },
    take: limit,
    select: { generatedAt: true, contentText: true },
  });
  return rows.flatMap((r) =>
    r.contentText ? [{ generatedAt: r.generatedAt, contentText: r.contentText }] : [],
  );
}

function buildCorpus(rows: { generatedAt: Date; contentText: string }[]): string {
  return rows
    .map((r, i) => {
      const date = r.generatedAt.toISOString().slice(0, 10);
      return `### Resume ${i + 1} (approved ${date})\n${r.contentText}`;
    })
    .join("\n\n");
}

export async function runNarrativeThemeExtractorForCandidate(
  candidateId: string,
  opts: { limit?: number } = {},
): Promise<NarrativeThemeExtractorResult> {
  const limit = opts.limit ?? NARRATIVE_THEME_WINDOW;
  const resumes = await loadRecentResumes(candidateId, limit);
  if (resumes.length < 2) {
    return {
      candidateId,
      resumesConsidered: resumes.length,
      skipped: true,
      reason: "insufficient_data",
    };
  }

  const corpus = buildCorpus(resumes);
  const messages: LLMMessage[] = [
    { role: "user", content: buildBlock({ resumeCorpus: corpus }) },
  ];

  const first = await callLLM({
    worker: "narrative-theme-extractor",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 3_000,
    temperature: 0.3,
  });
  let themes = parseThemes(first.text);
  if (!themes) {
    const second = await callLLM({
      worker: "narrative-theme-extractor",
      model: "standard",
      system: SYSTEM_PROMPT,
      messages: [
        ...messages,
        { role: "user", content: STRICT_REMINDER },
      ],
      maxTokens: 3_000,
      temperature: 0,
    });
    themes = parseThemes(second.text);
  }

  if (!themes) {
    return {
      candidateId,
      resumesConsidered: resumes.length,
      skipped: true,
      reason: "schema_parse_failure",
    };
  }

  const insight = await prisma.insight.create({
    data: {
      candidateId,
      type: InsightType.NARRATIVE_THEME,
      contentJson: themes as unknown as Prisma.InputJsonValue,
      confidence: 0.5,
    },
  });

  return {
    candidateId,
    insightId: insight.id,
    resumesConsidered: resumes.length,
  };
}

export async function runNarrativeThemeExtractor(): Promise<
  NarrativeThemeExtractorResult[]
> {
  const candidates = await prisma.candidate.findMany({ select: { id: true } });
  const results: NarrativeThemeExtractorResult[] = [];
  for (const c of candidates) {
    results.push(await runNarrativeThemeExtractorForCandidate(c.id));
  }
  return results;
}
