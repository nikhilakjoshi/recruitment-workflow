# Career OS — Product Definition

This is the canonical product definition. Distilled from the 72-page source spec into something a solo builder can execute against.

If `README.md` is the elevator pitch and `ARCHITECTURE.md` is the wiring diagram, this doc is the **product itself** — what it does, why it works that way, and what's in / out of scope for v1.

---

## 1. Vision

Build a human-governed Career Operating System that continuously assists me across the full job-seeking lifecycle — from opportunity discovery to offer conversion — through persistent memory, event-driven workflows, and specialized cognitive workers.

The system acts as:
- an operational career companion,
- a persistent career intelligence layer,
- and a workflow orchestration platform for job seeking.

The candidate remains the decision-maker at all times.
The system drafts, analyzes, recommends, prepares, and tracks.
The human chooses.

### Long-term direction

The long-term value is not resume generation, cover letter automation, or application tracking. It is:
- adaptive career intelligence,
- longitudinal candidate understanding,
- strategic market positioning,
- recruiter interaction optimization,
- personalized career cognition.

The system progressively learns: what opportunities convert, what narratives resonate, what skills are under-positioned, which recruiters respond, how I perform over time.

**Memory is the moat.**

---

## 2. Product Philosophy

### 2.1 Human-Centered Governance
The candidate is the protagonist. AI workers reduce operational burden. The platform must never feel autonomous, uncontrollable, or opaque.

### 2.2 Drafts, Not Decisions
All outbound artifacts (resumes, cover letters, recruiter responses, LinkedIn changes, interview prep docs) must be reviewable, editable, explainable, and approval-gated. **No autonomous outbound actions occur without human approval.**

### 2.3 Shared Context Over Fragmented Tools
All workers operate against a shared candidate memory layer. The platform avoids repetitive prompting, disconnected workflows, duplicated profile management, isolated tooling. Workers compose through shared memory.

### 2.4 Events Drive Cognition
Not a linear pipeline. Workers activate on triggers, events, state transitions, contextual signals. Example events: New job discovered, Recruiter replied, Interview scheduled, Resume approved, Application submitted.

### 2.5 Longitudinal Intelligence
The product improves over time by learning: recruiter response patterns, candidate conversion patterns, interview performance trends, narrative effectiveness, skill gap correlations, compensation trajectories.

---

## 3. Core Product Requirements

### 3.1 Persistent Candidate Layer
The system must maintain: Master CV, role preferences, career goals, skills, projects, employment history, compensation expectations, geographic preferences, work authorization, historical applications, historical artifacts, interview history.

### 3.2 Application Lifecycle Support
Opportunity discovery → evaluation → tailoring → submission → recruiter interactions → interview prep → offer tracking → longitudinal analytics.

### 3.3 Event-Driven Orchestration
Asynchronous worker activation, event subscriptions, lifecycle transitions, runtime triggers, approval interruptions, digest generation.

### 3.4 Human Approval Governance
Prevent autonomous outbound actions. Provide review/edit cycles. Support artifact regeneration. Provide provenance visibility. Maintain approval history.

### 3.5 Shared Memory Access
Workers operate against shared candidate context, application context, artifact history, interaction history.

### 3.6 Longitudinal Learning
Accumulate intelligence around: candidate preferences, recruiter behavior, conversion rates, narrative success patterns, interview outcomes, market positioning.

---

## 4. Capability Model

### 4.1 Discovery Capabilities
**Workers:** Job Alert Aggregator, LinkedIn Optimizer
**Responsibilities:** opportunity ingestion, role ranking, keyword monitoring, recruiter visibility tracking, market signal aggregation.

### 4.2 Evaluation Capabilities
**Worker:** Resume Match Scorer
**Responsibilities:** CV vs JD evaluation, fit analysis, gap detection, qualification scoring.

### 4.3 Transformation Capabilities
**Workers:** Tailored Resume Builder, Cover Letter Generator
**Responsibilities:** role-specific artifact generation, narrative adaptation, positioning optimization.

### 4.4 Preparation Capabilities
**Workers:** Interview Prep Assistant, Company Research Assistant
**Responsibilities:** interview simulation, STAR preparation, company intelligence, recruiter preparation.

### 4.5 Tracking Capabilities
**Worker:** Application Tracker
**Responsibilities:** lifecycle tracking, reminders, status management, follow-up orchestration, digest generation.

### 4.6 (Future) Longitudinal Intelligence Capabilities
**Workers:** Narrative Performance Analyzer, Career Strategy Advisor, Compensation Trend Analyzer
**Responsibilities:** pattern detection, strategic recommendations, market positioning trends.

---

## 5. User Mental Model

The platform should feel like:
- an operational assistant,
- a career workspace,
- a persistent support system.

It should **not** feel like:
- autonomous AI,
- agent swarms,
- opaque automation.

The user should always understand: why something surfaced, what generated it, what context was used, what actions remain under their control.

The platform reduces repetition, fragmentation, organizational overhead, operational fatigue. It does not overwhelm with AI complexity, expose orchestration internals, or require workflow engineering.

---

## 6. Trust Operating Model

### 6.1 Approval Gate Enforcement
All outbound actions require: human review, human approval, optional editing.

### 6.2 Explainability
Generated artifacts expose: source context, rationale, missing information, confidence signals where appropriate.

### 6.3 Reversibility
The system supports: regeneration, version rollback, artifact comparison, revision history.

### 6.4 Provenance
Artifacts maintain: generation timestamps, source references, modification history.

---

## 7. Cognitive Access Governance

### 7.1 Scoped Memory Access
Workers access only the memory scopes relevant to their task. Examples:
- Interview prep accesses interview/application context.
- Resume tailoring accesses candidate profile + JD.
- Job alerts access role preferences.

### 7.2 Contextual Retrieval
Retrieval prioritizes: active applications, current candidate goals, recent recruiter interactions, relevant artifacts.

### 7.3 Artifact Visibility Rules
Artifacts maintain ownership boundaries, version lineage, contextual relationships.

---

## 8. Interaction Model

### 8.1 Event-Driven Interactions
System operates through: event generation, worker activation, review interruptions, digest surfacing.

### 8.2 Runtime Categories

**Always-On Workers** (continuous background): Job Alert Aggregator, LinkedIn Optimizer, Application Tracker. Characteristics: schedule-driven, event-reactive, low-interruption, digest-oriented.

**Per-Application Workers** (application-scoped): Resume Match Scorer, Tailored Resume Builder, Cover Letter Generator. Characteristics: highly contextual, artifact-heavy, application-bound, approval-driven.

**Per-Interview Workers** (recruiter/interview stage): Company Research Assistant, Interview Prep Assistant. Characteristics: recruiter-contextual, preparation-focused, time-sensitive, interaction-aware.

**Longitudinal Intelligence Workers** (future): Narrative Performance Analyzer, Career Strategy Advisor, Compensation Trend Analyzer. Characteristics: historical, pattern-oriented, analytics-driven, insight-generating.

### 8.3 Human Intervention Points
Approval gates, edit cycles, opportunity selection, submission decisions, negotiation decisions.

### 8.4 Notification Philosophy
Actionable, digest-oriented, minimally disruptive, context-rich.

---

## 9. Domain Model

| Entity | Definition |
|---|---|
| **Candidate** | Persistent user identity and career representation |
| **Opportunity** | External role/job representation |
| **Application** | Central operational object — pursuit of an opportunity |
| **Artifact** | Generated or uploaded content (resumes, cover letters, prep notes, recruiter replies) |
| **Recruiter** | External communication entity |
| **Interview** | Interview-stage workflow entity |
| **Event** | System trigger or lifecycle transition |
| **Insight** | Derived intelligence from accumulated history |

**The Application is the operational anchor.** Most meaningful events attach to an Application (or eventually become associated with one). The Application becomes the workflow boundary, memory boundary, orchestration boundary, artifact boundary, and analytics boundary.

---

## 10. Application Lifecycle State Machine

Twelve states:

1. **Discovered** — opportunity identified
2. **Shortlisted** — user expresses interest
3. **Evaluated** — fit scoring completed
4. **Tailoring** — resume/cover letter generation active
5. **Approved** — artifacts approved by candidate
6. **Submitted** — application submitted externally
7. **Recruiter Engaged** — recruiter interaction detected
8. **Interviewing** — interview workflows active
9. **Negotiating** — offer/recruiter negotiation phase
10. **Rejected** — opportunity closed unsuccessfully
11. **Accepted** — offer accepted
12. **Archived** — lifecycle completed and retained historically

---

## 11. Event Architecture

Events are the primary orchestration primitive. Workers do not directly invoke each other. Events emit → interested workers subscribe → state transitions occur → human approvals interrupt flow → platform evolves asynchronously.

### Event Categories

**Candidate Events:** `CandidateCreated`, `CandidateProfileUpdated`, `SkillAdded`, `TargetRoleUpdated`

**Opportunity Events:** `JobDiscovered`, `JobRanked`, `JobShortlisted`, `JobDismissed`

**Application Events:** `ApplicationCreated`, `ApplicationSubmitted`, `FollowUpScheduled`, `RejectionReceived`, `OfferReceived`

**Artifact Events:** `ResumeGenerated`, `ResumeApproved`, `CoverLetterGenerated`, `ArtifactArchived`

**Interview Events:** `RecruiterReplyDetected`, `InterviewScheduled`, `InterviewPrepGenerated`

**Governance Events:** `ApprovalRequested`, `ApprovalGranted`, `ApprovalRejected`, `OutboundActionBlocked`

**Insight Events:** `ConversionPatternDetected`, `SkillGapTrendDetected`

### Worker Runtime Contract

Workers receive: triggering event, scoped memory, active application context, candidate profile, relevant artifacts, governance constraints.

Workers emit: artifacts, recommendations, notifications, insights, state transitions, follow-up events.

Workers respect: memory boundaries, application scope, approval requirements, confidence constraints, outbound governance.

---

## 12. Memory Model

### 12.1 Memory Is The Product
The Career OS is fundamentally a persistent memory system with event-driven cognitive workers operating against that memory. The workers are replaceable. The memory graph is not.

### 12.2 Core Memory Categories

| Category | Examples | Characteristics |
|---|---|---|
| **Candidate Memory** | Master CV, skills, career history, education, prefs, goals, leadership narratives | Long-lived, frequently reused, shared across applications, slowly evolving |
| **Application Memory** | JD, fit score, tailored resume versions, cover letter versions, recruiter conversations, follow-up reminders, interview notes, offer details, rejection rationale | Highly contextual, operationally active, lifecycle-driven, event-connected |
| **Artifact Memory** | Resume variants, cover letter variants, STAR libraries, prep docs, LinkedIn summaries, thank-you drafts | Versioned, editable, regeneratable, approval-governed |
| **Interaction Memory** | Frequently rejected suggestions, preferred writing tone, editing patterns, preferred job categories, approval behaviors | Behavioral, adaptive, personalization-oriented, longitudinal |
| **Insight Memory** | High-performing narratives, strongest converting role families, interview weakness patterns, recruiter response trends | AI-derived, pattern-oriented, strategic, continuously evolving |

### 12.3 Memory Scopes

- **Global Candidate Scope** — persistent identity, preferences, foundational career info
- **Application Scope** — restricted to a single application lifecycle. *This is the primary operational memory boundary.*
- **Worker Runtime Scope** — temporary, scoped retrieval per worker invocation
- **Historical Scope** — long-term archived memory for analytics and pattern detection

### 12.4 Memory Lifecycle

Active → Dormant → Summarized → Archived → Derived

Not all memory remains equally relevant forever. Historical memory degrades in retrieval priority over time unless strategically relevant.

### 12.5 Conceptual Memory Architecture

Hybrid:
- **Structured memory** — deterministic operational data (applications, statuses, companies, recruiters, events, timelines, reminders). Relational, query-oriented.
- **Semantic memory** — unstructured contextual understanding (resumes, cover letters, recruiter conversations, interview notes, STAR stories). Embedding-oriented, retrieval-based.
- **Derived memory** — AI-generated intelligence synthesized from patterns (positioning strengths, recurring gaps, narrative performance, recruiter engagement patterns). Continuously evolving.

**Avoid:** flat vector dumping, stateless prompting, globally injected context.

### 12.6 Memory Ownership & Governance
The candidate (me) owns uploaded artifacts, generated artifacts, profile data, interaction history. Memory should be editable, archivable, and visibly controllable.

AI-derived insights remain assistive, non-authoritative, and reviewable. Never presented as objective truth.

---

## 13. Worker Runtime Model

### 13.1 What Workers Are
Workers are **specialized cognitive functions** — bounded, scoped, event-driven, operationally constrained. They are **not autonomous digital employees**.

Each worker performs a specific cognitive responsibility: evaluation, transformation, enrichment, preparation, tracking, or insight generation.

### 13.2 Workers Are Stateless Executors Over Stateful Memory
Workers themselves remain operationally lightweight. Persistent state belongs to the candidate memory layer, application memory, artifact history, and the event system. Workers consume scoped memory. Workers do not become memory silos.

### 13.3 Workers Coordinate Through Events
Workers subscribe to events, process scoped context, emit outputs, and generate follow-up events. This preserves composability, scalability, extensibility, explainability.

### 13.4 Worker Runtime Lifecycle

1. **Event Trigger** — worker activates due to system event, user action, schedule, lifecycle transition, or external signal
2. **Context Resolution** — orchestration layer resolves application scope, candidate scope, artifact scope, lifecycle state, governance constraints, retrieval priorities
3. **Scoped Retrieval** — worker retrieves only relevant context, artifacts, recent interactions, operationally necessary memory
4. **Cognitive Execution** — worker analyzes, transforms, evaluates, summarizes, generates, or enriches context
5. **Output Generation** — emits artifacts, recommendations, notifications, summaries, insights, or state transition requests
6. **Governance Interruption** — outputs enter approval, editing, or regeneration flows if required
7. **Event Emission** — worker emits follow-up events, lifecycle transitions, notifications, or insight updates

### 13.5 Failure & Retry Philosophy
Failures must not corrupt application state, must not lose memory lineage, must not bypass governance. Failures should be retryable, observable, event-visible.

### 13.6 Cost & Runtime Philosophy
Eventually support: runtime prioritization, deferred execution, selective retrieval, model routing, cost-aware cognition. Not all workers require the same intelligence depth.

---

## 14. Artifact Lifecycle Model

### 14.1 Core Artifact Types
Tailored resumes, cover letters, STAR answer sets, interview prep packets, recruiter responses, thank-you emails, LinkedIn summaries, negotiation drafts.

### 14.2 Lifecycle
1. **Generated** — initial artifact produced by a worker
2. **Reviewed** — candidate reviews generated output
3. **Edited** — candidate modifies content
4. **Approved** — candidate approves artifact for use
5. **Submitted / Used** — artifact used externally
6. **Archived** — artifact retained historically
7. **Regenerated** — new variant produced while retaining lineage

### 14.3 Versioning
Artifacts maintain: version lineage, timestamps, associated applications, generation context, approval history. Platform supports comparisons, rollback, iterative refinement.

### 14.4 Regeneration Philosophy
Regeneration preserves lineage, maintains historical context, avoids destructive overwrites. The system distinguishes between revision, regeneration, and manual editing.

---

## 15. Human Approval Governance Model

### 15.1 Foundational Philosophy
The system assists. The human decides.

Workers may: recommend, draft, summarize, prepare.
Workers do **not** autonomously: apply, communicate externally, negotiate, alter external identity.

### 15.2 Approval Boundaries
Approval gates exist before: application submission, recruiter responses, LinkedIn modifications, interview commitments, externally visible communications.

### 15.3 Approval States
draft, pending review, approved, rejected, regenerated, archived.

### 15.4 Explainability
Approval surfaces expose: what generated the output, what context was used, what assumptions were made, why recommendations occurred.

### 15.5 Confidence & Risk
Higher-risk actions require stronger review visibility, clearer provenance, more explicit approval. Examples: recruiter communications, comp negotiations, public profile changes.

---

## 16. Information Architecture

### 16.1 Primary Workspace Objects
Candidate Workspace, Applications, Opportunities, Artifacts, Interviews, Notifications, Insights.

### 16.2 Operational Center
The **Application** is the primary operational workspace. Applications act simultaneously as memory containers, workflow containers, artifact containers, interaction containers.

Most user activity converges around active applications.

### 16.3 Primary Navigation

| Area | Purpose |
|---|---|
| Dashboard | Operational overview |
| Opportunities | Discovered and shortlisted jobs |
| Applications | Active application workflows |
| Interviews | Interview-stage workflows |
| Artifacts | Generated resumes, cover letters, prep docs |
| Insights | Longitudinal career intelligence |
| Profile | Persistent candidate memory and preferences |

### 16.4 Dashboard
Prioritizes: actionable state, pending approvals, recruiter activity, upcoming interviews, operational urgency.
Avoids: excessive analytics, noisy AI activity feeds, orchestration internals.

### 16.5 Progressive Disclosure
Beginner users experience simplicity, operational guidance, low cognitive load. Advanced users later access deeper controls, memory visibility, workflow customization.

### 16.6 Most Important IA Insight
The platform should feel like **a coherent career workspace**. Not a collection of AI tools.

---

## 17. UX/System Flows

### 17.1 Candidate Onboarding
Initialize persistent candidate memory.
1. Create workspace
2. Upload Master CV
3. Define target roles, industries, comp expectations, geographic prefs, work authorization
4. System initializes candidate memory
5. Job discovery systems activate

### 17.2 Job Discovery
Surface relevant opportunities continuously.
1. Ingestion systems discover opportunities
2. Opportunities ranked against candidate profile
3. Daily digest generated
4. Candidate shortlists / dismisses / ignores
5. Shortlisting emits application initialization events

### 17.3 Application
Operationalize candidate pursuit of a role.
1. Candidate selects opportunity → 2. Application created → 3. Match scorer evaluates fit → 4. Resume generation activates → 5. Cover letter generation activates → 6. Candidate reviews → 7. Candidate edits/regenerates if needed → 8. Candidate approves → 9. Candidate submits externally → 10. Application transitions to Submitted

### 17.4 Recruiter Engagement
Activate interview-stage cognition.
1. Recruiter response detected → 2. Engagement event emitted → 3. Interview prep workers activate → 4. Company research generated → 5. Interview prep generated → 6. Follow-up reminders scheduled → 7. Candidate tracks progress

### 17.5 Interview Workflow
1. Interview scheduled → 2. Interview workspace activated → 3. STAR stories surfaced → 4. Company research generated → 5. Candidate reviews prep → 6. Notes captured → 7. Outcomes recorded

### 17.6 Offer Workflow
1. Offer detected/entered → 2. Compensation details captured → 3. Negotiation prep generated → 4. Candidate compares opportunities → 5. Candidate accepts or rejects → 6. Lifecycle finalized

---

## 18. Dashboard Model

### Primary Sections
- **Active Applications** — current operational opportunities
- **Pending Approvals** — artifacts awaiting review
- **Recruiter Activity** — recent recruiter interactions
- **Upcoming Interviews** — scheduled interviews + preparation readiness
- **Opportunity Digest** — newly discovered opportunities
- **Follow-Up Alerts** — applications requiring action
- **Strategic Insights** — longitudinal intelligence + recommendations

### Prioritization Order
1. Operational urgency
2. Recruiter responsiveness
3. Pending approvals
4. Upcoming deadlines
5. Active interview loops

---

## 19. Notification & Digest Model

### Notification Categories
- **High Urgency** — recruiter response, interview scheduling, pending submission deadlines
- **Medium Urgency** — pending approvals, follow-up reminders, artifact review requests
- **Low Urgency** — LinkedIn suggestions, market insights, longitudinal recommendations

### Digest Philosophy
Summarize new opportunities, recruiter activity, follow-up tasks, interview timelines, operational priorities. Reduces notification fatigue.

---

## 20. Workspace Model

### Workspace Hierarchy
- **Candidate Workspace** (top-level): profile, opportunities, applications, insights, historical memory
- **Application Workspace** (operational execution container): JD, tailored artifacts, recruiter activity, interview prep, lifecycle history
- **Interview Workspace** (sub-context within applications): schedules, prep materials, notes, feedback

### Cross-Application Views
Active pipeline views, recruiter engagement comparisons, application health summaries, historical conversion visibility.

---

## 21. Review & Approval UX Model

### Approval Actions
approve, reject, edit, regenerate, compare, archive.

### Approval UX Properties
Lightweight, confidence-building, editable, transparent. Reinforces: user control, explainability, reversibility.

### Explainability Surfaces
Approval surfaces expose: generation context, rationale, source memory, relevant assumptions.

---

## 22. Behavior Specifications (examples)

### Recruiter Reply
When recruiter communication is detected: emit recruiter engagement event → update application state → activate interview prep workers → notify candidate.

### Resume Rejection
When candidate rejects generated resume: update artifact state → permit regeneration → preserve lineage → pause approval flow.

### Stale Application
When application inactivity threshold exceeded: generate follow-up reminder → update dashboard urgency → prioritize digest inclusion.

### Offer Received
When offer detected: update application state → activate negotiation workflows → surface comparative insights.

---

## 23. Most Important Product Insights

1. **The Application is the operational center.** It is simultaneously the workflow container, memory boundary, orchestration boundary, artifact boundary, interaction boundary, and analytics boundary.
2. **Events are the primary orchestration primitive.** The system is event-driven, asynchronous, and stateful. Workers coordinate through events — never directly.
3. **Memory is the moat.** The true long-term value is persistent candidate understanding, longitudinal intelligence, and adaptive personalization. Workers are interchangeable.
4. **Workers are runtime capabilities, not autonomous agents.** They are bounded cognitive runtimes operating over persistent memory, coordinated through events, governed through human approval.
5. **Human governance is foundational.** The system assists. The human decides. Approval, editability, explainability, and reversibility are foundational principles.

---

## 24. Scope for v1 (solo build, single-tenant)

### In scope
- Persistent candidate memory layer (Master CV, role prefs, goals, history)
- Application lifecycle state machine (all 12 states)
- Event bus + scoped worker runtime
- All 8 workers (with v1 quality bars described in `ROADMAP.md`)
- Human approval gate on every outbound action
- Dashboard, Applications, Opportunities, Interviews, Artifacts, Profile UI
- Manual job paste fallback for every always-on worker

### Out of scope for v1
- Multi-tenant / multi-user
- Auto-submit / auto-send (read-only outbound)
- Longitudinal Intelligence workers (Narrative Performance, Career Strategy, Comp Trend) — schema reserves space; capability deferred
- Mobile-first UX (desktop-first v1)
- Delegated approval, auto-approval, confidence-based recommendations
- Auto-LinkedIn write access

---

## 25. Open product questions

- Default scraping strategy for Job Alert Aggregator (self-host vs. third party)?
- Email integration: read-only (recruiter reply detection) vs. fully managed inbox?
- LinkedIn: API vs. scrape vs. manual paste? Probably manual for v1.
- Confidence thresholds for surfacing recommendations?
- Memory aging/summarization policy specifics?
- Vector vs. relational retrieval split — exact boundary?
- Artifact retention policy — every version forever, or aged out?
