import { EventConsumptionStatus, type Event } from "@prisma/client";
import { prisma } from "@/lib/db";
import { listWorkers } from "./registry";
import type { GovernanceConstraints, ScopedMemory, Worker, WorkerContext } from "./types";

const DEFAULT_TIMEOUT_MS = 50_000;
const BATCH_SIZE = 50;

export type DispatchSummary = {
  processed: number;
  errors: number;
};

async function buildContext(worker: Worker, event: Event): Promise<WorkerContext> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: event.candidateId },
  });
  const application = event.applicationId
    ? await prisma.application.findUnique({ where: { id: event.applicationId } })
    : null;

  const scopedMemory: ScopedMemory = { candidate, application, event };
  const governance: GovernanceConstraints = {
    approvalRequired: worker.approvalRequired ?? false,
  };

  return {
    event,
    candidate,
    application,
    scopedMemory,
    governance,
    input: event.payloadJson,
  };
}

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

async function pendingEventsForWorker(worker: Worker): Promise<Event[]> {
  if (!worker.subscribes || worker.subscribes.length === 0) return [];
  const consumed = await prisma.eventConsumption.findMany({
    where: { workerName: worker.name },
    select: { eventId: true },
  });
  const consumedIds = consumed.map((c) => c.eventId);
  return prisma.event.findMany({
    where: {
      type: { in: worker.subscribes },
      id: { notIn: consumedIds.length > 0 ? consumedIds : undefined },
    },
    orderBy: { emittedAt: "asc" },
    take: BATCH_SIZE,
  });
}

export async function dispatchOnce(): Promise<DispatchSummary> {
  const workers = listWorkers().filter((w) => w.subscribes && w.subscribes.length > 0);
  let processed = 0;
  let errors = 0;

  for (const worker of workers) {
    const pending = await pendingEventsForWorker(worker);
    for (const event of pending) {
      const startedAt = Date.now();
      let status: EventConsumptionStatus = EventConsumptionStatus.SUCCEEDED;
      let errorMessage: string | null = null;
      try {
        const ctx = await buildContext(worker, event);
        await withTimeout(worker.run(ctx), worker.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        processed += 1;
      } catch (err) {
        status = EventConsumptionStatus.FAILED;
        errorMessage = err instanceof Error ? err.message : String(err);
        errors += 1;
      }
      const durationMs = Date.now() - startedAt;
      try {
        await prisma.eventConsumption.create({
          data: {
            eventId: event.id,
            workerName: worker.name,
            status,
            errorMessage,
            durationMs,
          },
        });
      } catch (writeErr) {
        // Unique constraint race: another dispatcher already recorded — skip.
        if (!isUniqueViolation(writeErr)) throw writeErr;
      }
    }
  }

  return { processed, errors };
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === "P2002";
}
