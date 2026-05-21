import { ApplicationState, type Application, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { InvalidTransitionError } from "./errors";
import { TRANSITIONS, canTransition } from "./transitions-table";

export { ApplicationState, TRANSITIONS, canTransition };

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
