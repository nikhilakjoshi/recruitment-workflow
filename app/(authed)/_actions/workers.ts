"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { dispatchOnce } from "@/lib/workers/dispatch";
import { runScheduledWorker } from "@/lib/workers/run-scheduled";
import { runNarrativeThemeExtractor } from "@/lib/workers/narrative-theme-extractor";
import "@/lib/workers";

export type DispatchActionResult =
  | { ok: true; processed: number; errors: number }
  | { ok: false; error: string };

export async function dispatchEventsAction(): Promise<DispatchActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };

  try {
    const summary = await dispatchOnce();
    revalidatePath("/");
    return { ok: true, processed: summary.processed, errors: summary.errors };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type ScheduledWorkerActionResult =
  | { ok: true; workerName: string; durationMs: number }
  | { ok: false; error: string };

const ALLOWED_SCHEDULED_WORKERS = new Set([
  "application-tracker",
  "weekly-digest",
  "narrative-theme-extractor",
]);

export async function triggerScheduledWorkerAction(
  workerName: string,
): Promise<ScheduledWorkerActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };
  if (!ALLOWED_SCHEDULED_WORKERS.has(workerName)) {
    return { ok: false, error: `Worker not allowed for manual trigger: ${workerName}` };
  }

  const startedAt = Date.now();
  try {
    if (workerName === "narrative-theme-extractor") {
      await runNarrativeThemeExtractor();
      revalidatePath("/");
      return { ok: true, workerName, durationMs: Date.now() - startedAt };
    }
    const result = await runScheduledWorker(workerName);
    revalidatePath("/");
    if (result.ok) {
      return { ok: true, workerName: result.workerName, durationMs: result.durationMs };
    }
    return { ok: false, error: result.error ?? "Unknown error" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type ClearWorkspaceResult =
  | { ok: true; deletedApplications: number; deletedOpportunities: number; clearedMasterCv: boolean }
  | { ok: false; error: string };

export async function clearWorkspaceAction(): Promise<ClearWorkspaceResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };

  try {
    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: { userId: session.userId },
      select: { id: true },
    });

    const [applications, opportunities, mcv] = await prisma.$transaction([
      prisma.application.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.opportunity.deleteMany({}),
      prisma.masterCV.deleteMany({ where: { candidateId: candidate.id } }),
    ]);

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/applications");
    revalidatePath("/opportunities");
    return {
      ok: true,
      deletedApplications: applications.count,
      deletedOpportunities: opportunities.count,
      clearedMasterCv: mcv.count > 0,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
