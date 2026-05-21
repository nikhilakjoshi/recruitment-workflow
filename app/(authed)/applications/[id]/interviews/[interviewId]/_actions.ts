"use server";

import { revalidatePath } from "next/cache";
import {
  ApplicationState,
  EventType,
  type Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { transition } from "@/lib/state-machine/application";
import { canTransition } from "@/lib/state-machine/transitions-table";
import { InvalidTransitionError } from "@/lib/state-machine/errors";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const INTERVIEW_OUTCOMES = [
  "STRONG_YES",
  "WEAK_YES",
  "MAYBE",
  "WEAK_NO",
  "STRONG_NO",
  "WITHDREW",
] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

async function requireOwner(
  interviewId: string,
): Promise<
  | { ok: true; candidateId: string; applicationId: string }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };
  const iv = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: {
      applicationId: true,
      application: { select: { candidateId: true, candidate: { select: { userId: true } } } },
    },
  });
  if (!iv || iv.application.candidate.userId !== session.userId) {
    return { ok: false, error: "Interview not found" };
  }
  return {
    ok: true,
    candidateId: iv.application.candidateId,
    applicationId: iv.applicationId,
  };
}

export async function saveInterviewNotesAction(
  interviewId: string,
  notes: string,
): Promise<ActionResult<{ savedAt: string }>> {
  const owner = await requireOwner(interviewId);
  if (!owner.ok) return owner;
  await prisma.interview.update({
    where: { id: interviewId },
    data: { sessionNotes: notes },
  });
  return { ok: true, value: { savedAt: new Date().toISOString() } };
}

export type LogOutcomeInput = {
  outcome: InterviewOutcome;
  reflection?: string;
  rejectApplication?: boolean;
};

export async function logInterviewOutcomeAction(
  interviewId: string,
  input: LogOutcomeInput,
): Promise<
  ActionResult<{
    interviewId: string;
    applicationRejected: boolean;
  }>
> {
  const owner = await requireOwner(interviewId);
  if (!owner.ok) return owner;
  if (!INTERVIEW_OUTCOMES.includes(input.outcome)) {
    return { ok: false, error: "Invalid outcome" };
  }

  const outcomeJson: Prisma.InputJsonValue = {
    outcome: input.outcome,
    reflection: input.reflection ?? "",
    recordedAt: new Date().toISOString(),
  };
  await prisma.interview.update({
    where: { id: interviewId },
    data: { outcomeJson },
  });

  await emitEvent({
    type: EventType.INTERVIEW_COMPLETED,
    candidateId: owner.candidateId,
    applicationId: owner.applicationId,
    payload: {
      interviewId,
      outcome: input.outcome,
    },
    emittedBy: "user",
  });

  let applicationRejected = false;
  if (input.rejectApplication) {
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: owner.applicationId },
      select: { state: true },
    });
    if (canTransition(app.state, ApplicationState.REJECTED)) {
      try {
        await transition(owner.applicationId, ApplicationState.REJECTED, {
          actor: "user",
          reason: `Interview outcome ${input.outcome}`,
        });
        applicationRejected = true;
      } catch (err) {
        if (!(err instanceof InvalidTransitionError)) throw err;
      }
    }
  }

  revalidatePath(`/applications/${owner.applicationId}/interviews/${interviewId}`);
  revalidatePath(`/applications/${owner.applicationId}`);
  return {
    ok: true,
    value: { interviewId, applicationRejected },
  };
}
