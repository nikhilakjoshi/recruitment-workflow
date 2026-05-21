import type {
  Application,
  Artifact,
  ArtifactType,
  Candidate,
  Event,
  EventType,
  MasterCV,
  Opportunity,
  RolePreference,
} from "@prisma/client";
import type { ModelChoice } from "@/lib/ai/models";

export type WorkerName = string;

// Per-worker declaration of what the orchestrator should fetch into
// scoped memory before the worker runs. Workers never query the candidate's
// full memory; they declare what they need.
export type WorkerScope = {
  candidate: {
    masterCV: boolean;
    rolePreference: boolean;
  };
  application?: {
    opportunity: boolean;
    artifacts?: { types: ArtifactType[]; latestVersionsOnly: boolean };
    recentEvents?: { limit: number };
  };
};

export type ScopedCandidate = Candidate & {
  masterCV?: MasterCV | null;
  rolePreference?: RolePreference | null;
};

export type ScopedApplication = Application & {
  opportunity?: Opportunity;
  artifacts?: Artifact[];
  events?: Event[];
};

export type ScopedMemory = {
  candidate?: ScopedCandidate;
  application?: ScopedApplication;
  tokenBudgetUsed: number;
  excludedReasons: string[];
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

// Runtime classification governs how the dispatcher schedules the worker
// (cron-driven, event-driven per-app, etc.).
export type WorkerRuntime =
  | "always-on"
  | "per-application"
  | "per-interview"
  | "longitudinal";

export type Worker<TInput = unknown, TOutput = unknown> = {
  name: WorkerName;
  subscribes?: EventType[];
  schedule?: string;
  runtime: WorkerRuntime;
  scope: WorkerScope;
  model: ModelChoice;
  approvalRequired?: boolean;
  timeoutMs?: number;
  run(ctx: WorkerContext<TInput>): Promise<WorkerResult<TOutput>>;
};

export const EMPTY_SCOPE: WorkerScope = {
  candidate: { masterCV: false, rolePreference: false },
};
