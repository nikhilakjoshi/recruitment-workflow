import {
  EventType,
  OpportunitySource,
  type RolePreference,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import { parseLLMJson } from "@/lib/ai/parse-json";
import { dedupeListings, listingHash } from "@/lib/scrapers/dedupe";
import { indeedAdapter } from "@/lib/scrapers/indeed";
import { linkedInAdapter } from "@/lib/scrapers/linkedin";
import { wellfoundAdapter } from "@/lib/scrapers/wellfound";
import type { JobSearchAdapter, RawListing } from "@/lib/scrapers/types";
import {
  opportunityRankBatchSchema,
  type OpportunityRank,
} from "@/lib/schemas/opportunity-rank";
import type { ScheduledWorker } from "./types";

const DEFAULT_ADAPTERS: JobSearchAdapter[] = [
  linkedInAdapter,
  indeedAdapter,
  wellfoundAdapter,
];

let adapters: JobSearchAdapter[] = DEFAULT_ADAPTERS;

// Test-only: override the adapter list so tests can inject fakes that
// return fixture-derived listings without hitting the network.
export function _setAdaptersForTests(next: JobSearchAdapter[] | null): void {
  adapters = next ?? DEFAULT_ADAPTERS;
}

export type AggregatorRunOutput = {
  scraped: number;
  deduped: number;
  inserted: number;
  ranked: number;
  errors: string[];
};

async function scrapeAll(
  rolePrefs: RolePreference,
): Promise<{ listings: RawListing[]; errors: string[] }> {
  const listings: RawListing[] = [];
  const errors: string[] = [];
  for (const adapter of adapters) {
    try {
      const got = await adapter.searchJobs(rolePrefs);
      listings.push(...got);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${adapter.source}: ${message}`);
    }
  }
  return { listings, errors };
}

async function insertNewOpportunities(
  candidateId: string,
  listings: RawListing[],
): Promise<{ inserted: { id: string; title: string; company: string; jdSnippet: string }[] }> {
  // Find existing rows by listing hash. We don't store the hash directly;
  // instead recompute from (company, title) of every Opportunity and
  // exclude matches. For a single-tenant build this is cheap.
  const allExisting = await prisma.opportunity.findMany({
    select: { company: true, title: true },
  });
  const existingHashes = new Set(allExisting.map(listingHash));

  const inserted: { id: string; title: string; company: string; jdSnippet: string }[] = [];
  for (const l of listings) {
    if (existingHashes.has(listingHash(l))) continue;
    const created = await prisma.opportunity.create({
      data: {
        title: l.title,
        company: l.company,
        sourceUrl: l.sourceUrl,
        sourcePlatform: l.source,
        jdText: l.jdSnippet || "(no snippet)",
      },
    });
    await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: {
        opportunityId: created.id,
        source: l.source,
        title: l.title,
        company: l.company,
      },
      emittedBy: "job-alert-aggregator",
    });
    inserted.push({
      id: created.id,
      title: l.title,
      company: l.company,
      jdSnippet: l.jdSnippet,
    });
  }
  return { inserted };
}

const SYSTEM_PROMPT = `You are a job-fit ranker for a single candidate's pipeline.
Given the candidate's role preferences and a batch of newly discovered job
postings, return a JSON object {"rankings":[{id, rankScore, rankReason}]}.

- rankScore: integer 0-100 (100 = perfect fit for their stated roles +
  industries + geo + comp; 0 = completely off).
- rankReason: one-sentence explanation (<= 25 words).
- Cover every id in the input exactly once. JSON only.`;

function buildRankPrompt(
  rolePrefs: RolePreference,
  batch: { id: string; title: string; company: string; jdSnippet: string }[],
): LLMMessage[] {
  return [
    {
      role: "user",
      cache: true,
      content: `Candidate role preferences:\n${JSON.stringify(rolePrefs, null, 2)}`,
    },
    {
      role: "user",
      content: `Rank these ${batch.length} postings:\n${JSON.stringify(batch, null, 2)}`,
    },
  ];
}

async function rankNewOpportunities(
  candidateId: string,
  rolePrefs: RolePreference,
  batch: { id: string; title: string; company: string; jdSnippet: string }[],
): Promise<{ ranked: number; errors: string[] }> {
  if (batch.length === 0) return { ranked: 0, errors: [] };
  const errors: string[] = [];
  const messages = buildRankPrompt(rolePrefs, batch);
  const response = await callLLM({
    worker: "job-alert-aggregator",
    model: "cheap",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 2_000,
    temperature: 0.2,
  });
  const parsed = parseLLMJson(response.text);
  const schemaParse = opportunityRankBatchSchema.safeParse(parsed);
  if (!schemaParse.success) {
    errors.push(`rank parse failed: ${schemaParse.error.message}`);
    return { ranked: 0, errors };
  }
  let ranked = 0;
  for (const r of schemaParse.data.rankings) {
    const ok = await applyRank(candidateId, r);
    if (ok) ranked += 1;
    else errors.push(`unknown opportunity id ${r.id}`);
  }
  return { ranked, errors };
}

async function applyRank(candidateId: string, r: OpportunityRank): Promise<boolean> {
  const existing = await prisma.opportunity.findUnique({ where: { id: r.id } });
  if (!existing) return false;
  await prisma.opportunity.update({
    where: { id: r.id },
    data: { rankScore: r.rankScore, rankReason: r.rankReason },
  });
  await emitEvent({
    type: EventType.JOB_RANKED,
    candidateId,
    payload: {
      opportunityId: r.id,
      rankScore: r.rankScore,
      rankReason: r.rankReason,
    },
    emittedBy: "job-alert-aggregator",
  });
  return true;
}

export const jobAlertAggregatorWorker: ScheduledWorker<AggregatorRunOutput> = {
  name: "job-alert-aggregator",
  schedule: "0 8 * * *",
  runtime: "always-on",
  model: "cheap",
  timeoutMs: 300_000,
  async run(ctx) {
    const rolePrefs = await prisma.rolePreference.findUnique({
      where: { candidateId: ctx.candidate.id },
    });
    if (!rolePrefs) {
      throw new Error("job-alert-aggregator: candidate has no RolePreference");
    }

    const { listings, errors: scrapeErrors } = await scrapeAll(rolePrefs);
    const deduped = dedupeListings(listings);
    const { inserted } = await insertNewOpportunities(ctx.candidate.id, deduped);
    const { ranked, errors: rankErrors } = await rankNewOpportunities(
      ctx.candidate.id,
      rolePrefs,
      inserted,
    );
    const summary: AggregatorRunOutput = {
      scraped: listings.length,
      deduped: deduped.length,
      inserted: inserted.length,
      ranked,
      errors: [...scrapeErrors, ...rankErrors],
    };
    return { output: summary };
  },
};

// Re-export the constant for tests that want to assert source coverage.
export const KNOWN_SOURCES = [
  OpportunitySource.LINKEDIN,
  OpportunitySource.INDEED,
  OpportunitySource.WELLFOUND,
] as const;
