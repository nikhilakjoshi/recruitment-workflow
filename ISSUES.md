# Career OS — Issue Backlog

Source-of-truth list of every issue to be created on GitHub before any code is written.

## Conventions

### Issue body template (paste verbatim into `gh issue create`)

```
## Goal
<one sentence>

## Acceptance criteria
- [ ] <criterion>
- [ ] <criterion>

## Reference docs
- PRODUCT.md §<n> "<section>"
- ARCHITECTURE.md §<n> "<section>"
- ROADMAP.md slice <n>

## Plan
<for sandcastle issues>
See `plans/slice-<n>-<slug>/<issue-slug>.md` for full context.

## Touchpoints
- <expected files / modules>

## Out of scope
- <explicit exclusions>
```

### Labels

**Routing (mutually exclusive):**
- `sandcastle` — eligible for Sandcastle pickup. Must have a plan file.
- `manual` — I do it directly. No plan file required.

**Slice (one per issue):**
- `slice-0-foundation`
- `slice-1-manual-flow`
- `slice-2-match-scorer`
- `slice-3-resume-builder`
- `slice-4-cover-letter`
- `slice-5-tracker`
- `slice-6-aggregator`
- `slice-7-interview`
- `slice-8-linkedin`
- `slice-9-insights`

**Area (zero or more):**
- `area:schema`, `area:event-bus`, `area:worker`, `area:ui`, `area:approval-gate`, `area:auth`, `area:integration`, `area:infra`, `area:docs`

**Lifecycle (Sandcastle owns these — created automatically):**
- `sandcastle:planned`, `sandcastle:in-progress`, `sandcastle:review`, `sandcastle:done`

### Plan file pattern (for `sandcastle`-labelled issues)

Each plan file lives at `plans/slice-<n>-<slice-slug>/<issue-slug>.md` and includes:

1. **Context** — paste the relevant sections of `PRODUCT.md` and `ARCHITECTURE.md` inline so the agent doesn't have to navigate.
2. **Goal** — restated from the issue.
3. **Detailed acceptance criteria** — more specific than the issue's.
4. **Files to create / modify** — explicit list with intended responsibilities.
5. **Type signatures / schema fragments** — if known.
6. **Test expectations** — what a "done" PR should include.
7. **Out of scope** — explicit guardrails.
8. **Open questions** — things the agent should ask in the PR description if unsure.

---

## Slice 0 — Foundation

Goal: empty skeleton that runs locally + on Vercel, with schema, event log, state machine, auth, and Sandcastle initialized.

### #1 Initialize Next.js + Vercel project
- **Labels:** `manual`, `slice-0-foundation`, `area:infra`
- **Goal:** scaffold a Next.js App Router project, configure for Vercel deployment, set up TypeScript strict mode.
- **Acceptance:**
  - [ ] `pnpm create next-app` with App Router, TS, Tailwind, ESLint
  - [ ] `vercel.ts` config in place (per ARCHITECTURE §1)
  - [ ] Deployed to Vercel preview successfully

### #2 Install shadcn/ui + base components
- **Labels:** `manual`, `slice-0-foundation`, `area:ui`
- **Goal:** install shadcn with Tailwind config, pull in baseline primitives.
- **Acceptance:**
  - [ ] shadcn initialized with default config
  - [ ] Primitives installed: Button, Input, Form, Dialog, Sheet, Card, Badge, Table, Tabs, Tooltip, Toast, DropdownMenu, Select, Textarea, Label
  - [ ] Dark mode toggle wired

### #3 Connect Railway Postgres + Prisma setup
- **Labels:** `manual`, `slice-0-foundation`, `area:schema`, `area:infra`
- **Goal:** Prisma installed, connected to Railway Postgres, initial migration runs.
- **Acceptance:**
  - [ ] `DATABASE_URL` in `.env.local` + Vercel env
  - [ ] `prisma/schema.prisma` with empty datasource + generator
  - [ ] Initial empty migration applied
  - [ ] `pnpm prisma studio` works locally

### #4 Define core Prisma schema (Candidate, MasterCV, RolePreference, Opportunity, Application, Artifact, Recruiter, Interview, Event, Insight)
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:schema`
- **Plan:** `plans/slice-0-foundation/04-core-schema.md`
- **Goal:** translate ARCHITECTURE.md §3 conceptual schema into a working `schema.prisma`.
- **Acceptance:**
  - [ ] All 10 entities defined with relationships
  - [ ] `ApplicationState` enum (12 states) + `ArtifactType`, `ArtifactState`, `EventType` enums
  - [ ] pgvector extension enabled + `embedding` column on relevant tables
  - [ ] Single-tenant: `Candidate` row count enforced to 1 (seed script or check)
  - [ ] Migration applied cleanly; Studio shows tables

### #5 Roll-your-own auth + User table
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:auth`, `area:schema`
- **Plan:** `plans/slice-0-foundation/05-auth.md`
- **Goal:** simple email/password (or magic-link) auth for a single user, with a `User` table linked 1:1 to `Candidate`.
- **Acceptance:**
  - [ ] `User` table (email, password_hash, created_at) with FK to `Candidate`
  - [ ] Sign-in / sign-out routes with secure session (HTTP-only cookie, signed)
  - [ ] Middleware protects all routes except `/signin`
  - [ ] Seed script creates the single user from `.env` values

### #6 Event log table + append-only invariant
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:event-bus`
- **Plan:** `plans/slice-0-foundation/06-event-log.md`
- **Goal:** durable `events` table with append-only constraint, plus a typed `emitEvent()` helper.
- **Acceptance:**
  - [ ] `Event` table per ARCHITECTURE §4
  - [ ] DB trigger or app-level enforcement: no UPDATE / DELETE on `events`
  - [ ] `emitEvent(type, payload, applicationId?)` typed helper in `lib/events.ts`
  - [ ] Unit tests: emit, read, fail on update attempt

### #7 Event dispatcher (DB-polling, simple)
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:event-bus`
- **Plan:** `plans/slice-0-foundation/07-dispatcher.md`
- **Goal:** Vercel Cron that polls `events` for unprocessed rows, invokes subscribed workers, marks consumed.
- **Acceptance:**
  - [ ] `app/api/cron/dispatch/route.ts` runs every minute
  - [ ] Worker registry pattern in `lib/workers/registry.ts`
  - [ ] Idempotent: replaying an event doesn't duplicate side effects
  - [ ] Logs each dispatch with event id + worker name

### #8 Application state machine
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:schema`, `area:event-bus`
- **Plan:** `plans/slice-0-foundation/08-state-machine.md`
- **Goal:** pure-TS state machine for 12 Application states with transition guards.
- **Acceptance:**
  - [ ] `lib/state-machine/application.ts` exports `transition(app, next)` and `canTransition(app, next)`
  - [ ] All 12 states + valid transition map per PRODUCT.md §10
  - [ ] Every transition emits a corresponding event via `emitEvent()`
  - [ ] Raw `prisma.application.update({ data: { state: ... } })` forbidden (lint rule or repo pattern)
  - [ ] Unit tests cover all valid + invalid transitions

### #9 Worker runtime interface + types
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:worker`
- **Plan:** `plans/slice-0-foundation/09-worker-runtime.md`
- **Goal:** TS types and base class for all workers per ARCHITECTURE §5.
- **Acceptance:**
  - [ ] `Worker<TInput, TOutput>` interface
  - [ ] `WorkerContext`, `WorkerResult`, `ScopedMemory`, `GovernanceConstraints` types
  - [ ] `registerWorker()` adds to registry
  - [ ] Stub no-op worker passes through the dispatcher

### #10 GCS setup + Master CV upload route
- **Labels:** `manual`, `slice-0-foundation`, `area:infra`
- **Goal:** GCS bucket + service account configured, route for uploading Master CV PDF returning gs:// URI.
- **Acceptance:**
  - [ ] `GCS_PROJECT_ID`, `GCS_BUCKET`, `GCS_KEY_FILE` set in `.env.local`
  - [ ] `gcs-service-account.json` placed locally (gitignored)
  - [ ] `app/api/upload/master-cv/route.ts` accepts PDF, uploads to bucket as private, returns `gs://` URI + signed-URL helper
  - [ ] Stored URI written to `MasterCV.gcsUri`

### #11 AI Gateway client wrapper
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:worker`, `area:integration`
- **Plan:** `plans/slice-0-foundation/11-ai-gateway.md`
- **Goal:** typed wrapper for AI Gateway with model routing per ARCHITECTURE §7.
- **Acceptance:**
  - [ ] `lib/ai/client.ts` exports `callLLM(prompt, opts)` accepting `model: ModelChoice`
  - [ ] Default routing map (Haiku / Sonnet / Opus) defined
  - [ ] Prompt caching enabled by default
  - [ ] Token + cost logged per call

### #12 Base layout + navigation shell
- **Labels:** `sandcastle`, `slice-0-foundation`, `area:ui`
- **Plan:** `plans/slice-0-foundation/12-layout.md`
- **Goal:** App-shell layout with sidebar (Dashboard, Opportunities, Applications, Interviews, Artifacts, Insights, Profile) per PRODUCT.md §16.
- **Acceptance:**
  - [ ] Responsive sidebar + topbar with user menu
  - [ ] Active route highlighting
  - [ ] Empty-state placeholder pages for all seven routes

### #13 Initialize Sandcastle
- **Labels:** `manual`, `slice-0-foundation`, `area:infra`
- **Goal:** `sandcastle init` configured for Docker + GitHub Issues backlog.
- **Acceptance:**
  - [ ] `.sandcastle/` directory committed
  - [ ] `.sandcastle/prompt.md` template references PRODUCT.md, ARCHITECTURE.md, ROADMAP.md, and the per-issue plan file
  - [ ] Template: `sequential-reviewer`
  - [ ] Backlog: GitHub Issues, filter by `sandcastle` label
  - [ ] Test run against issue #4 (core schema) in a throwaway branch

---

## Slice 1 — Manual Opportunity → Application flow

### #14 Profile page: Master CV upload + role prefs form
- **Labels:** `sandcastle`, `slice-1-manual-flow`, `area:ui`, `area:schema`
- **Plan:** `plans/slice-1-manual-flow/14-profile.md`
- **Goal:** `/profile` page with CV upload, role preferences form (target roles, industries, comp, geo, work auth).
- **Acceptance:**
  - [ ] CV upload uses #10 route, writes `MasterCV`
  - [ ] Role prefs persisted to `RolePreference`
  - [ ] Form validates with zod + react-hook-form
  - [ ] Empty profile blocks access to other routes (redirect with message)

### #15 Opportunities page: manual JD paste flow
- **Labels:** `sandcastle`, `slice-1-manual-flow`, `area:ui`
- **Plan:** `plans/slice-1-manual-flow/15-opportunities.md`
- **Goal:** `/opportunities` lists discovered + shortlisted; "Add manually" creates `Opportunity` from pasted JD.
- **Acceptance:**
  - [ ] Paste-JD modal captures title, company, source URL, JD text
  - [ ] Saved as `Opportunity` in `Discovered` state
  - [ ] List view with filters by state
  - [ ] Shortlist action transitions to `Shortlisted` + emits `JobShortlisted` event

### #16 Application creation from shortlist
- **Labels:** `sandcastle`, `slice-1-manual-flow`, `area:event-bus`, `area:schema`
- **Plan:** `plans/slice-1-manual-flow/16-app-create.md`
- **Goal:** shortlisting an opportunity creates an `Application` row in `Shortlisted` state.
- **Acceptance:**
  - [ ] Listener on `JobShortlisted` creates `Application`
  - [ ] Emits `ApplicationCreated` event
  - [ ] Idempotent (re-shortlist doesn't dupe)

### #17 Application detail page (workspace)
- **Labels:** `sandcastle`, `slice-1-manual-flow`, `area:ui`
- **Plan:** `plans/slice-1-manual-flow/17-app-workspace.md`
- **Goal:** `/applications/[id]` shows JD, state, artifact list (empty), interview list (empty), event timeline.
- **Acceptance:**
  - [ ] Tabs: Overview / Artifacts / Interviews / Activity
  - [ ] State transition buttons (only valid next-states shown, per state machine)
  - [ ] Activity tab reads from `events` table filtered by `application_id`

### #18 Approval gate modal component
- **Labels:** `sandcastle`, `slice-1-manual-flow`, `area:approval-gate`, `area:ui`
- **Plan:** `plans/slice-1-manual-flow/18-approval-modal.md`
- **Goal:** reusable `<ApprovalGate artifact={...}>` modal: approve / reject / edit / regenerate / compare.
- **Acceptance:**
  - [ ] Modal opens from any `pending_review` artifact
  - [ ] Approve transitions artifact state + emits `*Approved` event
  - [ ] Reject + edit + regenerate paths wired
  - [ ] Compare-versions view (side-by-side diff for text artifacts)
  - [ ] No outbound action possible without `approved` state (enforced at DB + UI)

### #19 Manual artifact upload
- **Labels:** `sandcastle`, `slice-1-manual-flow`, `area:ui`
- **Plan:** `plans/slice-1-manual-flow/19-manual-artifact.md`
- **Goal:** upload a CV/cover letter PDF directly to an Application, bypassing workers.
- **Acceptance:**
  - [ ] Upload flow lands artifact in `draft`
  - [ ] Goes through #18 approval gate before counting as "submitted"
  - [ ] Type tag (resume / cover-letter / other)

### #20 Manual state transitions for full lifecycle test
- **Labels:** `manual`, `slice-1-manual-flow`
- **Goal:** end-to-end smoke test: manually run a real application from Discovered to Archived.
- **Acceptance:**
  - [ ] Document the run in a short README note
  - [ ] Friction list captured for Slice 1 retro

---

## Slice 2 — Resume Match Scorer

### #21 Scoped memory resolver
- **Labels:** `sandcastle`, `slice-2-match-scorer`, `area:worker`
- **Plan:** `plans/slice-2-match-scorer/21-memory-resolver.md`
- **Goal:** `resolveScopedMemory(worker, event)` returns the exact context blob a worker should receive.
- **Acceptance:**
  - [ ] Per-worker scope declaration (which entities to pull)
  - [ ] Cap on token budget per scope
  - [ ] Logs what was included / excluded for explainability

### #22 Resume Match Scorer worker
- **Labels:** `sandcastle`, `slice-2-match-scorer`, `area:worker`
- **Plan:** `plans/slice-2-match-scorer/22-scorer.md`
- **Goal:** subscribes to `JobShortlisted`, scores fit, writes `Artifact` of type `evaluation`.
- **Acceptance:**
  - [ ] Output schema: `{ score: 0-100, strengths: string[], gaps: string[], rationale: string }`
  - [ ] Uses Sonnet via AI Gateway
  - [ ] Emits `EvaluationGenerated` event
  - [ ] State transition: `Shortlisted` → `Evaluated`

### #23 Match Scorer UI surface on Application workspace
- **Labels:** `sandcastle`, `slice-2-match-scorer`, `area:ui`
- **Plan:** `plans/slice-2-match-scorer/23-scorer-ui.md`
- **Goal:** evaluation panel on `/applications/[id]` showing score, strengths, gaps.
- **Acceptance:**
  - [ ] Score visualization (donut + breakdown)
  - [ ] "Regenerate" button re-runs worker
  - [ ] Loading state while worker runs

---

## Slice 3 — Tailored Resume Builder

### #24 Tailored Resume Builder worker
- **Labels:** `sandcastle`, `slice-3-resume-builder`, `area:worker`
- **Plan:** `plans/slice-3-resume-builder/24-builder.md`
- **Goal:** generate role-specific tailored resume from Master CV + JD + evaluation.
- **Acceptance:**
  - [ ] Output: structured resume JSON (sections, bullets) + rationale per change
  - [ ] Uses Opus via AI Gateway
  - [ ] Stored as `Artifact` of type `tailored-resume` in `draft`
  - [ ] Version lineage preserved on regenerate
  - [ ] Emits `ResumeGenerated`

### #25 Resume editor (structured)
- **Labels:** `sandcastle`, `slice-3-resume-builder`, `area:ui`
- **Plan:** `plans/slice-3-resume-builder/25-editor.md`
- **Goal:** edit structured resume JSON section-by-section; live preview.
- **Acceptance:**
  - [ ] Add/remove/reorder sections, bullets
  - [ ] Inline AI rewrite per bullet (calls worker with single-bullet scope)
  - [ ] Saves to a new version

### #26 PDF rendering pipeline
- **Labels:** `sandcastle`, `slice-3-resume-builder`, `area:integration`
- **Plan:** `plans/slice-3-resume-builder/26-pdf.md`
- **Goal:** render approved resume JSON → PDF, store in GCS.
- **Acceptance:**
  - [ ] Choice between Puppeteer (Vercel-compatible) and react-pdf documented + picked
  - [ ] Approved resume produces a downloadable PDF
  - [ ] PDF URI written to `Artifact.gcsUri`
  - [ ] Re-approval after edit produces new PDF version

### #27 Approval gate integration for tailored resume
- **Labels:** `sandcastle`, `slice-3-resume-builder`, `area:approval-gate`
- **Plan:** `plans/slice-3-resume-builder/27-approval.md`
- **Goal:** approval gate wired specifically for tailored-resume artifacts.
- **Acceptance:**
  - [ ] Approve → state transition `Evaluated` → `Tailoring` → `Approved`
  - [ ] Reject → keep in `Tailoring`, allow regenerate
  - [ ] Compare versions for tailored resumes

---

## Slice 4 — Cover Letter Generator

### #28 Cover Letter Generator worker
- **Labels:** `sandcastle`, `slice-4-cover-letter`, `area:worker`
- **Plan:** `plans/slice-4-cover-letter/28-worker.md`
- **Goal:** generate cover letter from approved resume + JD + role prefs.
- **Acceptance:**
  - [ ] Output: structured paragraphs
  - [ ] Uses Opus
  - [ ] Subscribes to `ResumeApproved`

### #29 Cover Letter editor + PDF
- **Labels:** `sandcastle`, `slice-4-cover-letter`, `area:ui`, `area:integration`
- **Plan:** `plans/slice-4-cover-letter/29-editor-pdf.md`
- **Goal:** rich-text editor for cover letter + PDF export reusing Slice 3 pipeline.
- **Acceptance:**
  - [ ] Editor saves new versions
  - [ ] PDF export works
  - [ ] Approval gate integrated

---

## Slice 5 — Application Tracker

### #30 Stale detection + follow-up reminder worker
- **Labels:** `sandcastle`, `slice-5-tracker`, `area:worker`
- **Plan:** `plans/slice-5-tracker/30-tracker.md`
- **Goal:** cron worker that flags stale Applications + generates follow-up reminders.
- **Acceptance:**
  - [ ] Stale rules per state (e.g. Submitted with no recruiter event > 7 days)
  - [ ] Emits `FollowUpScheduled`
  - [ ] Surface on Dashboard "Follow-Up Alerts"

### #31 Weekly digest job
- **Labels:** `sandcastle`, `slice-5-tracker`, `area:worker`, `area:integration`
- **Plan:** `plans/slice-5-tracker/31-digest.md`
- **Goal:** weekly cron generates a summary email/in-app card.
- **Acceptance:**
  - [ ] Digest content: pipeline state, follow-up alerts, upcoming interviews, new opportunities
  - [ ] Email send via Resend (or just in-app v1)

### #32 Dashboard sections wiring
- **Labels:** `sandcastle`, `slice-5-tracker`, `area:ui`
- **Plan:** `plans/slice-5-tracker/32-dashboard.md`
- **Goal:** fill in Dashboard per PRODUCT.md §18.
- **Acceptance:**
  - [ ] Active Applications, Pending Approvals, Recruiter Activity, Upcoming Interviews, Opportunity Digest, Follow-Up Alerts, Strategic Insights (stub)
  - [ ] Prioritization order respected

---

## Slice 6 — Job Alert Aggregator

### #33 Scraping strategy spike
- **Labels:** `manual`, `slice-6-aggregator`, `area:integration`
- **Goal:** decide self-hosted Playwright vs. Bright Data / Apify; document.
- **Acceptance:** decision doc in `plans/slice-6-aggregator/33-scraping.md`

### #34 Job Alert Aggregator worker
- **Labels:** `sandcastle`, `slice-6-aggregator`, `area:worker`
- **Plan:** `plans/slice-6-aggregator/34-aggregator.md`
- **Goal:** scheduled scrape → rank against role prefs → write Opportunities.
- **Acceptance:**
  - [ ] Cron daily
  - [ ] Cheap LLM (Haiku) ranking
  - [ ] Dedupe across runs
  - [ ] Emits `JobDiscovered` + `JobRanked`

### #35 Opportunity digest UI
- **Labels:** `sandcastle`, `slice-6-aggregator`, `area:ui`
- **Plan:** `plans/slice-6-aggregator/35-digest-ui.md`
- **Goal:** daily digest card on Dashboard with one-click shortlist.
- **Acceptance:**
  - [ ] Top N display
  - [ ] Shortlist / Dismiss / Ignore actions

---

## Slice 7 — Per-Interview Workers

### #36 Recruiter reply + interview scheduling capture
- **Labels:** `sandcastle`, `slice-7-interview`, `area:ui`
- **Plan:** `plans/slice-7-interview/36-capture.md`
- **Goal:** UI to manually log recruiter replies + scheduled interviews on an Application.
- **Acceptance:**
  - [ ] "Recruiter replied" form → emits `RecruiterReplyDetected`
  - [ ] "Schedule interview" form → creates `Interview` + emits `InterviewScheduled`
  - [ ] Triggers Slice 7 workers

### #37 Company Research Assistant worker
- **Labels:** `sandcastle`, `slice-7-interview`, `area:worker`, `area:integration`
- **Plan:** `plans/slice-7-interview/37-research.md`
- **Goal:** generate company research doc (business model, news, smart questions).
- **Acceptance:**
  - [ ] Pulls recent web content (Brave Search / Perplexity API / built-in web tool)
  - [ ] Output stored as `Artifact` of type `company-research`

### #38 Interview Prep Assistant worker
- **Labels:** `sandcastle`, `slice-7-interview`, `area:worker`
- **Plan:** `plans/slice-7-interview/38-prep.md`
- **Goal:** generate role-specific question bank + STAR prompts using career history.
- **Acceptance:**
  - [ ] Output: question list + STAR practice prompts
  - [ ] Linked to specific Interview row

### #39 Interview workspace UI
- **Labels:** `sandcastle`, `slice-7-interview`, `area:ui`
- **Plan:** `plans/slice-7-interview/39-workspace.md`
- **Goal:** `/applications/[id]/interviews/[interviewId]` workspace with prep + notes + outcome.
- **Acceptance:**
  - [ ] Tabs: Prep / Notes / Outcome
  - [ ] Outcome capture transitions Application state appropriately

---

## Slice 8 — LinkedIn Optimizer

### #40 LinkedIn Optimizer worker + manual paste flow
- **Labels:** `sandcastle`, `slice-8-linkedin`, `area:worker`, `area:ui`
- **Plan:** `plans/slice-8-linkedin/40-optimizer.md`
- **Goal:** paste current LinkedIn → suggestions for headline/about/experience.
- **Acceptance:**
  - [ ] Paste flow on Profile page
  - [ ] Worker analyzes vs. target roles + Master CV
  - [ ] Suggestions reviewed via approval gate; no auto-write

---

## Slice 9 — Insights Stub

### #41 Funnel + conversion viz
- **Labels:** `sandcastle`, `slice-9-insights`, `area:ui`
- **Plan:** `plans/slice-9-insights/41-funnel.md`
- **Goal:** Insights page with funnel + conversion rates from existing event log.
- **Acceptance:**
  - [ ] Funnel (Discovered → Shortlisted → Submitted → Interviewing → Offered)
  - [ ] Per-role-family conversion
  - [ ] No new ML required

### #42 Narrative theme extractor (lightweight)
- **Labels:** `sandcastle`, `slice-9-insights`, `area:worker`
- **Plan:** `plans/slice-9-insights/42-themes.md`
- **Goal:** scheduled worker that summarizes recurring themes across approved resumes.
- **Acceptance:**
  - [ ] Surfaces top themes on Insights page
  - [ ] Marked clearly as "AI-derived, non-authoritative"

---

## Summary

- **Total issues:** 42
- **Manual (me):** 8 → #1, #2, #3, #10, #13, #20, #33, and one TBD
- **Sandcastle:** 34
- **Slices:** 0 → 9
- **Plan files required:** 34 (one per Sandcastle issue)

Next move after eyeball: `git init`, push docs, bulk-create issues via `gh issue create`, then start drafting plan files starting with `plans/slice-0-foundation/04-core-schema.md`.
