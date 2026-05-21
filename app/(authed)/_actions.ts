"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { acknowledgeFollowUp } from "@/lib/follow-ups/acknowledge";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function requireOwnedFollowUp(followUpId: string): Promise<string | null> {
  const session = await getSession();
  if (!session.userId) return "Unauthorized";
  const fu = await prisma.followUp.findUnique({
    where: { id: followUpId },
    include: { application: { select: { candidate: { select: { userId: true } } } } },
  });
  if (!fu) return "Follow-up not found";
  if (fu.application.candidate.userId !== session.userId) return "Forbidden";
  return null;
}

export async function acknowledgeFollowUpAction(
  followUpId: string,
): Promise<ActionResult<{ followUpId: string }>> {
  const err = await requireOwnedFollowUp(followUpId);
  if (err) return { ok: false, error: err };
  await acknowledgeFollowUp(followUpId);
  revalidatePath("/");
  return { ok: true, value: { followUpId } };
}
