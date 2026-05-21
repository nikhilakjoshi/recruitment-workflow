import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EventType, OpportunitySource, RemotePolicy } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { _setGenerateTextForTests } from "@/lib/ai/client";
import type { JobSearchAdapter, RawListing } from "@/lib/scrapers/types";
import {
  _setAdaptersForTests,
  jobAlertAggregatorWorker,
} from "./job-alert-aggregator";
import type { ScheduledWorkerContext } from "./types";

let candidateId: string;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.followUp.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.rolePreference.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "aggregator@example.com", passwordHash: await hashPassword("x") },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
  await prisma.rolePreference.create({
    data: {
      candidateId,
      targetRoles: ["Staff Engineer"],
      targetIndustries: ["SaaS"],
      targetCompanies: [],
      excludedCompanies: [],
      geoLocations: ["Remote"],
      remotePolicy: RemotePolicy.REMOTE,
    },
  });
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.opportunity.deleteMany({});
});

afterEach(() => {
  _setAdaptersForTests(null);
  _setGenerateTextForTests(null);
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

function makeAdapter(source: OpportunitySource, listings: RawListing[]): JobSearchAdapter {
  return {
    source,
    parseHtml: () => listings,
    async searchJobs() {
      return listings;
    },
  };
}

async function buildCtx(): Promise<ScheduledWorkerContext> {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  return {
    candidate,
    scopedMemory: { tokenBudgetUsed: 0, excludedReasons: [] },
    runAt: new Date(),
  };
}

function mockRankResponse(
  ids: { id: string; rankScore: number; rankReason: string }[],
) {
  _setGenerateTextForTests(
    async () =>
      ({
        text: JSON.stringify({ rankings: ids }),
        usage: { inputTokens: 100, outputTokens: 80 },
        response: { id: "test", modelId: "anthropic/claude-haiku-4.5", timestamp: new Date() },
        finishReason: "stop",
      }) as never,
  );
}

describe("job-alert-aggregator worker", () => {
  it("is registered as a scheduled worker with the right cadence", () => {
    expect(jobAlertAggregatorWorker.name).toBe("job-alert-aggregator");
    expect(jobAlertAggregatorWorker.schedule).toBe("0 8 * * *");
    expect(jobAlertAggregatorWorker.runtime).toBe("always-on");
  });

  it("scrapes, inserts Opportunity rows, emits JOB_DISCOVERED + JOB_RANKED", async () => {
    _setAdaptersForTests([
      makeAdapter(OpportunitySource.LINKEDIN, [
        {
          source: OpportunitySource.LINKEDIN,
          title: "Senior Engineer",
          company: "Acme",
          jdSnippet: "Node + Postgres.",
          sourceUrl: "https://linkedin.com/jobs/1",
        },
      ]),
      makeAdapter(OpportunitySource.INDEED, [
        {
          source: OpportunitySource.INDEED,
          title: "Backend Engineer",
          company: "Globex",
          jdSnippet: "Go services at scale.",
          sourceUrl: "https://indeed.com/viewjob?jk=2",
        },
      ]),
    ]);

    // Mock the rank LLM call to return scores for both newly-inserted rows.
    const interceptedIds: string[] = [];
    _setGenerateTextForTests(async () => {
      const ops = await prisma.opportunity.findMany();
      ops.forEach((o) => interceptedIds.push(o.id));
      return {
        text: JSON.stringify({
          rankings: ops.map((o, i) => ({
            id: o.id,
            rankScore: 90 - i * 10,
            rankReason: "Good fit.",
          })),
        }),
        usage: { inputTokens: 100, outputTokens: 80 },
        response: {
          id: "test",
          modelId: "anthropic/claude-haiku-4.5",
          timestamp: new Date(),
        },
        finishReason: "stop",
      } as never;
    });

    const { output } = await jobAlertAggregatorWorker.run(await buildCtx());
    expect(output.inserted).toBe(2);
    expect(output.ranked).toBe(2);
    expect(output.errors).toEqual([]);

    const ops = await prisma.opportunity.findMany({ orderBy: { rankScore: "desc" } });
    expect(ops).toHaveLength(2);
    expect(ops[0].rankScore).toBe(90);
    expect(ops[0].rankReason).toBe("Good fit.");

    const discovered = await prisma.event.findMany({
      where: { type: EventType.JOB_DISCOVERED },
    });
    expect(discovered).toHaveLength(2);
    const ranked = await prisma.event.findMany({
      where: { type: EventType.JOB_RANKED },
    });
    expect(ranked).toHaveLength(2);
  });

  it("dedupes the same (company, title) across multiple sources", async () => {
    const sharedTitle = "Platform Engineer (Remote)";
    _setAdaptersForTests([
      makeAdapter(OpportunitySource.LINKEDIN, [
        {
          source: OpportunitySource.LINKEDIN,
          title: sharedTitle,
          company: "Soylent",
          jdSnippet: "K8s + Go.",
          sourceUrl: null,
        },
      ]),
      makeAdapter(OpportunitySource.WELLFOUND, [
        {
          source: OpportunitySource.WELLFOUND,
          title: "Platform Engineer",
          company: "Soylent",
          jdSnippet: "Same role, different board.",
          sourceUrl: null,
        },
      ]),
    ]);
    mockRankResponse([]);

    const { output } = await jobAlertAggregatorWorker.run(await buildCtx());
    expect(output.scraped).toBe(2);
    expect(output.deduped).toBe(1);
    expect(output.inserted).toBe(1);
  });

  it("skips already-stored postings on subsequent runs", async () => {
    const listings: RawListing[] = [
      {
        source: OpportunitySource.INDEED,
        title: "Backend Engineer",
        company: "Globex",
        jdSnippet: "Go services.",
        sourceUrl: null,
      },
    ];
    _setAdaptersForTests([makeAdapter(OpportunitySource.INDEED, listings)]);
    mockRankResponse([]); // mocked even on insertion paths (no rows ranked OK)
    _setGenerateTextForTests(async () => {
      const ops = await prisma.opportunity.findMany();
      return {
        text: JSON.stringify({
          rankings: ops.map((o) => ({ id: o.id, rankScore: 50, rankReason: "ok" })),
        }),
        usage: { inputTokens: 50, outputTokens: 40 },
        response: {
          id: "test",
          modelId: "anthropic/claude-haiku-4.5",
          timestamp: new Date(),
        },
        finishReason: "stop",
      } as never;
    });

    await jobAlertAggregatorWorker.run(await buildCtx());
    const second = await jobAlertAggregatorWorker.run(await buildCtx());
    expect(second.output.inserted).toBe(0);
    expect(second.output.ranked).toBe(0);

    const ops = await prisma.opportunity.findMany();
    expect(ops).toHaveLength(1);
  });

  it("records scrape errors without dropping the rest of the run", async () => {
    const breaks: JobSearchAdapter = {
      source: OpportunitySource.WELLFOUND,
      parseHtml: () => [],
      async searchJobs() {
        throw new Error("session expired");
      },
    };
    _setAdaptersForTests([
      breaks,
      makeAdapter(OpportunitySource.INDEED, [
        {
          source: OpportunitySource.INDEED,
          title: "Engineer",
          company: "Acme",
          jdSnippet: "ok",
          sourceUrl: null,
        },
      ]),
    ]);
    _setGenerateTextForTests(async () => {
      const ops = await prisma.opportunity.findMany();
      return {
        text: JSON.stringify({
          rankings: ops.map((o) => ({ id: o.id, rankScore: 60, rankReason: "ok" })),
        }),
        usage: { inputTokens: 50, outputTokens: 40 },
        response: {
          id: "test",
          modelId: "anthropic/claude-haiku-4.5",
          timestamp: new Date(),
        },
        finishReason: "stop",
      } as never;
    });

    const { output } = await jobAlertAggregatorWorker.run(await buildCtx());
    expect(output.errors[0]).toContain("WELLFOUND");
    expect(output.errors[0]).toContain("session expired");
    expect(output.inserted).toBe(1);
    expect(output.ranked).toBe(1);
  });
});
