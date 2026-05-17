# Career OS

A persistent, event-driven, human-governed career operating system for a single job seeker (me).

Not a resume builder. Not a job board. Not an agent swarm.

An OS that **remembers** the candidate's career, **observes** events across the job-seeking lifecycle, runs **bounded AI workers** against scoped memory, and **gates every outbound action** behind human approval.

The workers are replaceable. The memory graph is not.

---

## Single-line pitch

A career workspace where eight AI workers operate against a persistent memory layer about me — discovering jobs, scoring fit, tailoring resumes, writing cover letters, researching companies, prepping interviews, tracking applications, and optimizing my LinkedIn — while I stay the decision-maker on every outbound action.

---

## The shift from "8 AI workers" to "Career OS"

Earlier framing treated the 8 workers as the product. They're not. They're runtime capabilities.

The product is:

1. **Persistent candidate memory** — Master CV, role preferences, skills, projects, employment history, comp expectations, geo prefs, work auth, historical applications, historical artifacts, interview history
2. **Application-centered orchestration** — every meaningful event attaches to an Application; the Application is the workflow, memory, artifact, interaction, and analytics boundary
3. **Event-driven cognition** — workers don't invoke each other; events emit, workers subscribe, state transitions occur, human approvals interrupt flow
4. **Approval-governed automation** — every outbound artifact (resume, cover letter, recruiter reply, LinkedIn change, interview prep doc) is reviewable, editable, explainable, and approval-gated
5. **Longitudinal intelligence** — over time the system learns what narratives convert, which companies engage, where interviews stall, which skills expand opportunity

**Memory is the moat.**

---

## Build context

- **Audience:** me (nicool652@gmail.com). Single-user, single-tenant. No multi-tenancy concerns for v1.
- **Builder:** solo. Just me.
- **Strategy:** finish building the product first, then revisit scale/concurrency/budget. Architectural decisions should not paint into a corner, but premature optimization is parked.

## Local development

```bash
docker compose up -d        # Postgres + pgvector on localhost:5433
pnpm install
pnpm exec prisma db push    # apply current schema
pnpm dev                    # Next.js dev server (default port 3000)
```

Environment template: `.env.example`. Local `.env` uses the dockerized Postgres.

---

## Documentation map

| File | Purpose |
|---|---|
| [README.md](./README.md) | Entry point, single-line pitch, doc map |
| [PRODUCT.md](./PRODUCT.md) | Full product definition: vision, philosophy, capabilities, memory model, worker model, event model, lifecycle, UX, governance |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical direction: stack choices, data layer, event bus, worker runtime, storage, integrations |
| [ROADMAP.md](./ROADMAP.md) | Solo execution plan: slice-by-slice build order, what each slice delivers |
| [Job Seeker Product Doc.pdf](./Job%20Seeker%20Product%20Doc.pdf) | Original 72-page source product spec (Career OS — Foundational Product Artefacts) |

Start with `PRODUCT.md` for the what, `ARCHITECTURE.md` for the how, `ROADMAP.md` for the order.

---

## Core principles (one-liners)

- **The candidate is the protagonist.** AI is supporting cast.
- **Drafts, not decisions.** System drafts; human decides.
- **Shared context over fragmented tools.** All workers operate against the same memory layer.
- **Events drive cognition.** Not a linear pipeline.
- **Memory must be scoped.** No flat vector dumps, no globally injected context.
- **Approval is a system primitive**, not UI logic.
- **The Application is the operational center** of the system.

---

## Open questions

Build first, answer later. None of these should block the first slices.

- **Scale, concurrency, LLM budget** — parked until product takes shape. Will inform infra choices but not v1 product semantics.
- **Email integration depth** — read-only (detect recruiter replies) vs. send (auto-submit). Default: read-only initially.
- **LinkedIn integration** — API access realistic vs. scraping vs. manual paste? Default: manual paste, deferred worker.
- **Job board sources** — which first? LinkedIn, Indeed, Wellfound, niche boards?
- **Scraping** — self-hosted vs. third-party (Bright Data, Apify)?
- **Artifact persistence** — store every generated CV/cover letter forever, or regenerate on demand from memory?
- **Approval UX** — inline editor vs. approve/reject/regenerate buttons?
- **Vector vs. relational retrieval boundary** — likely hybrid; exact split deferred.
- **Memory aging / summarization policy** — when does active memory become summarized, then archived?
