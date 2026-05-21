"use server";

import { revalidatePath } from "next/cache";
import { EventType, type Opportunity } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { dispatchOnce } from "@/lib/workers/dispatch";
import "@/lib/workers";
import {
  opportunityCreateSchema,
  type OpportunityCreateInput,
} from "@/lib/schemas/opportunity";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function requireCandidateId(): Promise<{ candidateId: string } | { error: string }> {
  const session = await getSession();
  if (!session.userId) return { error: "Unauthorized" };
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId },
    select: { id: true },
  });
  return { candidateId: candidate.id };
}

export async function addOpportunityAction(
  input: OpportunityCreateInput,
): Promise<ActionResult<Opportunity>> {
  const ctx = await requireCandidateId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = opportunityCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const opportunity = await prisma.opportunity.create({
    data: {
      title: v.title,
      company: v.company,
      sourceUrl: v.sourceUrl ?? null,
      sourcePlatform: v.sourcePlatform,
      jdText: v.jdText,
    },
  });
  await emitEvent({
    type: EventType.JOB_DISCOVERED,
    candidateId: ctx.candidateId,
    payload: {
      opportunityId: opportunity.id,
      source: v.sourcePlatform,
      title: v.title,
      company: v.company,
    },
    emittedBy: "user",
  });

  revalidatePath("/opportunities");
  return { ok: true, value: opportunity };
}

export async function shortlistOpportunityAction(
  opportunityId: string,
): Promise<ActionResult<{ opportunityId: string }>> {
  const ctx = await requireCandidateId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true },
  });
  if (!opportunity) return { ok: false, error: "Opportunity not found" };

  await emitEvent({
    type: EventType.JOB_SHORTLISTED,
    candidateId: ctx.candidateId,
    payload: { opportunityId },
    emittedBy: "user",
  });

  // Drive the application-creator worker synchronously so the user sees the
  // Application on the next page render — no waiting for the cron loop.
  try {
    await dispatchOnce();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create application",
    };
  }

  revalidatePath("/opportunities");
  revalidatePath("/applications");
  return { ok: true, value: { opportunityId } };
}

export async function dismissOpportunityAction(
  opportunityId: string,
): Promise<ActionResult<{ opportunityId: string }>> {
  const ctx = await requireCandidateId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { dismissed: true },
  });
  await emitEvent({
    type: EventType.JOB_DISMISSED,
    candidateId: ctx.candidateId,
    payload: { opportunityId },
    emittedBy: "user",
  });

  revalidatePath("/opportunities");
  return { ok: true, value: { opportunityId } };
}
