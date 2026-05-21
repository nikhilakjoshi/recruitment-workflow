import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ApplicationState,
  EventType,
  InsightType,
  OpportunitySource,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { _setGenerateTextForTests } from "@/lib/ai/client";
import { _setSenderForTests } from "@/lib/email/send-digest";
import { emitEvent } from "@/lib/events";
import { weeklyDigestWorker } from "./weekly-digest";
import type { ScheduledWorkerContext } from "./types";

let candidateId: string;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.insight.deleteMany({});
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
    data: { email: "digest@example.com", passwordHash: await hashPassword("x") },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.insight.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
});

afterEach(() => {
  _setGenerateTextForTests(null);
  _setSenderForTests(null);
});

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

function mockNarrative(paragraph: string, highlights: string[]) {
  _setGenerateTextForTests(
    async () =>
      ({
        text: JSON.stringify({ paragraph, highlights }),
        usage: { inputTokens: 100, outputTokens: 80 },
        response: { id: "t", modelId: "anthropic/claude-sonnet-4.6", timestamp: new Date() },
        finishReason: "stop",
      }) as never,
  );
}

async function ctx(): Promise<ScheduledWorkerContext> {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  return { candidate, scopedMemory: { tokenBudgetUsed: 0, excludedReasons: [] }, runAt: new Date() };
}

describe("weekly-digest worker", () => {
  it("schedules on Sunday 9am UTC", () => {
    expect(weeklyDigestWorker.schedule).toBe("0 9 * * 0");
    expect(weeklyDigestWorker.runtime).toBe("always-on");
    expect(weeklyDigestWorker.name).toBe("weekly-digest");
  });

  it("writes one WEEKLY_DIGEST Insight with counts from the past 7 days", async () => {
    await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: {},
      emittedBy: "test",
    });
    await emitEvent({
      type: EventType.JOB_DISCOVERED,
      candidateId,
      payload: {},
      emittedBy: "test",
    });
    await emitEvent({
      type: EventType.JOB_RANKED,
      candidateId,
      payload: {},
      emittedBy: "test",
    });
    await emitEvent({
      type: EventType.APPROVAL_GRANTED,
      candidateId,
      payload: {},
      emittedBy: "test",
    });

    mockNarrative("You shipped a lot this week.", ["2 new opportunities", "1 approval"]);
    const { output } = await weeklyDigestWorker.run(await ctx());

    const insight = await prisma.insight.findUniqueOrThrow({
      where: { id: output.insightId },
    });
    expect(insight.type).toBe(InsightType.WEEKLY_DIGEST);
    const content = insight.contentJson as Record<string, unknown>;
    expect(content.paragraph).toContain("shipped a lot");
    const counts = content.counts as Record<string, number>;
    expect(counts.opportunitiesDiscovered).toBe(2);
    expect(counts.opportunitiesRanked).toBe(1);
    expect(counts.approvalsGranted).toBe(1);
    expect(counts.interviewsScheduled).toBe(0);
  });

  it("falls back to a deterministic narrative when the LLM returns malformed JSON twice", async () => {
    let callCount = 0;
    _setGenerateTextForTests(async () => {
      callCount += 1;
      return {
        text: "not valid json",
        usage: { inputTokens: 50, outputTokens: 40 },
        response: { id: "x", modelId: "anthropic/claude-sonnet-4.6", timestamp: new Date() },
        finishReason: "stop",
      } as never;
    });

    const { output } = await weeklyDigestWorker.run(await ctx());
    expect(callCount).toBe(2);
    const insight = await prisma.insight.findUniqueOrThrow({
      where: { id: output.insightId },
    });
    const content = insight.contentJson as Record<string, unknown>;
    expect(content.paragraph).toMatch(/could not generate/i);
    expect(content.highlights).toBeInstanceOf(Array);
  });

  it("invokes the email sender when AUTH_USER_EMAIL is set and stores the message id", async () => {
    const sent: { to: string; subject: string }[] = [];
    _setSenderForTests(async (args) => {
      sent.push({ to: args.to, subject: args.subject });
      return { id: "resend-message-id-123" };
    });
    const prior = process.env.AUTH_USER_EMAIL;
    process.env.AUTH_USER_EMAIL = "user@example.com";
    try {
      mockNarrative("Nice week.", ["Highlight"]);
      const { output } = await weeklyDigestWorker.run(await ctx());
      expect(output.emailMessageId).toBe("resend-message-id-123");
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("user@example.com");
      expect(sent[0].subject).toContain("Weekly Digest");
    } finally {
      if (prior === undefined) delete process.env.AUTH_USER_EMAIL;
      else process.env.AUTH_USER_EMAIL = prior;
    }
  });

  it("skips email when AUTH_USER_EMAIL is unset", async () => {
    const prior = process.env.AUTH_USER_EMAIL;
    delete process.env.AUTH_USER_EMAIL;
    try {
      mockNarrative("No email.", ["x"]);
      const sendCalled: number[] = [];
      _setSenderForTests(async () => {
        sendCalled.push(1);
        return { id: "should-not-fire" };
      });
      const { output } = await weeklyDigestWorker.run(await ctx());
      expect(output.emailMessageId).toBeNull();
      expect(sendCalled).toHaveLength(0);
    } finally {
      if (prior !== undefined) process.env.AUTH_USER_EMAIL = prior;
    }
  });

  it("counts groupBy applicationsByState only for apps updated within the window", async () => {
    // App updated this week → counted.
    const opp = await prisma.opportunity.create({
      data: {
        title: "T",
        company: "C",
        jdText: "x",
        sourcePlatform: OpportunitySource.MANUAL,
      },
    });
    await prisma.application.create({
      data: {
        candidateId,
        opportunityId: opp.id,
        state: ApplicationState.SUBMITTED,
        targetRoleSnapshot: {},
      },
    });
    // App updated 10 days ago → outside window.
    const oldOpp = await prisma.opportunity.create({
      data: {
        title: "Old",
        company: "Old",
        jdText: "x",
        sourcePlatform: OpportunitySource.MANUAL,
      },
    });
    const oldApp = await prisma.application.create({
      data: {
        candidateId,
        opportunityId: oldOpp.id,
        state: ApplicationState.ARCHIVED,
        targetRoleSnapshot: {},
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "Application" SET "updatedAt" = $1::timestamptz WHERE "id" = $2`,
      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      oldApp.id,
    );

    mockNarrative("test", ["x"]);
    const { output } = await weeklyDigestWorker.run(await ctx());
    const insight = await prisma.insight.findUniqueOrThrow({
      where: { id: output.insightId },
    });
    const counts = (insight.contentJson as {
      counts: { applicationsByState: Record<string, number> };
    }).counts;
    expect(counts.applicationsByState.SUBMITTED).toBe(1);
    expect(counts.applicationsByState.ARCHIVED).toBe(0);
  });
});
