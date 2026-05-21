"use server";

import { revalidatePath } from "next/cache";
import { ApplicationState } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { transition } from "@/lib/state-machine/application";
import { InvalidTransitionError } from "@/lib/state-machine/errors";
import {
  approveArtifact,
  editArtifact,
  rejectArtifact,
  requireReview,
} from "@/lib/artifacts/transitions";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function requireOwner(applicationId: string): Promise<
  | { candidateId: string; applicationId: string }
  | { error: string; status?: number }
> {
  const session = await getSession();
  if (!session.userId) return { error: "Unauthorized" };
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, candidateId: true, candidate: { select: { userId: true } } },
  });
  if (!app || app.candidate.userId !== session.userId) {
    return { error: "Application not found" };
  }
  return { candidateId: app.candidateId, applicationId: app.id };
}

export async function transitionApplicationAction(
  applicationId: string,
  next: ApplicationState,
): Promise<ActionResult<{ state: ApplicationState }>> {
  const ctx = await requireOwner(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

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
  const ctx = await requireOwner(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
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
  const ctx = await requireOwner(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  try {
    await rejectArtifact({ artifactId, actor: "user", reason });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reject failed" };
  }
}

export async function editArtifactAction(
  artifactId: string,
  applicationId: string,
  contentText: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ctx = await requireOwner(applicationId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  try {
    const next = await editArtifact({ artifactId, actor: "user", contentText });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId: next.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Edit failed" };
  }
}
