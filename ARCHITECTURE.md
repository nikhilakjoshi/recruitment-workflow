# Career OS — Technical Architecture (Directional, v1)

This is a **directional** technical architecture. Detailed runtime / infra / SLA decisions are explicitly **parked** until the product takes shape (per `README.md` open questions).

The goal of this doc is to lock in choices that would be **expensive to reverse** while leaving room to defer scale/concurrency/budget decisions.

Audience: solo builder (me). Single-tenant. Single environment to start.

---

## 1. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | Full-stack React, file-based routing, server components, Vercel-native |
| Runtime | Fluid Compute on Vercel | Node 24 LTS, 300s default timeout, shared instances reduce cold starts |
| Language | TypeScript everywhere | Type safety across schema, workers, UI |
| Structured data | Postgres (via Vercel Marketplace — Neon or Supabase) | Relational anchor for Candidate, Application, Artifact, Event, Recruiter, Interview |
| ORM | Prisma | Schema-first, migrations, good DX |
| Object storage | Vercel Blob (private) | Master CV files, generated PDF artifacts |
| Event bus | Vercel Queues (beta) or DB-backed event table | Durable events; start with DB table, migrate to Queues when needed |
| Background jobs | Vercel Cron (scheduled) + Queues (event-driven) | Cron for always-on workers, Queues for per-app / per-interview workers |
| LLM access | Vercel AI Gateway (`provider/model` strings) | Unified API, observability, fallbacks, no provider lock-in |
| Default model | `anthropic/claude-sonnet-4-6` | Cost/quality balance for most workers |
| Heavy generation model | `anthropic/claude-opus-4-7` | Tailored Resume Builder, Cover Letter Generator |
| Cheap model | `anthropic/claude-haiku-4-5` | Job ranking, classification, summaries |
| Vector / semantic | pgvector extension in Postgres | Avoid second datastore in v1; co-locate with relational data |
| Auth | Single-user magic link or Sign in with Vercel | Solo user, no need for user management complexity |
| UI | shadcn/ui + Tailwind | Production-grade primitives, fast iteration |
| Email ingest (future) | Inbound webhook (Postmark or similar) | Recruiter reply detection |
| Deployment | Vercel | Native fit with everything above |
| Config | `vercel.ts` | TypeScript config, dynamic logic, env access |

---

## 2. Why these choices match the product semantics

The `PRODUCT.md` defines five architectural primitives:

1. **Persistent memory** → Postgres + pgvector + Blob. Structured tables for canonical entities, vector embeddings for semantic retrieval, Blob for binary artifacts.
2. **Application-centered orchestration** → every event row carries an `application_id` foreign key. Application is a first-class table.
3. **Event-driven cognition** → durable `events` table → workers consume via Queues. Workers never call each other directly.
4. **Approval-governed automation** → `approval_state` enum on artifacts; every outbound action has an explicit `pending_review` step before any externally visible operation.
5. **Scoped worker runtimes** → each worker is a typed function that receives a `WorkerContext` (event + scoped memory + governance constraints) and returns typed outputs.

---

## 3. Data layer (v1 conceptual schema)

Detailed Prisma schema lives in code (forthcoming). Conceptual entities:

### Core entities
- `Candidate` — single row in v1 (me)
- `MasterCV` — structured fields + Blob reference to source PDF
- `RolePreference` — target roles, industries, comp, geo, work auth
- `Opportunity` — discovered/manual jobs, ranked, with JD text + source
- `Application` — **the operational anchor**, references `Opportunity`, owns lifecycle state
- `Artifact` — versioned, lineage-aware, scoped to an Application (resume, cover letter, prep doc, recruiter reply, thank-you draft, STAR set)
- `Recruiter` — external entity, linked to Applications
- `Interview` — child of Application, owns prep materials, notes, outcome
- `Event` — durable event log, append-only, the source of truth for orchestration
- `Insight` — derived intelligence, attached to Candidate or Application

### Memory tables
- `interaction_memory` — behavioral patterns (rejected suggestions, preferred tone, edits)
- `embeddings` — pgvector column on resume content, JD content, recruiter messages, STAR stories
- `derived_memory` — periodically materialized AI insights

### Key invariants
- An Application has exactly one Opportunity.
- An Artifact belongs to exactly one Application (except canonical Master CV / LinkedIn summary, which live at Candidate scope).
- An Event is immutable once written.
- Application state transitions only via state machine functions (no raw UPDATEs in workers).
- Artifacts in `approved` state are immutable; edits create a new version with lineage.

---

## 4. Event architecture

### Event flow

```
[trigger] → [event row inserted] → [queue dispatcher] → [worker(s) subscribe]
                                                       ↓
                                            [scoped retrieval]
                                                       ↓
                                            [cognitive execution]
                                                       ↓
                                  [output artifact + new events + state transition]
                                                       ↓
                                            [approval gate if outbound]
```

### Event row shape (conceptual)

```ts
type Event = {
  id: string
  type: EventType          // e.g. "JobDiscovered", "RecruiterReplyDetected"
  application_id?: string  // most events attach to an Application
  candidate_id: string     // always
  payload: Json
  emitted_by: 'system' | 'user' | WorkerName
  emitted_at: Date
  consumed_by: WorkerName[] // observability, not gating
}
```

### Worker subscription model
Workers declare event interests as a static contract. The dispatcher reads the contract and routes events. Workers never poll.

### Why DB-backed events first
Vercel Queues is in beta. A simple `events` table + cron dispatcher gives durability, full history, easy replay, and migration path. When throughput justifies it, swap dispatcher for Queues — workers don't change.

---

## 5. Worker runtime

### Worker interface (conceptual)

```ts
interface Worker<TInput, TOutput> {
  name: WorkerName
  subscribes: EventType[]
  scope: 'always-on' | 'per-application' | 'per-interview' | 'longitudinal'
  model: ModelChoice           // routed via AI Gateway
  run(ctx: WorkerContext<TInput>): Promise<WorkerResult<TOutput>>
}

interface WorkerContext<T> {
  event: Event
  candidate: Candidate
  application?: Application      // present for per-app / per-interview workers
  scopedMemory: ScopedMemory     // resolved by orchestrator before invocation
  governance: GovernanceConstraints
  input: T
}

interface WorkerResult<T> {
  artifact?: Artifact            // versioned, approval-gated if outbound
  events: EventEmission[]        // follow-up events
  stateTransition?: StateChange  // application lifecycle change
  notifications?: Notification[]
}
```

### Worker categories → runtime mapping

| Category | Trigger | Vercel mechanism |
|---|---|---|
| Always-on (Job Alert, LinkedIn Optimizer, Application Tracker) | Schedule | Vercel Cron |
| Per-application (Match Scorer, Resume Builder, Cover Letter Generator) | Application events | Queue / direct invocation |
| Per-interview (Company Research, Interview Prep) | Recruiter events | Queue / direct invocation |
| Longitudinal (future) | Nightly cron | Vercel Cron |

### Memory scoping
The orchestrator resolves `ScopedMemory` **before** invoking the worker. Workers never make raw queries against the candidate's full memory. The orchestrator decides what's relevant based on the worker's declared scope.

This is non-negotiable. It's the only way to keep prompt costs bounded, retrieval explainable, and workers replaceable.

---

## 6. Approval gate

Approval is a system primitive, not UI logic.

### Lifecycle
```
draft → pending_review → (approved | rejected | regenerated) → submitted/used → archived
```

### Enforcement
- Database constraint: no outbound action without `approved` artifact + explicit `approvals` row
- Worker output of type "outbound artifact" always lands in `pending_review`
- `submission` endpoints (future: send email, post to LinkedIn) check approval state on the way out

### Outbound boundaries v1
- All currently outbound actions are user-initiated: I copy/paste the approved artifact into the actual job-board form, the actual recruiter reply, the actual LinkedIn edit.
- No worker has authority to communicate externally in v1.
- Email send / auto-submit deferred until trust + product are proven.

---

## 7. AI Gateway routing

Default to `provider/model` strings via Vercel AI Gateway. Do not install provider-specific SDKs.

### Default routing
| Worker | Model | Notes |
|---|---|---|
| Job Alert Aggregator (ranking) | `anthropic/claude-haiku-4-5` | Cheap classification |
| Resume Match Scorer | `anthropic/claude-sonnet-4-6` | Quality + cost balance |
| Tailored Resume Builder | `anthropic/claude-opus-4-7` | Highest-stakes generation |
| Cover Letter Generator | `anthropic/claude-opus-4-7` | Same |
| Company Research Assistant | `anthropic/claude-sonnet-4-6` + web access | Needs current info |
| Interview Prep Assistant | `anthropic/claude-sonnet-4-6` | |
| Application Tracker | `anthropic/claude-haiku-4-5` | Summarization only |
| LinkedIn Optimizer | `anthropic/claude-sonnet-4-6` | |

Model choice is per-worker config, easy to change. Prompt caching enabled where applicable (Master CV, role preferences are cache-friendly because they're stable across many invocations).

---

## 8. Storage strategy

### Postgres (relational + vector)
Everything structured + embeddings. Single datastore minimizes ops overhead for solo build.

### Vercel Blob (private)
- Source Master CV PDF
- Generated resume / cover letter PDFs (after approval)
- Any user-uploaded supporting docs

### Naming
- All Blob refs stored as foreign keys on the relevant entity row.
- Never store binary data in Postgres rows.

---

## 9. Frontend architecture

### Routes (conceptual)
- `/` → Dashboard
- `/opportunities` → discovered + shortlisted
- `/applications` → active applications list
- `/applications/[id]` → Application workspace (the operational center)
- `/applications/[id]/interviews/[interviewId]` → Interview workspace
- `/artifacts` → cross-application artifact library
- `/insights` → longitudinal intelligence (stub in v1)
- `/profile` → candidate memory + preferences

### Server components by default
- Lists, dashboards, detail pages are server components reading directly from Postgres.
- Client components only where interactivity matters (artifact editor, approval gate UI, real-time event feed).

### Approval UX
A single reusable `<ApprovalGate>` component handles every outbound artifact. Actions: approve, reject, edit, regenerate, compare versions.

---

## 10. Observability

Solo-builder pragmatic stack:
- Vercel logs for runtime
- AI Gateway dashboard for LLM spend + errors
- Postgres slow query log
- A simple in-app `Activity` view showing the event log (because it's the source of truth anyway)

No Datadog / Sentry / OTel in v1. Add when something breaks that the above can't explain.

---

## 11. Security / privacy

Single-tenant, single-user, but still:
- Master CV + generated artifacts contain personal data — keep all Blob refs private
- Recruiter messages contain third-party PII — same
- No telemetry of artifact content to external services beyond LLM calls (and those go through Gateway with zero data retention)
- Approval gate prevents accidental outbound to wrong recipient

---

## 12. What's explicitly parked

These will be decided once the product is shipped and in use. They're called out so they don't surprise me later:

- **Scale / concurrency / LLM budget** — current architecture is single-user, low-concurrency. If I open this up to other users later, revisit Queues, sharding, rate limits, budget gates.
- **Multi-tenancy** — no tenant boundary in schema yet. If needed later, add `tenant_id` to every table; not retrofitted now.
- **Detailed retry / replay semantics** — basic retry on worker failure, observability via event log. Sophisticated retry policies parked.
- **Mobile** — desktop-first. Mobile responsive eventually, mobile-native deferred.
- **Auto-submit / auto-send** — explicitly out of v1 scope. All outbound is human-mediated.

---

## 13. Reversibility of choices

Easy to change later:
- Worker model selection (per-worker config)
- Specific LLM provider (Gateway abstracts)
- UI component choices

Painful to change later (so chosen with care):
- Postgres as primary store
- Event-sourced state model
- Application-as-anchor schema
- Approval gate at the persistence layer (not just UI)

Anything in the second list is justified by the product semantics in `PRODUCT.md`. Anything in the first list is a tactical pick that can flex.
