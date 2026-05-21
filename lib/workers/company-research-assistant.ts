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
import { search, type SearchResult } from "@/lib/search/brave";
import {
  companyResearchSchema,
  type CompanyResearch,
} from "@/lib/schemas/company-research";
import {
  SYSTEM_PROMPT,
  STRICT_REMINDER,
  buildCachedBlock,
  buildUncachedBlock,
} from "./company-research-assistant.prompts";
import type { Worker, WorkerScope } from "./types";

export const companyResearchScope: WorkerScope = {
  candidate: { masterCV: false, rolePreference: true },
  application: { opportunity: true },
};

export type CompanyResearchOutput = {
  artifactId: string;
  versionNumber: number;
  failed?: boolean;
  reason?: string;
};

type SearchFn = typeof search;

let searchImpl: SearchFn = search;

export function _setSearchForTests(fn: SearchFn | null): void {
  searchImpl = fn ?? search;
}

function parseResearch(text: string): CompanyResearch | null {
  const json = parseLLMJson(text);
  if (json === null) return null;
  const parsed = companyResearchSchema.safeParse(json);
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

function summarizeSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "(no search results)";
  return results
    .map((r, i) => {
      const dateLine = r.publishedDate ? `Date: ${r.publishedDate}` : null;
      return [
        `[${i + 1}] ${r.title}`,
        dateLine,
        `URL: ${r.url}`,
        r.description,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function renderResearchMarkdown(research: CompanyResearch, company: string): string {
  const lines: string[] = [];
  lines.push(`# Company research — ${company}`);
  lines.push("");
  lines.push(`## Business model`);
  lines.push(research.businessModel);
  lines.push("");
  if (research.recentNews.length > 0) {
    lines.push(`## Recent news`);
    for (const n of research.recentNews) {
      lines.push(`- **${n.headline}** ${n.publishedDate ? `_(${n.publishedDate})_` : ""}`);
      if (n.summary) lines.push(`  ${n.summary}`);
      if (n.url) lines.push(`  ${n.url}`);
    }
    lines.push("");
  }
  lines.push(`## Smart questions to ask`);
  for (const q of research.smartQuestions) lines.push(`- ${q}`);
  lines.push("");
  if (research.redFlags.length > 0) {
    lines.push(`## Red flags`);
    for (const f of research.redFlags) lines.push(`- ${f}`);
  }
  return lines.join("\n").trimEnd();
}

export const companyResearchAssistantWorker: Worker<unknown, CompanyResearchOutput> = {
  name: "company-research-assistant",
  runtime: "per-interview",
  scope: companyResearchScope,
  model: "standard",
  subscribes: [
    EventType.RECRUITER_REPLY_DETECTED,
    EventType.INTERVIEW_SCHEDULED,
  ],
  timeoutMs: 90_000,
  async run(ctx) {
    const application = ctx.scopedMemory.application;
    if (!application || !application.opportunity) {
      throw new Error(
        "company-research-assistant: missing application or opportunity in scoped memory",
      );
    }

    const company = application.opportunity.company;
    let searchResults: SearchResult[] = [];
    try {
      searchResults = await searchImpl(`${company} news`, {
        freshness: "pm",
        count: 5,
      });
    } catch (err) {
      // Brave failure shouldn't block the prep; we still ask Sonnet to draft
      // questions + business model from the JD alone, with no news block.
      searchResults = [];
      ctx.scopedMemory.excludedReasons.push(
        `Brave search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const promptInputs = {
      rolePreferences: summarizeRolePreference(ctx.scopedMemory.candidate?.rolePreference),
      opportunity: summarizeOpportunity(application.opportunity),
      searchResults: summarizeSearchResults(searchResults),
    };

    const cached = buildCachedBlock(promptInputs);
    const uncached = buildUncachedBlock(promptInputs);

    const baseMessages: LLMMessage[] = [
      { role: "user", content: cached, cache: true },
      { role: "user", content: uncached },
    ];

    const research = await runWithRetry(ctx.event.id, application.id, baseMessages);

    if (!research) {
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
        type: ArtifactType.COMPANY_RESEARCH,
      },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (prior?.versionNumber ?? 0) + 1;

    const artifact = await prisma.artifact.create({
      data: {
        applicationId: application.id,
        type: ArtifactType.COMPANY_RESEARCH,
        state: ArtifactState.APPROVED,
        contentJson: research as unknown as Prisma.InputJsonValue,
        contentText: renderResearchMarkdown(research, company),
        versionNumber,
        parentVersionId: prior?.id ?? null,
        generatedByWorker: "company-research-assistant",
        generationContext: {
          scopedMemoryTokens: ctx.scopedMemory.tokenBudgetUsed,
          modelUsed: "standard",
          triggeredByEventId: ctx.event.id,
          searchResultCount: searchResults.length,
        },
        approvedAt: new Date(),
      },
    });

    await emitEvent({
      type: EventType.COMPANY_RESEARCH_GENERATED,
      candidateId: ctx.candidate.id,
      applicationId: application.id,
      payload: {
        artifactId: artifact.id,
        versionNumber,
        triggeredByEventId: ctx.event.id,
      },
      emittedBy: "company-research-assistant",
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
): Promise<CompanyResearch | null> {
  const first = await callLLM({
    worker: "company-research-assistant",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 3_000,
    temperature: 0.4,
    eventId,
    applicationId,
  });
  const firstParsed = parseResearch(first.text);
  if (firstParsed) return firstParsed;

  const retryMessages: LLMMessage[] = [
    ...messages,
    { role: "user", content: STRICT_REMINDER },
  ];
  const second = await callLLM({
    worker: "company-research-assistant",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages: retryMessages,
    maxTokens: 3_000,
    temperature: 0,
    eventId,
    applicationId,
  });
  return parseResearch(second.text);
}
