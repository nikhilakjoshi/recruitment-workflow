"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
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
