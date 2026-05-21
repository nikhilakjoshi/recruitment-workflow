import type { Application, Candidate, Event, EventType } from "@prisma/client";
import type { ModelChoice } from "@/lib/ai/models";

export type WorkerName = string;

export type ScopedMemory = {
  candidate: Candidate;
  application: Application | null;
  event: Event;
};

export type GovernanceConstraints = {
  approvalRequired: boolean;
};

export type WorkerContext<TInput = unknown> = {
  event: Event;
  candidate: Candidate;
  application: Application | null;
  scopedMemory: ScopedMemory;
  governance: GovernanceConstraints;
  input: TInput;
};

export type EventEmission = {
  type: EventType;
  applicationId?: string | null;
  payload: Record<string, unknown>;
};

export type StateChange = {
  applicationId: string;
  to: import("@prisma/client").ApplicationState;
};

export type WorkerNotification = {
  channel: "dashboard" | "email";
  message: string;
};

export type WorkerResult<TOutput = unknown> = {
  output: TOutput;
  events?: EventEmission[];
  stateTransition?: StateChange;
  notifications?: WorkerNotification[];
};

export type WorkerScope = "always-on" | "per-application" | "per-interview" | "longitudinal";

export type Worker<TInput = unknown, TOutput = unknown> = {
  name: WorkerName;
  subscribes?: EventType[];
  schedule?: string;
  scope: WorkerScope;
  model: ModelChoice;
  approvalRequired?: boolean;
  timeoutMs?: number;
  run(ctx: WorkerContext<TInput>): Promise<WorkerResult<TOutput>>;
};
