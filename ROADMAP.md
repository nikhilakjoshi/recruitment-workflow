# Career OS — Solo Build Roadmap

Order of operations for a solo builder. Each slice is **shippable on its own** — usable end-to-end before the next slice starts.

The earlier a slice creates value-in-use, the more honestly the rest of the system gets built. Don't build the whole skeleton then bolt features on. Build the smallest viable spine, then grow ribs.

---

## Sequencing principle

Two rules:

1. **Memory before workers.** A worker without persistent memory is just a prompt. Slice 1 is the memory layer.
2. **One worker fully shipped before the next.** End-to-end including UI, approval gate, regeneration, version lineage. No half-built workers.

The 8 workers don't all need to exist for the product to be valuable. The Match Scorer + Tailored Resume Builder + Cover Letter Generator alone justify the whole system if shipped well.

---

## Slice 0 — Foundation (no AI yet)

**Goal:** stand up the skeleton. No LLM calls.

- Next.js app on Vercel
- Postgres (Neon or Supabase via Vercel Marketplace) + Prisma
- Auth (magic link, single user)
- Schema for: `Candidate`, `MasterCV`, `RolePreference`, `Opportunity`, `Application`, `Artifact`, `Event`, `Recruiter`, `Interview`
- Append-only `events` table + simple dispatcher
- Application state machine (12 states, transitions only via functions)
- Blob storage for Master CV upload
- shadcn/ui scaffolding + base routes
- Profile page: upload Master CV, define role prefs (target roles, comp, geo, work auth)

**Shipped when:** I can sign in, upload my CV, and see it stored. Empty dashboard. No workers yet.

---

## Slice 1 — Manual Opportunity → Application flow

**Goal:** prove the operational center (Application) works without any AI.

- Paste a JD manually → creates `Opportunity` → manual "Shortlist" creates `Application`
- Application detail page (Application workspace) shows: JD, state, empty artifact list, empty interview list
- Manual state transitions: Shortlisted → Submitted → Recruiter Engaged → Interviewing → (Rejected | Accepted) → Archived
- Manual artifact upload (so I can attach a CV I made elsewhere) — proves the artifact lifecycle
- Approval gate UI as the only path from `draft` → `approved`

**Shipped when:** I can manually run my entire job search through the app, without any AI help. State machine works. Approval gate works. Application workspace feels right.

This slice is the **honesty test** for the product. If running my job search manually through this is annoying, no amount of AI will save it.

---

## Slice 2 — Resume Match Scorer (Worker 2)

**Goal:** first worker. Cheapest LLM call. Validates the whole worker runtime.

- AI Gateway wired up
- `WorkerContext`, `WorkerResult`, scoped memory resolver
- Match Scorer subscribes to `JobShortlisted` events
- Output: fit score (0–100), strengths, gaps, qualification summary
- Worker output stored as `Artifact` (type: `evaluation`)
- Surfaced on the Application workspace

**Shipped when:** shortlisting a pasted JD produces a score and gap analysis within seconds. I trust the output enough to use it.

---

## Slice 3 — Tailored Resume Builder (Worker 3)

**Goal:** the highest-stakes generative worker. The reason the product exists.

- Subscribes to `JobShortlisted` (or manual "Generate Tailored Resume" trigger after Match Scorer runs)
- Scoped memory: Master CV + JD + role preferences + match scorer output
- Output: tailored resume as structured content + rendered PDF (Blob)
- Versioning + lineage (every regeneration is a new version)
- Approval gate: approve, reject, edit, regenerate, compare versions
- Editor for inline tweaks before approval

**Shipped when:** for any pasted JD I get a tailored resume I'd actually submit. Regeneration preserves lineage. Approved version stored as Blob PDF.

---

## Slice 4 — Cover Letter Generator (Worker 4)

**Goal:** finish the per-application generative pair.

- Subscribes to `ResumeApproved` (or manual trigger)
- Same scoped memory + approved tailored resume
- Same approval gate, versioning, editor
- PDF rendering

**Shipped when:** approving the resume produces a cover letter draft I'd actually submit.

After Slice 4, the **per-application generative core** of the product is done. Slices 5+ make the system continuous and richer, but the moment of value is here.

---

## Slice 5 — Application Tracker (Worker 8)

**Goal:** close the loop. Once I've submitted, the system should keep me honest.

- Always-on worker, scheduled via Vercel Cron
- Reads `Application` state + last-update timestamps
- Detects stale applications, generates follow-up reminders
- Surfaces on Dashboard "Follow-Up Alerts" + weekly digest
- Notifications model (email or in-app)

**Shipped when:** I get a weekly digest of pipeline state and follow-up nudges I'd actually act on.

---

## Slice 6 — Job Alert Aggregator (Worker 1)

**Goal:** flip the system from "I paste JDs" to "system surfaces JDs."

- Cron-scheduled scrape of chosen sources (start narrow: LinkedIn + one niche board)
- Cheap LLM ranking against role preferences
- Daily digest of top N new opportunities
- One-click "Shortlist" creates Application → fires Slice 2-3-4 chain

**Shipped when:** daily digest surfaces relevant roles. Most of my discovered opportunities come from the digest, not manual paste.

This is the slice that turns the product from "tool I use when applying" into "system that runs in the background."

---

## Slice 7 — Per-Interview workers (Workers 6 & 7)

**Goal:** support the interview half of the journey.

- **Company Research Assistant** — triggered by `RecruiterReplyDetected` (manual entry of recruiter reply in v1) or `InterviewScheduled`. Outputs: business model summary, recent news, intelligent questions to ask.
- **Interview Prep Assistant** — same trigger. Outputs: role-specific question bank + STAR practice prompts using my career history.
- Interview workspace UI (sub-context of Application)
- Notes + outcome capture per interview
- Same approval gate semantics for any prep doc

**Shipped when:** entering "Recruiter replied" or "Interview scheduled" produces useful prep materials within minutes.

---

## Slice 8 — LinkedIn Profile Optimizer (Worker 5)

**Goal:** the lowest-frequency value worker, last.

- Manual paste of current LinkedIn profile (no scrape v1)
- Worker analyzes: keyword coverage vs. target roles, narrative consistency vs. Master CV, suggestions for headline/about/experience
- Approval gate: every suggested edit is reviewable; nothing pushed to LinkedIn (manual copy/paste)

**Shipped when:** quarterly LinkedIn review produces concrete edits I'd actually paste in.

---

## Slice 9 — Insights / longitudinal stub

**Goal:** lay groundwork for the moat. Don't build the full longitudinal worker yet — but expose the structure.

- Insights page shows: application funnel (Discovered → Shortlisted → Submitted → Interviewing → Offered), conversion rates, recruiter response rates by role family, narrative themes that appear in approved resumes
- All sourced from the existing event log and approved artifacts
- No new ML required

**Shipped when:** I can answer "what's actually working in my job search" by looking at the Insights page.

---

## Out of scope for v1 (entirely)

Per `PRODUCT.md` §24:
- Multi-tenant / multi-user
- Auto-submit / auto-send
- Narrative Performance Analyzer, Career Strategy Advisor, Comp Trend Analyzer (placeholder UI only)
- Mobile-first UX
- Delegated approval, auto-approval, confidence-based recommendations

---

## Build cadence (realistic, solo)

- Slice 0–1: foundation + manual flow. **Largest single chunk** — until this is right, everything else is wasted.
- Slice 2–4: per-application AI core. The first place AI value lands.
- Slice 5: tracker. Continuous-value layer.
- Slice 6: aggregator. Inbound-value layer.
- Slice 7: interview workers. Closes the loop.
- Slice 8: LinkedIn optimizer. Polish.
- Slice 9: insights. Moat begins.

Each slice ends with: working in production, used by me on at least one real application, written-up notes on what to fix in the next pass.

---

## What "done" means for a slice

Each slice must satisfy all of:

1. **Deployed.** Lives on Vercel, accessible at the production URL.
2. **Used.** I've used it on at least one real opportunity.
3. **Approval-gated.** Every outbound artifact goes through the gate.
4. **Memory-aware.** Worker output goes back into memory (artifact or event), not just rendered.
5. **Documented.** Open questions remaining are noted in this file or `PRODUCT.md`.
6. **No half-finished features.** Either it's in or it's not.

---

## Open questions for execution

- Job board scraping: self-hosted (Playwright on a cron) vs. third-party (Bright Data, Apify)? Defer until Slice 6.
- Email integration for recruiter-reply detection: manual paste v1, webhook v2?
- PDF rendering for resumes: HTML → PDF via Vercel runtime, or commit to a Latex-style approach?
- How to handle the "this resume isn't quite right" loop — full regenerate vs. structured field edits? Will inform Slice 3 editor design.
