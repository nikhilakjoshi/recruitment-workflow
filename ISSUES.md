# Career OS — Issue Backlog

Source-of-truth list of GitHub issues for the Career OS build. Reduced from
the original 42-issue draft to **8 chunky issues** plus a small number of
manual prerequisites. Opus 4.7 + 1M context handles bigger tasks well, so
each chunk represents roughly a day of focused work.

## Conventions

### Issue body template (paste into `gh issue create`)

```
## Goal
<one sentence>

## Blocked by
<#N, #M, or "none">

## Plan
<filename in ~/.claude/plans/, mounted read-only at /home/agent/.plans/>

## Acceptance criteria
- [ ] <criterion>
- [ ] <criterion>

## Reference docs (in the worktree)
- PRODUCT.md §<n> "<section>"
- ARCHITECTURE.md §<n> "<section>"
- ROADMAP.md slice <n>

## Out of scope
- <explicit exclusions>
```

### Labels

**Routing (mutually exclusive):**
- `sandcastle` — picked up by Sandcastle planner. Must have a plan file.
- `manual` — done by hand; no plan file needed.

**Chunk (one per issue):**
- `chunk-1-domain-core`
- `chunk-2-runtime`
- `chunk-3-shell`
- `chunk-4-manual-flow`
- `chunk-5-match-scorer`
- `chunk-6-resume-cover-letter`
- `chunk-7-tracker-aggregator`
- `chunk-8-interview-linkedin-insights`

**Area (zero or more):**
- `area:schema`, `area:event-bus`, `area:worker`, `area:ui`,
  `area:approval-gate`, `area:auth`, `area:integration`, `area:infra`,
  `area:docs`

**Lifecycle (created automatically by Sandcastle as it works):**
- `sandcastle:planned`, `sandcastle:in-progress`, `sandcastle:review`,
  `sandcastle:done`

### Plan file location

Plan files live at `~/.claude/plans/<filename>` on the host. They're
bind-mounted **read-only** into each Sandcastle container at
`/home/agent/.plans/`. The issue's `Plan:` line names which file to read.

Plans stay out of the public repo by design: they contain pinned design
decisions, open questions, and strategic notes. The reviewer agent reads
the plan file to validate the implementation matches the acceptance
criteria.

### Dependency enforcement

Two layers, both required:

1. **`Blocked by` line in each issue body** — the planner agent parses
   these and only emits unblocked issues per dispatch. Authoritative
   dependency graph.
2. **Staged labelling** — only apply `sandcastle` to issues whose `Blocked by`
   chain is fully closed. Belt-and-braces against planner misread.

---

## The 8 chunks

### Chunk 1 — Domain core (schema + auth + state machine)
- **Labels:** `sandcastle`, `chunk-1-domain-core`, `area:schema`, `area:auth`
- **Blocked by:** none (root)
- **Plan:** `01-domain-core.md`
- **Goal:** land the full Prisma data model, single-user roll-your-own auth,
  and the typed Application state machine.
- **Acceptance:**
  - [ ] All 11 entities + 8 enums defined in `prisma/schema.prisma`
  - [ ] pgvector extension enabled; embedding columns nullable
  - [ ] Single-tenant CHECK constraint on `Candidate`
  - [ ] One migration `0001_init` that applies cleanly to local Postgres
  - [ ] Seed script creates exactly one User + Candidate from env
  - [ ] Password auth + iron-session cookie flow; middleware-gated routes
  - [ ] State machine transition table enforced; emits events via stub
  - [ ] ESLint rule prevents raw `prisma.application.update({ data: { state } })`
  - [ ] Unit + integration tests for state machine, password, seed
  - [ ] `pnpm typecheck && pnpm test && pnpm build` all green

### Chunk 2 — Runtime backbone (events + dispatcher + worker runtime + AI Gateway)
- **Labels:** `sandcastle`, `chunk-2-runtime`, `area:event-bus`, `area:worker`, `area:integration`
- **Blocked by:** #1 (this issue's number depends on creation order — replace with the actual chunk-1 GH issue number once created)
- **Plan:** `02-runtime-backbone.md` *(to be drafted after chunk 1 returns)*
- **Goal:** wire up the event log invariants, scheduled dispatcher, worker
  runtime interface, and the AI Gateway typed client.
- **Acceptance:**
  - [ ] `Event` table append-only enforced via DB trigger + `emitEvent()` helper
  - [ ] `app/api/cron/dispatch/route.ts` polls events, invokes subscribed workers
  - [ ] `Worker<TIn, TOut>` interface + registry + stub worker passes through
  - [ ] `lib/ai/client.ts` routes by `ModelChoice` via AI Gateway; prompt caching on
  - [ ] State machine's `emitEvent()` stub replaced with the real dispatcher path
  - [ ] Tests + lint + build green

### Chunk 3 — App shell (base layout + nav + GCS upload route)
- **Labels:** `sandcastle`, `chunk-3-shell`, `area:ui`, `area:integration`
- **Blocked by:** #1
- **Plan:** `03-app-shell.md` *(to be drafted)*
- **Goal:** the 7-route nav shell + the Master CV upload endpoint.
- **Acceptance:**
  - [ ] Responsive sidebar + topbar; routes: `/`, `/opportunities`, `/applications`,
    `/interviews`, `/artifacts`, `/insights`, `/profile`
  - [ ] Active route highlighting; user menu with sign-out
  - [ ] Empty/loading/error states for each route
  - [ ] `app/api/upload/master-cv/route.ts` — accepts PDF, uploads to private GCS
    bucket, returns `gs://` URI + writes to `MasterCV.gcsUri`
  - [ ] Tests + lint + build green

### Chunk 4 — Slice 1: manual application flow
- **Labels:** `sandcastle`, `chunk-4-manual-flow`, `area:ui`, `area:approval-gate`, `area:event-bus`
- **Blocked by:** #2, #3
- **Plan:** `04-manual-flow.md` *(to be drafted)*
- **Goal:** the user-facing end-to-end of running an application without AI.
- **Acceptance:**
  - [ ] `/profile` — Master CV upload + role prefs form (zod + react-hook-form)
  - [ ] `/opportunities` — list + manual JD paste; shortlist creates `Application`
  - [ ] `/applications/[id]` — workspace with tabs (Overview / Artifacts / Interviews / Activity)
  - [ ] State transition buttons render only valid next-states (state machine)
  - [ ] `<ApprovalGate>` modal — approve / reject / edit / regenerate / compare
  - [ ] Manual artifact upload flow lands in `draft`, goes through approval gate
  - [ ] Tests + lint + build green

### Chunk 5 — Slice 2: Resume Match Scorer (first real worker)
- **Labels:** `sandcastle`, `chunk-5-match-scorer`, `area:worker`, `area:ui`
- **Blocked by:** #4
- **Plan:** `05-match-scorer.md` *(to be drafted)*
- **Goal:** first end-to-end worker — validates the worker infra from Chunk 2
  against a real LLM call.
- **Acceptance:**
  - [ ] `resolveScopedMemory(worker, event)` returns bounded context blob
  - [ ] Match Scorer worker subscribes to `JOB_SHORTLISTED`, outputs typed
    `{ score, strengths, gaps, rationale }`
  - [ ] Uses Sonnet via AI Gateway; caches the Master CV portion
  - [ ] Emits `EVALUATION_GENERATED`; transitions Application `SHORTLISTED → EVALUATED`
  - [ ] UI: score panel on `/applications/[id]` with strengths + gaps
  - [ ] Tests + lint + build green

### Chunk 6 — Slice 3+4: Tailored Resume + Cover Letter (generative core)
- **Labels:** `sandcastle`, `chunk-6-resume-cover-letter`, `area:worker`, `area:ui`, `area:approval-gate`, `area:integration`
- **Blocked by:** #5
- **Plan:** `06-resume-cover-letter.md` *(to be drafted)*
- **Goal:** the per-application generative pair — the biggest value-prop of the system.
- **Acceptance:**
  - [ ] Tailored Resume Builder worker — structured JSON output + rationale per change
  - [ ] Cover Letter Generator worker — structured paragraphs
  - [ ] Both use Opus via AI Gateway
  - [ ] Resume editor — section/bullet edit + inline AI rewrite + version preserve
  - [ ] PDF rendering pipeline → GCS (Puppeteer vs react-pdf decision in plan)
  - [ ] Approval gate wired specifically for resume + cover-letter artifacts
  - [ ] State transitions `EVALUATED → TAILORING → APPROVED → SUBMITTED`
  - [ ] Tests + lint + build green

### Chunk 7 — Slice 5+6: Tracker + Aggregator + Dashboard
- **Labels:** `sandcastle`, `chunk-7-tracker-aggregator`, `area:worker`, `area:ui`, `area:integration`
- **Blocked by:** #6
- **Plan:** `07-tracker-aggregator.md` *(to be drafted)*
- **Goal:** the always-on background workers + the dashboard that surfaces them.
- **Acceptance:**
  - [ ] Stale-detection cron flags applications by per-state thresholds
  - [ ] Weekly digest job — pipeline state, follow-ups, interviews, opportunities
  - [ ] Job Alert Aggregator worker (scraping strategy decided in manual prereq below)
  - [ ] Opportunity digest UI card on Dashboard with one-click shortlist
  - [ ] Dashboard sections per PRODUCT.md §18: Active Applications,
    Pending Approvals, Recruiter Activity, Upcoming Interviews, Opportunity Digest,
    Follow-Up Alerts, Strategic Insights (stub)
  - [ ] Tests + lint + build green

### Chunk 8 — Slice 7+8+9: Interview + LinkedIn + Insights
- **Labels:** `sandcastle`, `chunk-8-interview-linkedin-insights`, `area:worker`, `area:ui`
- **Blocked by:** #6
- **Plan:** `08-interview-linkedin-insights.md` *(to be drafted)*
- **Goal:** the polish layer — per-interview support, LinkedIn optimization,
  longitudinal insights.
- **Acceptance:**
  - [ ] Recruiter reply + interview scheduling capture UI
  - [ ] Company Research worker (web access required — built-in tool or Brave/Perplexity)
  - [ ] Interview Prep worker — role-specific Qs + STAR prompts
  - [ ] `/applications/[id]/interviews/[id]` workspace
  - [ ] LinkedIn Optimizer worker (manual paste; no auto-write)
  - [ ] Insights page — funnel + per-role-family conversion (no new ML)
  - [ ] Narrative theme extractor (lightweight, AI-derived label clear)
  - [ ] Tests + lint + build green

---

## Manual prerequisites (outside Sandcastle)

These don't go through the dispatcher. You handle them at the appropriate
moment.

### M1 — GCS bucket + service account (prerequisite for Chunk 3)
- Create a private bucket in your GCP project
- Generate a service account with Storage Object Admin role
- Download `gcs-service-account.json` to repo root (already gitignored)
- Populate `.env.local` with `GCS_PROJECT_ID`, `GCS_BUCKET`, `GCS_KEY_FILE`

### M2 — Scraping strategy decision (prerequisite for Chunk 7's aggregator part)
- Decide self-hosted Playwright vs Bright Data vs Apify
- Write the decision into `07-tracker-aggregator.md` plan file before
  applying `sandcastle` to Chunk 7

### M3 — End-to-end smoke after Chunk 4 (recommended)
- Manually run a real opportunity from `Discovered` → `Submitted` to validate
  the manual flow before letting AI start touching artifacts
- Capture friction list

---

## Initial dispatch plan

1. **Chunk 1 is the first issue created on GitHub** — it has no upstream
   `Blocked by`, so the planner emits it immediately.
2. After Chunk 1 merges, **Chunks 2 and 3** become unblocked simultaneously.
   The planner can emit both — they'll run in parallel sandboxes.
3. After both Chunk 2 and Chunk 3 close, **Chunk 4** unlocks.
4. From Chunk 4 onward, the chain is mostly serial (each chunk blocks the
   next), with **Chunks 7 and 8** both unblocked by Chunk 6 and able to run
   in parallel.

---

## Summary

- **Total Sandcastle issues:** 8
- **Manual prereqs:** 3 (GCS setup, scraping decision, manual e2e smoke)
- **Plan files required:** 8 (one per Sandcastle chunk; only `01-domain-core.md`
  drafted so far — the rest are drafted just-in-time as their predecessors close)
- **First issue to publish:** Chunk 1 with `sandcastle` label
