import { prisma } from "@/lib/db";
import { resolveScopedMemory } from "./scoped-memory";
import { getScheduledWorker } from "./registry";
import { EMPTY_SCOPE, type ScheduledWorker, type ScheduledWorkerContext } from "./types";

const DEFAULT_TIMEOUT_MS = 50_000;
const DEFAULT_TOKEN_BUDGET = 30_000;

export type ScheduledRunResult = {
  ok: boolean;
  workerName: string;
  durationMs: number;
  error?: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Worker timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function buildContext(worker: ScheduledWorker): Promise<ScheduledWorkerContext> {
  // Single-tenant: the candidate is the most-recently-updated row. If there
  // isn't one yet, the worker can't meaningfully run.
  const candidate = await prisma.candidate.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!candidate) {
    throw new Error("No Candidate exists — scheduled worker cannot run");
  }

  const scope = worker.scope ?? EMPTY_SCOPE;
  const scopedMemory = await resolveScopedMemory(
    scope,
    // Synthesize a minimal event-shaped object so resolveScopedMemory can
    // address the candidate without us needing a real triggering event.
    { id: "", candidateId: candidate.id, applicationId: null } as unknown as Parameters<
      typeof resolveScopedMemory
    >[1],
    { maxTokens: DEFAULT_TOKEN_BUDGET },
  );

  return {
    candidate,
    scopedMemory,
    runAt: new Date(),
  };
}

export async function runScheduledWorker(name: string): Promise<ScheduledRunResult> {
  const worker = getScheduledWorker(name);
  if (!worker) {
    return { ok: false, workerName: name, durationMs: 0, error: "not_found" };
  }

  const startedAt = Date.now();
  try {
    const ctx = await buildContext(worker);
    await withTimeout(worker.run(ctx), worker.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return { ok: true, workerName: name, durationMs: Date.now() - startedAt };
  } catch (err) {
    return {
      ok: false,
      workerName: name,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
