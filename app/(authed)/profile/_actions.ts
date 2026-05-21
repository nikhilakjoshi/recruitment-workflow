"use server";

import { revalidatePath } from "next/cache";
import { EventType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { dispatchOnce } from "@/lib/workers/dispatch";
import "@/lib/workers";
import {
  rolePreferenceSchema,
  type RolePreferenceInput,
} from "@/lib/schemas/role-preference";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export async function saveRolePreferenceAction(
  input: RolePreferenceInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };

  const parsed = rolePreferenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId },
    select: { id: true },
  });

  const data = parsed.data;
  const saved = await prisma.rolePreference.upsert({
    where: { candidateId: candidate.id },
    create: { candidateId: candidate.id, ...data },
    update: data,
    select: { id: true },
  });

  await emitEvent({
    type: "CANDIDATE_PROFILE_UPDATED",
    candidateId: candidate.id,
    payload: { rolePreferenceId: saved.id, actor: "user" },
    emittedBy: "user",
  });

  revalidatePath("/profile");
  revalidatePath("/", "layout");

  return { ok: true, value: saved };
}

const LINKEDIN_MIN_LEN = 50;
const LINKEDIN_MAX_LEN = 20_000;

export async function requestLinkedinOptimizationAction(
  linkedinText: string,
): Promise<ActionResult<{ eventId: string }>> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };

  const text = (linkedinText ?? "").trim();
  if (text.length < LINKEDIN_MIN_LEN) {
    return {
      ok: false,
      error: `Paste at least ${LINKEDIN_MIN_LEN} characters of LinkedIn content`,
    };
  }
  if (text.length > LINKEDIN_MAX_LEN) {
    return {
      ok: false,
      error: `LinkedIn paste is too large (max ${LINKEDIN_MAX_LEN} chars)`,
    };
  }

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId },
    select: { id: true, masterCV: { select: { id: true } } },
  });
  if (!candidate.masterCV) {
    return {
      ok: false,
      error: "Upload a Master CV first — the optimizer grounds suggestions in it",
    };
  }

  const event = await emitEvent({
    type: EventType.LINKEDIN_OPTIMIZATION_REQUESTED,
    candidateId: candidate.id,
    payload: { linkedinText: text },
    emittedBy: "user",
  });
  await dispatchOnce();
  revalidatePath("/profile");
  revalidatePath("/artifacts");
  return { ok: true, value: { eventId: event.id } };
}
