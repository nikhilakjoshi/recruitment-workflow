"use server";

import { revalidatePath } from "next/cache";
import { ApplicationState, EventType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { transition } from "@/lib/state-machine/application";
import { InvalidTransitionError } from "@/lib/state-machine/errors";
import {
  approveArtifact,
  editArtifact,
  rejectArtifact,
  requireReview,
} from "@/lib/artifacts/transitions";
import { dispatchOnce } from "@/lib/workers/dispatch";
import "@/lib/workers";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function requireOwner(applicationId: string): Promise<string | null> {
  const session = await getSession();
  if (!session.userId) return "Unauthorized";
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidate: { select: { userId: true } } },
  });
  if (!app || app.candidate.userId !== session.userId) {
    return "Application not found";
  }
  return null;
}

export async function transitionApplicationAction(
  applicationId: string,
  next: ApplicationState,
): Promise<ActionResult<{ state: ApplicationState }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };

  try {
    const updated = await transition(applicationId, next, { actor: "user" });
    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/applications");
    return { ok: true, value: { state: updated.state } };
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Transition failed" };
  }
}

export async function requireReviewAction(
  artifactId: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };
  try {
    await requireReview({ artifactId, actor: "user" });
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function approveArtifactAction(
  artifactId: string,
  applicationId: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  try {
    await approveArtifact({ artifactId, actor: "user" });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Approve failed" };
  }
}

export async function rejectArtifactAction(
  artifactId: string,
  applicationId: string,
  reason?: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  try {
    await rejectArtifact({ artifactId, actor: "user", reason });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reject failed" };
  }
}

export async function regenerateEvaluationAction(
  applicationId: string,
): Promise<ActionResult<{ requested: true }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  await emitEvent({
    type: EventType.EVALUATION_REGENERATION_REQUESTED,
    candidateId: app.candidateId,
    applicationId,
    payload: { reason: "manual" },
    emittedBy: "user",
  });
  await dispatchOnce();
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, value: { requested: true } };
}

export async function editArtifactAction(
  artifactId: string,
  applicationId: string,
  contentText: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  try {
    const next = await editArtifact({ artifactId, actor: "user", contentText });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId: next.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Edit failed" };
  }
}
