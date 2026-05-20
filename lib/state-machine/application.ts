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

function buildUpdateData(nextState: ApplicationState): Prisma.ApplicationUpdateInput {
  const data: Prisma.ApplicationUpdateInput = { state: nextState };
  const now = new Date();
  switch (nextState) {
    case ApplicationState.SHORTLISTED:
      data.shortlistedAt = now;
      break;
    case ApplicationState.SUBMITTED:
      data.submittedAt = now;
      break;
    case ApplicationState.REJECTED:
      data.rejectedAt = now;
      break;
    case ApplicationState.ACCEPTED:
      data.acceptedAt = now;
      break;
    case ApplicationState.ARCHIVED:
      data.archivedAt = now;
      break;
  }
  return data;
}

export async function transition(
  applicationId: string,
  nextState: ApplicationState,
  context: TransitionContext,
): Promise<Application> {
  const current = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });

  if (!canTransition(current.state, nextState)) {
    throw new InvalidTransitionError(current.state, nextState);
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: buildUpdateData(nextState),
  });

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
