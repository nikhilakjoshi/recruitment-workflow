import {
  ApplicationState,
  EventType,
  InsightType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { callLLM, type LLMMessage } from "@/lib/ai/client";
import { parseLLMJson } from "@/lib/ai/parse-json";
import { sendDigestEmail } from "@/lib/email/send-digest";
import {
  weeklyDigestNarrativeSchema,
  type WeeklyDigestContent,
  type WeeklyDigestNarrative,
} from "@/lib/schemas/weekly-digest";
import { SYSTEM_PROMPT, buildUserMessage } from "./weekly-digest.prompts";
import type { ScheduledWorker } from "./types";

export type WeeklyDigestOutput = {
  insightId: string;
  emailMessageId: string | null;
};

type Counts = WeeklyDigestContent["counts"];

async function collectCounts(candidateId: string, since: Date): Promise<Counts> {
  const opportunitiesDiscovered = await prisma.event.count({
    where: { candidateId, type: EventType.JOB_DISCOVERED, emittedAt: { gte: since } },
  });
  const opportunitiesRanked = await prisma.event.count({
    where: { candidateId, type: EventType.JOB_RANKED, emittedAt: { gte: since } },
  });
  const approvalsGranted = await prisma.event.count({
    where: { candidateId, type: EventType.APPROVAL_GRANTED, emittedAt: { gte: since } },
  });
  const interviewsScheduled = await prisma.event.count({
    where: { candidateId, type: EventType.INTERVIEW_SCHEDULED, emittedAt: { gte: since } },
  });
  const offersReceived = await prisma.event.count({
    where: { candidateId, type: EventType.OFFER_RECEIVED, emittedAt: { gte: since } },
  });

  const stateRows = await prisma.application.groupBy({
    by: ["state"],
    where: { candidateId, updatedAt: { gte: since } },
    _count: { state: true },
  });
  const applicationsByState: Record<string, number> = {};
  for (const state of Object.values(ApplicationState)) {
    applicationsByState[state] = 0;
  }
  for (const row of stateRows) {
    applicationsByState[row.state] = row._count.state;
  }

  return {
    opportunitiesDiscovered,
    opportunitiesRanked,
    applicationsByState,
    approvalsGranted,
    interviewsScheduled,
    offersReceived,
  };
}

async function generateNarrative(counts: Counts): Promise<WeeklyDigestNarrative> {
  const messages: LLMMessage[] = [
    { role: "user", content: buildUserMessage(counts) },
  ];
  const first = await callLLM({
    worker: "weekly-digest",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 1_200,
    temperature: 0.5,
  });
  const parsed = weeklyDigestNarrativeSchema.safeParse(parseLLMJson(first.text));
  if (parsed.success) return parsed.data;

  // Retry once at temperature 0 with a strict reminder.
  const retry = await callLLM({
    worker: "weekly-digest",
    model: "standard",
    system: SYSTEM_PROMPT,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          'Previous response was not valid JSON of the schema. Return ONLY: {"paragraph":"...","highlights":["..."]}',
      },
    ],
    maxTokens: 1_200,
    temperature: 0,
  });
  const retryParsed = weeklyDigestNarrativeSchema.safeParse(parseLLMJson(retry.text));
  if (retryParsed.success) return retryParsed.data;

  // Last-resort deterministic fallback so the worker never silently no-ops.
  return {
    paragraph:
      "We could not generate a digest narrative this week. See the counts above for raw activity.",
    highlights: [
      `${counts.opportunitiesDiscovered} new opportunities`,
      `${counts.approvalsGranted} approvals`,
      `${counts.interviewsScheduled} interviews scheduled`,
    ],
  };
}

function renderEmailText(content: WeeklyDigestContent): string {
  const lines = [
    `Career OS — Weekly Digest`,
    `Week of ${content.weekStart} → ${content.weekEnd}`,
    ``,
    content.paragraph,
    ``,
    `Highlights:`,
    ...content.highlights.map((h) => `- ${h}`),
    ``,
    `Activity counts:`,
    `- ${content.counts.opportunitiesDiscovered} new opportunities`,
    `- ${content.counts.opportunitiesRanked} ranked`,
    `- ${content.counts.approvalsGranted} approvals granted`,
    `- ${content.counts.interviewsScheduled} interviews scheduled`,
    `- ${content.counts.offersReceived} offers received`,
  ];
  return lines.join("\n");
}

export const weeklyDigestWorker: ScheduledWorker<WeeklyDigestOutput> = {
  name: "weekly-digest",
  schedule: "0 9 * * 0",
  runtime: "always-on",
  model: "standard",
  timeoutMs: 120_000,
  async run(ctx) {
    const weekEnd = ctx.runAt;
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const counts = await collectCounts(ctx.candidate.id, weekStart);
    const narrative = await generateNarrative(counts);

    let emailMessageId: string | null = null;
    if (process.env.AUTH_USER_EMAIL) {
      const tempContent: WeeklyDigestContent = {
        ...narrative,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        counts,
        emailMessageId: null,
      };
      const sent = await sendDigestEmail({
        to: process.env.AUTH_USER_EMAIL,
        subject: `Career OS — Weekly Digest`,
        text: renderEmailText(tempContent),
      });
      emailMessageId = sent.id;
    }

    const contentJson: WeeklyDigestContent = {
      ...narrative,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      counts,
      emailMessageId,
    };

    const insight = await prisma.insight.create({
      data: {
        candidateId: ctx.candidate.id,
        type: InsightType.WEEKLY_DIGEST,
        contentJson: contentJson as unknown as Prisma.InputJsonValue,
        confidence: 1,
      },
    });

    return {
      output: { insightId: insight.id, emailMessageId },
    };
  },
};
