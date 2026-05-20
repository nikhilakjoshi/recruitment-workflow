import { ApplicationState, type Application, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { InvalidTransitionError } from "./errors";

export { ApplicationState };

export const TRANSITIONS: Readonly<Record<ApplicationState, ReadonlyArray<ApplicationState>>> = {
  [ApplicationState.DISCOVERED]: [ApplicationState.SHORTLISTED, ApplicationState.ARCHIVED],
  [ApplicationState.SHORTLISTED]: [ApplicationState.EVALUATED, ApplicationState.ARCHIVED],
  [ApplicationState.EVALUATED]: [ApplicationState.TAILORING, ApplicationState.ARCHIVED],
  [ApplicationState.TAILORING]: [ApplicationState.APPROVED, ApplicationState.ARCHIVED],
  [ApplicationState.APPROVED]: [ApplicationState.SUBMITTED, ApplicationState.ARCHIVED],
  [ApplicationState.SUBMITTED]: [
    ApplicationState.RECRUITER_ENGAGED,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.RECRUITER_ENGAGED]: [
    ApplicationState.INTERVIEWING,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.INTERVIEWING]: [
    ApplicationState.NEGOTIATING,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.NEGOTIATING]: [
    ApplicationState.ACCEPTED,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.REJECTED]: [ApplicationState.ARCHIVED],
  [ApplicationState.ACCEPTED]: [ApplicationState.ARCHIVED],
  [ApplicationState.ARCHIVED]: [],
};

export function canTransition(from: ApplicationState, to: ApplicationState): boolean {
  return TRANSITIONS[from].includes(to);
}

type TransitionContext = {
  actor: "system" | "user" | string;
  reason?: string;
};

const TIMESTAMP_COLUMN: Partial<Record<ApplicationState, keyof Application>> = {
  [ApplicationState.SHORTLISTED]: "shortlistedAt",
  [ApplicationState.SUBMITTED]: "submittedAt",
  [ApplicationState.REJECTED]: "rejectedAt",
  [ApplicationState.ACCEPTED]: "acceptedAt",
  [ApplicationState.ARCHIVED]: "archivedAt",
};

export async function transition(
  applicationId: string,
  nextState: ApplicationState,
  context: TransitionContext,
): Promise<Application> {
  const current = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });

  if (!canTransition(current.state, nextState)) {
    throw new InvalidTransitionError(current.state, nextState);
  }

  const data: Prisma.ApplicationUpdateInput = { state: nextState };
  const timestampField = TIMESTAMP_COLUMN[nextState];
  if (timestampField) {
    (data as Record<string, unknown>)[timestampField] = new Date();
  }

  const updated = await prisma.application.update({ where: { id: applicationId }, data });

  await emitEvent({
    type: "APPLICATION_STATE_CHANGED",
    candidateId: updated.candidateId,
    applicationId: updated.id,
    payload: {
      from: current.state,
      to: nextState,
      actor: context.actor,
      reason: context.reason ?? null,
    },
    emittedBy: context.actor,
  });

  return updated;
}
