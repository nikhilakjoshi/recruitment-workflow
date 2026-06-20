import type { Metadata } from "next";
import { Logo } from "@/components/logo";

const LOGO_SVG_INLINE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="star-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" /></svg>`;

export const metadata: Metadata = {
  title: "Career OS — Walkthrough",
  description:
    "A Sunday-evening-through-following-Sunday walk through Career OS. One job seeker, one week, one loop.",
};

export default function WalkthroughPage() {
  return (
    <>
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: STYLES,
        }}
      />
      <div className="cos-walk">
        <div className="page">
          <header className="hero">
            <div className="brand">
              <Logo className="star-svg" />
              <span>career os</span>
              <span className="brand-sub">/ walkthrough</span>
            </div>
            <h1>One week with Career OS.</h1>
            <p className="dek">
              An end-to-end walk through what happens when a senior job seeker
              opens the app for the first time — every action, every system
              response, every place the AI meets the human. One person, one week,
              one loop.
            </p>

            <div className="persona-card">
              <h3>Meet Maya.</h3>
              <p>
                Senior Product Manager at a healthtech Series B, six years in.
                She&apos;s targeting <strong>Staff PM / Director PM</strong> at
                growth-stage startups and has applied to fifteen roles in the
                past two months — every one of them with a hand-edited resume
                that took ninety minutes. She&apos;s tired. Tonight she&apos;s
                going to try Career OS.
              </p>
              <div className="meta">
                <span>seat · <strong>Senior PM</strong></span>
                <span>targeting · <strong>Staff / Director PM</strong></span>
                <span>industries · <strong>Healthtech, B2B SaaS</strong></span>
                <span>geo · <strong>NYC + Remote</strong></span>
                <span>applied (8 wks) · <strong>15</strong></span>
              </div>
            </div>

            <div className="hero-cta">
              <a href="/signin" className="primary-cta">
                Sign in to try it <span className="arrow">→</span>
              </a>
              <span className="hero-cta-note">
                You&apos;ll need the seeded credentials. See your local{" "}
                <span className="mono">.env</span> for{" "}
                <span className="mono">AUTH_USER_EMAIL</span>.
              </span>
            </div>
          </header>

          {STEPS.map((step, idx) => (
            <section className="step" key={step.title}>
              <div className="step__narrative">
                <span className="step-num">
                  step {String(idx + 1).padStart(2, "0")}{" "}
                  <span className="total">· {STEPS.length}</span>
                </span>
                <h2>{step.title}</h2>
                {step.paragraphs.map((p, pi) => (
                  <p
                    key={pi}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: p }}
                  />
                ))}
                {step.whatHappens && step.whatHappens.length > 0 && (
                  <div className="what-happens">
                    <div className="wh-label">what happens under the hood</div>
                    {step.whatHappens.map((wh, whi) => (
                      <p
                        key={whi}
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: wh }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="mock">
                <div className="mock-chrome">
                  <div className="dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="url">{step.mockUrl}</span>
                </div>
                <div
                  className="mock-body"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: step.mockHtml }}
                />
              </div>
            </section>
          ))}

          <footer className="closing">
            <h2>That&apos;s the loop.</h2>
            <p>
              The point of Career OS is not to apply faster. The point is to
              make every application carry forward what the last one taught.
              The memory accumulates. The drafts get better. The narrative
              sharpens. You stay the decision-maker — the AI does the
              operational fatigue.
            </p>
            <div className="closing-cta">
              <a href="/signin" className="primary-cta">
                Sign in <span className="arrow">→</span>
              </a>
              <a href="/profile" className="ghost-cta">
                Or jump to setup
              </a>
            </div>
            <div className="footer-meta">
              <span>career os</span>
              <span className="dim">·</span>
              <span>single-user · single-tenant</span>
              <span className="dim">·</span>
              <span>v1 walkthrough</span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

type Step = {
  title: string;
  paragraphs: string[];
  whatHappens?: string[];
  mockUrl: string;
  mockHtml: string;
};

const STEPS: Step[] = [
  {
    title: "Sunday, 9:14pm. She opens the app.",
    paragraphs: [
      "Maya finishes the dishes and opens the laptop on the kitchen counter. The week ahead has two roles she actually wants — both went up Friday. She&apos;s been here before: open the JD, open her resume, start the ninety-minute rewrite.",
      "Tonight she&apos;s going to try the new thing. She types the URL, hits enter. The sign-in screen has one field, one field, one button. No marketing. No demo CTA. Good.",
    ],
    whatHappens: [
      "<span class='mono'>POST /api/auth/signin</span> verifies bcrypt hash against User.passwordHash.",
      "iron-session cookie issued, 30-day expiry, HttpOnly + SameSite=Lax.",
      "Middleware-equivalent redirect to <span class='mono'>/profile</span> because RolePreference is missing.",
    ],
    mockUrl: "localhost:4000/signin",
    mockHtml: signinMock(),
  },
  {
    title: "Setup, once. The system needs to know who she is.",
    paragraphs: [
      "She lands on Profile with a soft banner: <em>before you can shortlist anything, the system needs to know what you&apos;re looking for.</em> Two things on the page: upload your Master CV, and fill in role preferences.",
      "She drags her existing resume PDF into the uploader — the one she&apos;s been tweaking for eight weeks. It uploads to private storage and becomes the <strong>canonical memory of her career</strong> that every worker reads from. She fills the form: target roles, industries, comp range, geo, work auth. Hits Save.",
    ],
    whatHappens: [
      "PDF goes to GCS at <span class='mono'>master-cv/&lt;userId&gt;-&lt;ts&gt;.pdf</span>, private bucket.",
      "<span class='mono'>MasterCV.gcsUri</span> set; <span class='mono'>rawText</span> extracted for embeddings.",
      "<span class='mono'>RolePreference</span> upserted; <span class='mono'>CANDIDATE_PROFILE_UPDATED</span> event emitted.",
    ],
    mockUrl: "localhost:4000/profile",
    mockHtml: profileMock(),
  },
  {
    title: "Monday, 8:31am. She pastes a real JD.",
    paragraphs: [
      "She found a Series C healthtech role over the weekend. Director of Product, NYC + Remote, comp band $260-340k. The kind of role she&apos;d apply to.",
      "She clicks <strong>Opportunities → Add manually</strong>, pastes the title, company, the JD body. Three fields. Saves. The row drops into the list with a single action: <strong>Shortlist</strong>.",
    ],
    whatHappens: [
      "<span class='mono'>Opportunity</span> row inserted, state defaults to <span class='mono'>DISCOVERED</span>.",
      "<span class='mono'>JOB_DISCOVERED</span> event emitted, written to append-only Event log.",
      "No worker fires yet — discovery alone is just inventory.",
    ],
    mockUrl: "localhost:4000/opportunities",
    mockHtml: opportunitiesMock(),
  },
  {
    title: "One click. Now it's an application.",
    paragraphs: [
      "She clicks <strong>Shortlist</strong>. The row gets a state badge — <em>SHORTLISTED</em> — and a link to a freshly-created Application workspace.",
      "She doesn&apos;t need to do anything else right now. The next minute is the system&apos;s.",
    ],
    whatHappens: [
      "<span class='mono'>JOB_SHORTLISTED</span> emitted with <span class='mono'>opportunityId</span>.",
      "Subscriber <span class='mono'>application-creator</span> creates an <span class='mono'>Application</span> row, snapshots current RolePreference into <span class='mono'>targetRoleSnapshot</span>, transitions to <span class='mono'>SHORTLISTED</span>.",
      "<span class='mono'>APPLICATION_CREATED</span> emitted — the next worker is already listening.",
    ],
    mockUrl: "localhost:4000/applications",
    mockHtml: applicationsListMock(),
  },
  {
    title: "Within 90 seconds, the evaluation lands.",
    paragraphs: [
      "She opens the workspace. The header shows the JD, the state, the dates. To the right of the JD is a panel that wasn&apos;t there a minute ago: <strong>Match Evaluation</strong>.",
      "<strong>78 — STRONG fit. Confidence: high.</strong> Three strengths cite specific bullets from her CV that map onto the JD. Three gaps note what the JD requires that her CV doesn&apos;t address. One paragraph of rationale.",
    ],
    whatHappens: [
      "<span class='mono'>match-scorer</span> worker fired on <span class='mono'>APPLICATION_CREATED</span>.",
      "<span class='mono'>resolveScopedMemory()</span> loads Master CV + role prefs + JD into the prompt, with Master CV marked for prompt-cache reuse.",
      "Sonnet 4.6 returns structured JSON validated by zod. <span class='mono'>fit</span> label recomputed deterministically from <span class='mono'>score</span>.",
      "Application transitions <span class='mono'>SHORTLISTED → EVALUATED</span>; <span class='mono'>EVALUATION_GENERATED</span> emitted.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9...",
    mockHtml: evaluationMock(),
  },
  {
    title: "The tailored resume appears, with reasons.",
    paragraphs: [
      "Another minute. The Artifacts tab now shows a <strong>Tailored Resume</strong> in <em>PENDING_REVIEW</em>. She clicks in.",
      "Opus has reordered her experience to lead with the metrics that map onto this JD&apos;s requirements. Each bullet has two extra fields: <strong>rationale</strong> (why this bullet is here) and <strong>evidenceFromMasterCV</strong> (the exact source fragment). No invented qualifications. Everything traces back.",
    ],
    whatHappens: [
      "<span class='mono'>tailored-resume-builder</span> fired on <span class='mono'>EVALUATION_GENERATED</span>, scope includes Master CV + JD + the evaluation just generated.",
      "Opus 4.7 returns structured resume JSON (sections, bullets, rationales). Zod validates.",
      "Artifact written in <span class='mono'>DRAFT</span> → moved to <span class='mono'>PENDING_REVIEW</span>; <span class='mono'>RESUME_GENERATED</span> emitted.",
      "react-pdf renders the JSON to PDF, uploads to GCS, sets <span class='mono'>Artifact.gcsUri</span>.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9.../artifacts/v1",
    mockHtml: resumeMock(),
  },
  {
    title: "One bullet doesn't feel right. She fixes it.",
    paragraphs: [
      "One bullet in the Experience section reads true but flat. She clicks the bullet, hits <strong>AI rewrite</strong> with the prompt &ldquo;more outcome-oriented, lead with the impact metric.&rdquo; The bullet rewrites in place, keeping the rationale + evidence trace.",
      "She saves as a new version. The prior version is preserved — the lineage is part of the memory. Approval gate disabled on v1, enabled on v2.",
    ],
    whatHappens: [
      "Per-bullet rewrite goes through Sonnet (cheaper than Opus, single bullet is small).",
      "New Artifact row inserted with <span class='mono'>versionNumber=2</span>, <span class='mono'>parentVersionId=v1.id</span>, state <span class='mono'>DRAFT → PENDING_REVIEW</span>.",
      "Side-by-side diff renders v1 vs v2 in the approval gate&apos;s Compare view.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9.../artifacts/v2",
    mockHtml: resumeEditMock(),
  },
  {
    title: "Approve. The cover letter starts.",
    paragraphs: [
      "She approves v2. The Approval Gate posts the artifact to state <em>APPROVED</em>, sets <span class='mono'>approvedAt</span>, emits <span class='mono'>RESUME_APPROVED</span>.",
      "That event has a subscriber. The Cover Letter Generator picks it up before she&apos;s finished closing the modal.",
    ],
    whatHappens: [
      "Approval is a system primitive — DB-enforced. No code path writes <span class='mono'>state='APPROVED'</span> outside <span class='mono'>lib/artifacts/transitions.ts</span>.",
      "<span class='mono'>cover-letter-generator</span> reads scope: Master CV + role prefs + JD + evaluation + the just-approved resume.",
      "Opus 4.7 returns a 4-paragraph cover letter (Opening / Why Me / Why You / Close). Validated, persisted, rendered to PDF.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9.../approval-gate",
    mockHtml: approvalGateMock(),
  },
  {
    title: "The cover letter is short, specific, evidence-based.",
    paragraphs: [
      "Four paragraphs. Each one labeled. The <em>Why Me</em> paragraph references two specific bullets from the resume she just approved. The <em>Why You</em> paragraph cites one piece of recent company news. The <em>Close</em> acknowledges one gap from the evaluation as a stretch — honestly, growth-oriented.",
      "She edits a single sentence in the Opening to match her voice. Saves as v2. Approves.",
    ],
    whatHappens: [
      "<span class='mono'>COVER_LETTER_APPROVED</span> emitted.",
      "<span class='mono'>application-approved-finalizer</span> worker checks: is the tailored resume also approved? Yes. Transitions Application <span class='mono'>TAILORING → APPROVED</span>.",
      "Both PDFs sit in GCS, signed-URL accessible.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9.../artifacts/cover-letter-v2",
    mockHtml: coverLetterMock(),
  },
  {
    title: "She submits externally. The system tracks it.",
    paragraphs: [
      "Career OS does <strong>not</strong> submit to the company&apos;s job board. That&apos;s the user&apos;s decision and the user&apos;s action. She downloads the two PDFs, opens the company&apos;s ATS form in another tab, uploads them, hits the company&apos;s Submit button.",
      "Comes back to the Career OS workspace. Clicks <strong>Mark Submitted</strong>. The state advances; the application enters the long-running half of its lifecycle.",
    ],
    whatHappens: [
      "<span class='mono'>transition(applicationId, 'SUBMITTED', { actor: 'user' })</span>.",
      "<span class='mono'>submittedAt</span> set; <span class='mono'>APPLICATION_SUBMITTED</span> emitted.",
      "<span class='mono'>application-tracker</span> worker now monitors this application for staleness against the SUBMITTED threshold (14 days).",
    ],
    mockUrl: "localhost:4000/applications/cm5k9...",
    mockHtml: submittedMock(),
  },
  {
    title: "Thursday afternoon. A recruiter replies.",
    paragraphs: [
      "Three days later Maya gets a recruiter email — they want a 30-minute intro call next Tuesday. She comes back to the workspace, clicks <strong>Recruiter replied</strong>, pastes the body, fills the recruiter&apos;s name, hits save.",
      "Two artifacts begin generating before she&apos;s closed the modal.",
    ],
    whatHappens: [
      "<span class='mono'>RECRUITER_REPLY_DETECTED</span> emitted; Application transitions <span class='mono'>SUBMITTED → RECRUITER_ENGAGED</span>.",
      "<span class='mono'>company-research-assistant</span> fires: pulls the company&apos;s last 90 days of news via Brave Search, summarizes business model + recent signals + 5 smart questions.",
      "<span class='mono'>interview-prep-assistant</span> fires once <span class='mono'>INTERVIEW_SCHEDULED</span> is added — for now it waits for her to log the time.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9.../recruiter-reply",
    mockHtml: recruiterReplyMock(),
  },
  {
    title: "Tuesday 10:30am. Phone screen.",
    paragraphs: [
      "Maya opens the Interview workspace ten minutes before the call. The <strong>Prep</strong> tab has eighteen expected questions across behavioral / technical / leadership / culture, each with rationale and STAR scaffolding using her actual career history.",
      "She clicks the <strong>Notes</strong> tab. The call starts. She types as the recruiter talks — autosave every five seconds. After they hang up she clicks the <strong>Outcome</strong> tab, picks <em>WEAK_YES</em>, writes two sentences of reflection. Done.",
    ],
    whatHappens: [
      "<span class='mono'>Interview</span> row created at scheduling; <span class='mono'>sessionNotes</span> autosaved via debounced server action.",
      "Outcome enum stored on <span class='mono'>Interview.outcomeJson</span>; <span class='mono'>INTERVIEW_COMPLETED</span> emitted.",
      "If outcome were a NO, the system would offer (not auto) the option to transition Application to <span class='mono'>REJECTED</span>.",
    ],
    mockUrl: "localhost:4000/applications/cm5k9.../interviews/cm5kq...",
    mockHtml: interviewMock(),
  },
  {
    title: "Sunday morning. Dashboard tells her the story.",
    paragraphs: [
      "A week later — twelve applications in flight, three in conversation, one onsite loop scheduled. Maya opens the dashboard with coffee.",
      "<strong>Funnel</strong>: Discovered → Shortlisted → Submitted → Interviewing → Offered. Conversion percentages between each. <strong>Pending Approvals</strong>: two cover letters waiting on her. <strong>Follow-Up Alerts</strong>: a Series B that&apos;s been silent for fourteen days, suggested action <em>follow up with the recruiter</em>.",
    ],
    whatHappens: [
      "Dashboard is a server component reading Application + Artifact + Event + FollowUp rows.",
      "<span class='mono'>application-tracker</span> ran on the 9am UTC cron, populated stale FollowUp rows.",
      "Weekly digest worker is scheduled for Sundays 9am UTC — narrative summary written to Insight table.",
    ],
    mockUrl: "localhost:4000/",
    mockHtml: dashboardMock(),
  },
  {
    title: "The longitudinal layer. The moat begins.",
    paragraphs: [
      "She scrolls down on the Insights page. A panel labeled <strong>Narrative themes — AI-derived, non-authoritative</strong> lists three recurring positionings across her last thirty approved tailored resumes: <em>&ldquo;turning ambiguous problems into shipped product&rdquo;</em>, <em>&ldquo;cross-functional driver across eng + design + clinical&rdquo;</em>, <em>&ldquo;data-driven decisions over instinct&rdquo;</em>.",
      "The first two themes correlate with her highest fit-score applications. The third correlates with her best recruiter response rate. None of this required new ML — the system mined what she had already approved.",
      "She closes the laptop. The week ahead has two roles she actually wants. This time she has a head start.",
    ],
    whatHappens: [
      "<span class='mono'>narrative-theme-extractor</span> runs Sundays 10am UTC, reads last 30 approved <span class='mono'>TAILORED_RESUME</span> artifacts, asks Sonnet what positionings recur.",
      "Output written to <span class='mono'>Insight</span> with type <span class='mono'>NARRATIVE_THEME</span>, flagged as AI-derived.",
      "Future workers will read these insights into their scoped memory — the moat is the memory, not the worker.",
    ],
    mockUrl: "localhost:4000/insights",
    mockHtml: insightsMock(),
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Mock screen HTML helpers — kept inline so the page is one file
// ────────────────────────────────────────────────────────────────────────────

function signinMock(): string {
  return `
    <div class="signin-mock">
      <div class="brand-mini">${LOGO_SVG_INLINE} career os</div>
      <h4>Sign in</h4>
      <p class="signin-sub">Single-user, single-tenant. By invitation.</p>
      <div class="field"><div class="label">email</div><div class="input">me@example.com</div></div>
      <div class="field"><div class="label">password</div><div class="input">••••••••••••</div></div>
      <div class="btn">Sign in</div>
    </div>
  `;
}

function profileMock(): string {
  return appShell(
    "/profile",
    "Profile",
    `
      <div class="card">
        <div class="card-title">Master CV</div>
        <div class="upload-zone">
          <div class="upload-icon">↑</div>
          <div class="upload-text">drop your resume PDF here</div>
          <div class="upload-sub mono">10mb max · private storage</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Role preferences</div>
        <div class="form-row"><span class="form-label mono">target roles</span><span class="form-val">Staff PM, Director PM</span></div>
        <div class="form-row"><span class="form-label mono">industries</span><span class="form-val">Healthtech, B2B SaaS</span></div>
        <div class="form-row"><span class="form-label mono">comp range</span><span class="form-val">$260k – $340k</span></div>
        <div class="form-row"><span class="form-label mono">geo</span><span class="form-val">NYC, Remote</span></div>
        <div class="form-row"><span class="form-label mono">remote</span><span class="form-val">Hybrid or Remote</span></div>
        <div class="btn small">Save</div>
      </div>
    `,
  );
}

function opportunitiesMock(): string {
  return appShell(
    "/opportunities",
    "Opportunities",
    `
      <div class="row-head">
        <div class="page-title">Opportunities</div>
        <div class="btn small ghost">+ add manually</div>
      </div>
      <div class="tbl">
        <div class="tbl-head"><span>title</span><span>company</span><span>source</span><span>state</span><span></span></div>
        <div class="tbl-row focus">
          <span>Director of Product</span>
          <span>Brightline</span>
          <span class="mono">manual</span>
          <span class="badge">discovered</span>
          <span class="btn xs">shortlist</span>
        </div>
        <div class="tbl-row">
          <span>Group PM, Platform</span>
          <span>Plaid</span>
          <span class="mono">linkedin</span>
          <span class="badge submitted">submitted</span>
          <span></span>
        </div>
      </div>
    `,
  );
}

function applicationsListMock(): string {
  return appShell(
    "/applications",
    "Applications",
    `
      <div class="page-title">Applications · 3 active</div>
      <div class="app-row">
        <div class="app-row-l">
          <div class="app-row-title">Director of Product · Brightline</div>
          <div class="app-row-sub mono">created just now · NYC + Remote · $260-340k</div>
        </div>
        <div class="badge new">shortlisted</div>
      </div>
      <div class="app-row">
        <div class="app-row-l">
          <div class="app-row-title">Group PM, Platform · Plaid</div>
          <div class="app-row-sub mono">submitted 3d ago</div>
        </div>
        <div class="badge submitted">submitted</div>
      </div>
    `,
  );
}

function evaluationMock(): string {
  return appShell(
    "/applications/...",
    "Director of Product · Brightline",
    `
      <div class="split">
        <div class="card">
          <div class="card-title">Job description</div>
          <p class="jd-text">We&apos;re hiring a Director of Product to own our virtual-first care platform. You&apos;ll lead a team of three PMs, partner with clinical &amp; engineering leadership, and ship the next generation of our care delivery model…</p>
        </div>
        <div class="card eval">
          <div class="card-title">Match evaluation</div>
          <div class="score-line">
            <div class="score">78</div>
            <div class="score-meta">
              <div class="fit-label strong">STRONG fit</div>
              <div class="conf mono">confidence: high</div>
            </div>
          </div>
          <div class="score-bar"><div class="score-bar-fill" style="width:78%"></div></div>
          <div class="eval-section">
            <div class="eval-h mono">strengths</div>
            <ul>
              <li>Led 0→1 launch of healthtech consumer app, 240k MAU in 9mo</li>
              <li>Cross-functional ownership across eng + clinical + design</li>
              <li>Comfortable in regulated environments — HIPAA, FDA</li>
            </ul>
          </div>
          <div class="eval-section">
            <div class="eval-h mono">gaps</div>
            <ul class="gaps">
              <li>No prior people-management at the Director scope</li>
              <li>JD asks for B2B2C — Maya&apos;s experience is consumer-first</li>
            </ul>
          </div>
        </div>
      </div>
    `,
  );
}

function resumeMock(): string {
  return appShell(
    "/applications/.../artifacts",
    "Tailored Resume · v1",
    `
      <div class="resume-mock">
        <div class="resume-head">
          <div class="resume-name">Maya Chen</div>
          <div class="resume-contact mono">maya.chen@email.com · NYC · linkedin.com/in/mayac</div>
        </div>
        <div class="resume-section">
          <div class="resume-section-h">Experience</div>
          <div class="resume-bullet">
            <div class="bullet-text">Drove 0→1 launch of virtual care platform; scaled to 240k MAU in 9mo across 3 product surfaces.</div>
            <div class="bullet-rationale mono">↳ rationale: maps onto JD&apos;s &ldquo;next generation of care delivery model&rdquo; — leading with growth metric</div>
          </div>
          <div class="resume-bullet">
            <div class="bullet-text">Partnered with clinical &amp; ML teams to ship HIPAA-compliant care pathways, reducing time-to-care by 38%.</div>
            <div class="bullet-rationale mono">↳ rationale: JD calls out cross-functional + regulated env; this bullet hits both</div>
          </div>
        </div>
        <div class="resume-meta mono">
          <span>state · <strong>pending review</strong></span>
          <span>version · <strong>1</strong></span>
          <span>generated by · <strong>tailored-resume-builder · opus-4.7</strong></span>
        </div>
      </div>
    `,
  );
}

function resumeEditMock(): string {
  return appShell(
    "/applications/.../artifacts/v2",
    "Tailored Resume · v2 (editing)",
    `
      <div class="resume-mock">
        <div class="diff-row">
          <div class="diff-side diff-old">
            <div class="diff-label mono">v1</div>
            <div class="bullet-text">Partnered with clinical &amp; ML teams to ship HIPAA-compliant care pathways.</div>
          </div>
          <div class="diff-side diff-new">
            <div class="diff-label mono">v2 · ai-rewritten</div>
            <div class="bullet-text">Shipped HIPAA-compliant care pathways with clinical + ML — cut time-to-care from 14d to 9d (-38%) across 142 clinics.</div>
          </div>
        </div>
        <div class="hint mono">↳ AI rewrite: &ldquo;more outcome-oriented, lead with the impact metric&rdquo;</div>
        <div class="actions">
          <div class="btn xs ghost">discard</div>
          <div class="btn xs">save as v2</div>
        </div>
      </div>
    `,
  );
}

function approvalGateMock(): string {
  return appShell(
    "/applications/...",
    "Approval Gate",
    `
      <div class="modal-mock">
        <div class="modal-title">Tailored Resume · v2</div>
        <div class="modal-sub mono">PENDING_REVIEW · generated 47s ago · opus-4.7</div>
        <div class="modal-body">
          <div class="prose-line">Director of Product · Brightline (healthtech, Series C)</div>
          <div class="prose-line">3 sections · 11 bullets · 1 rewrite (v1 → v2)</div>
        </div>
        <div class="modal-actions">
          <div class="btn xs ghost">reject</div>
          <div class="btn xs ghost">edit</div>
          <div class="btn xs ghost">compare</div>
          <div class="btn xs primary">approve</div>
        </div>
      </div>
    `,
  );
}

function coverLetterMock(): string {
  return appShell(
    "/applications/.../cover-letter",
    "Cover Letter · v2",
    `
      <div class="letter-mock">
        <div class="letter-block">
          <div class="letter-label mono">opening</div>
          <div class="letter-text">Director of Product at Brightline — I&apos;m writing because the virtual-first care problem you&apos;re building toward is the same one I&apos;ve spent six years on, and I&apos;d like to bring what I&apos;ve learned…</div>
        </div>
        <div class="letter-block">
          <div class="letter-label mono">why me</div>
          <div class="letter-text">At my current role I shipped a HIPAA-compliant care pathway that cut time-to-care by 38% across 142 clinics. I led the same kind of cross-functional team you&apos;re hiring for — three PMs partnering with clinical &amp; ML…</div>
        </div>
        <div class="letter-block">
          <div class="letter-label mono">why you</div>
          <div class="letter-text">Your Series C announcement last month signaled an aggressive expansion into specialty care — exactly the surface I&apos;d want to own. Your published care-quality scores suggest a clinical-first culture I&apos;d thrive in…</div>
        </div>
        <div class="letter-block">
          <div class="letter-label mono">close</div>
          <div class="letter-text">I&apos;ll be candid: I haven&apos;t managed a team at the Director scope before. That&apos;s the stretch. The growth orientation is real and the evidence in the prior roles is concrete…</div>
        </div>
      </div>
    `,
  );
}

function submittedMock(): string {
  return appShell(
    "/applications/...",
    "Director of Product · Brightline",
    `
      <div class="state-banner">
        <div class="state-banner-l">
          <div class="banner-h">submitted</div>
          <div class="banner-sub mono">marked submitted by you · 2 min ago</div>
        </div>
        <div class="state-banner-r mono">tracker will check back in 14d</div>
      </div>
      <div class="tabs mono">
        <span class="tab">overview</span>
        <span class="tab active">artifacts</span>
        <span class="tab">interviews</span>
        <span class="tab">activity</span>
      </div>
      <div class="artifact-grid">
        <div class="artifact-tile approved"><div class="at-type mono">tailored resume</div><div class="at-state">approved</div><div class="at-action mono">download.pdf</div></div>
        <div class="artifact-tile approved"><div class="at-type mono">cover letter</div><div class="at-state">approved</div><div class="at-action mono">download.pdf</div></div>
        <div class="artifact-tile"><div class="at-type mono">evaluation</div><div class="at-state">approved</div><div class="at-action mono">view</div></div>
      </div>
    `,
  );
}

function recruiterReplyMock(): string {
  return appShell(
    "/applications/...",
    "Recruiter Replied",
    `
      <div class="modal-mock">
        <div class="modal-title">Log recruiter reply</div>
        <div class="modal-form">
          <div class="form-row"><span class="form-label mono">recruiter</span><span class="form-val">Sarah K. · Brightline</span></div>
          <div class="form-row"><span class="form-label mono">date</span><span class="form-val">today · 2:14pm</span></div>
          <div class="form-row col"><span class="form-label mono">body</span><div class="reply-body">Hi Maya — thanks for applying. We&apos;d love to do a quick 30 min intro call next Tue 10:30am. Are you free?…</div></div>
        </div>
        <div class="modal-actions">
          <div class="btn xs primary">save reply</div>
        </div>
      </div>
      <div class="hint mono">↳ this will fire company-research-assistant and (once you log the time) interview-prep-assistant</div>
    `,
  );
}

function interviewMock(): string {
  return appShell(
    "/applications/.../interviews/...",
    "Phone Screen · Tue 10:30am",
    `
      <div class="tabs mono">
        <span class="tab">prep</span>
        <span class="tab active">notes</span>
        <span class="tab">outcome</span>
      </div>
      <div class="notes-mock">
        <div class="notes-text">
          <p>↳ asked about scaling the care team across 142 clinics — gave the same answer I&apos;ve been refining for two weeks</p>
          <p>↳ they care a LOT about HIPAA compliance — emphasized my regulatory experience</p>
          <p>↳ they&apos;re hiring two PMs simultaneously, want a strong functional leader</p>
        </div>
        <div class="autosave mono">autosaved 4s ago</div>
      </div>
      <div class="outcome-strip mono">
        <span>outcome ·</span>
        <span class="outcome strong">strong yes</span>
        <span class="outcome weak">weak yes</span>
        <span class="outcome maybe">maybe</span>
        <span class="outcome no">no</span>
      </div>
    `,
  );
}

function dashboardMock(): string {
  return appShell(
    "/",
    "Dashboard",
    `
      <div class="funnel">
        <div class="funnel-stage"><div class="fs-bar" style="width:100%"></div><div class="fs-label mono">discovered · 28</div></div>
        <div class="funnel-stage"><div class="fs-bar" style="width:46%"></div><div class="fs-label mono">shortlisted · 13</div></div>
        <div class="funnel-stage"><div class="fs-bar" style="width:32%"></div><div class="fs-label mono">submitted · 9</div></div>
        <div class="funnel-stage"><div class="fs-bar" style="width:14%"></div><div class="fs-label mono">interviewing · 4</div></div>
        <div class="funnel-stage"><div class="fs-bar" style="width:4%"></div><div class="fs-label mono">offered · 1</div></div>
      </div>
      <div class="grid-2">
        <div class="card sm">
          <div class="card-title">Pending approvals · 2</div>
          <div class="mini-row">Cover letter · Plaid</div>
          <div class="mini-row">Tailored resume · Linear</div>
        </div>
        <div class="card sm">
          <div class="card-title">Follow-up alerts · 1</div>
          <div class="mini-row warn">Brightline · silent 14d · follow up</div>
        </div>
      </div>
    `,
  );
}

function insightsMock(): string {
  return appShell(
    "/insights",
    "Insights",
    `
      <div class="card">
        <div class="card-title">Narrative themes <span class="ai-flag mono">AI-derived · non-authoritative</span></div>
        <div class="theme">
          <div class="theme-h">Turning ambiguous problems into shipped product</div>
          <div class="theme-meta mono">appeared in 22 of 30 approved resumes · highest fit-score correlation</div>
        </div>
        <div class="theme">
          <div class="theme-h">Cross-functional driver across eng + design + clinical</div>
          <div class="theme-meta mono">appeared in 19 of 30 · best recruiter-response correlation</div>
        </div>
        <div class="theme">
          <div class="theme-h">Data-driven decisions over instinct</div>
          <div class="theme-meta mono">appeared in 14 of 30 · emergent in last 60d</div>
        </div>
      </div>
    `,
  );
}

function appShell(path: string, title: string, content: string): string {
  const navItems = [
    { label: "dashboard", href: "/" },
    { label: "opportunities", href: "/opportunities" },
    { label: "applications", href: "/applications" },
    { label: "interviews", href: "/interviews" },
    { label: "artifacts", href: "/artifacts" },
    { label: "insights", href: "/insights" },
    { label: "profile", href: "/profile" },
  ];
  const sidebar = navItems
    .map((it) => {
      const isActive = path === it.href || path.startsWith(it.href + "/");
      return `<div class="nav-item${isActive ? " active" : ""}"><span class="dot"></span>${it.label}</div>`;
    })
    .join("");
  return `
    <div class="shell">
      <div class="sidebar">
        <div class="brand-mini">${LOGO_SVG_INLINE}career os</div>
        ${sidebar}
      </div>
      <div class="main">
        <div class="topbar">
          <div class="breadcrumb mono">${title}</div>
          <div class="user">M</div>
        </div>
        <div class="content">${content}</div>
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────────────
// Styles — inline so the walkthrough is self-contained and won't clash with
// the rest of the app's Tailwind classes. Scoped via .cos-walk wrapper.
// ────────────────────────────────────────────────────────────────────────────
const STYLES = `
.cos-walk {
  --surface: var(--card);
  --surface-muted: var(--muted);
  --subtle-foreground: color-mix(in oklch, var(--muted-foreground) 65%, var(--background));
  --primary-soft: color-mix(in oklch, var(--primary) 12%, transparent);
  --primary-strong: color-mix(in oklch, var(--primary) 85%, black);
  --success: oklch(0.52 0.13 152);
  --success-soft: color-mix(in oklch, oklch(0.52 0.13 152) 14%, transparent);
  --warning: oklch(0.62 0.15 60);
  --warning-soft: color-mix(in oklch, oklch(0.62 0.15 60) 12%, transparent);
  --border-strong: var(--input);

  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
  min-height: 100vh;
}

.cos-walk * { box-sizing: border-box; }

.cos-walk .mono { font-family: var(--font-mono); }

.cos-walk .page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 64px 48px 96px;
}

/* hero */
.cos-walk header.hero {
  border-bottom: 1px solid var(--border);
  padding-bottom: 48px;
  margin-bottom: 56px;
}
.cos-walk header.hero .brand {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono);
  font-size: 13px; font-weight: 500;
  margin-bottom: 28px;
}
.cos-walk header.hero .brand .star-svg { color: var(--primary); width: 16px; height: 16px; stroke: currentColor; fill: none; }
.cos-walk header.hero .brand .brand-sub { color: var(--subtle-foreground); margin-left: 8px; }
.cos-walk header.hero h1 {
  font-size: 56px; font-weight: 600;
  letter-spacing: -0.03em; line-height: 1.05;
  max-width: 820px; margin-bottom: 18px;
}
.cos-walk header.hero p.dek {
  font-size: 18px; color: var(--muted-foreground);
  max-width: 720px; line-height: 1.55;
}

.cos-walk .persona-card {
  margin-top: 32px; padding: 24px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; max-width: 760px;
}
.cos-walk .persona-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.cos-walk .persona-card p {
  font-size: 14px; color: var(--muted-foreground); line-height: 1.6;
}
.cos-walk .persona-card .meta {
  display: flex; gap: 16px 20px; margin-top: 14px; flex-wrap: wrap;
}
.cos-walk .persona-card .meta span {
  font-family: var(--font-mono);
  font-size: 11px; color: var(--subtle-foreground);
}
.cos-walk .persona-card .meta strong { color: var(--foreground); font-weight: 500; }

.cos-walk .hero-cta {
  display: flex; align-items: center; gap: 18px; margin-top: 32px; flex-wrap: wrap;
}
.cos-walk .primary-cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 18px; background: var(--foreground);
  color: var(--background); text-decoration: none;
  border-radius: 8px; font-size: 14px; font-weight: 500;
  transition: background 0.15s ease;
}
.cos-walk .primary-cta:hover { background: var(--primary-strong); }
.cos-walk .primary-cta .arrow { transition: transform 0.15s ease; }
.cos-walk .primary-cta:hover .arrow { transform: translateX(2px); }
.cos-walk .ghost-cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 18px; color: var(--muted-foreground);
  text-decoration: none; border-radius: 8px;
  font-size: 14px; font-weight: 500;
  border: 1px solid var(--border);
  transition: color 0.15s ease, border-color 0.15s ease;
}
.cos-walk .ghost-cta:hover { color: var(--foreground); border-color: var(--border-strong); }
.cos-walk .hero-cta-note {
  font-size: 12px; color: var(--subtle-foreground);
  font-family: var(--font-mono);
}
.cos-walk .hero-cta-note .mono { color: var(--muted-foreground); }

/* step */
.cos-walk .step {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 56px;
  padding: 52px 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}
.cos-walk .step:last-of-type { border-bottom: none; }

.cos-walk .step__narrative h2 {
  font-size: 26px; font-weight: 600;
  letter-spacing: -0.02em; line-height: 1.2;
  margin: 12px 0 16px;
}
.cos-walk .step__narrative .step-num {
  font-family: var(--font-mono);
  font-size: 13px; font-weight: 600; color: var(--primary);
}
.cos-walk .step__narrative .step-num .total { color: var(--subtle-foreground); }
.cos-walk .step__narrative p {
  font-size: 15px; color: var(--muted-foreground);
  line-height: 1.65; margin-bottom: 14px;
}
.cos-walk .step__narrative p strong { color: var(--foreground); font-weight: 500; }
.cos-walk .step__narrative p em { color: var(--foreground); font-style: italic; }

.cos-walk .what-happens {
  margin-top: 22px; padding-top: 18px;
  border-top: 1px dashed var(--border);
}
.cos-walk .wh-label {
  font-family: var(--font-mono);
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--subtle-foreground);
  margin-bottom: 8px;
}
.cos-walk .what-happens p {
  font-family: var(--font-mono);
  font-size: 11.5px; line-height: 1.65;
  margin-bottom: 4px; color: var(--muted-foreground);
}
.cos-walk .what-happens p::before {
  content: '→ '; color: var(--primary); margin-right: 2px;
}
.cos-walk .what-happens .mono { color: var(--foreground); }

/* mock screens */
.cos-walk .mock {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(0,0,0,0.02), 0 12px 32px -16px rgba(0,0,0,0.08);
  position: sticky; top: 24px;
}
.cos-walk .mock-chrome {
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  padding: 8px 12px;
  display: flex; align-items: center; gap: 8px;
}
.cos-walk .mock-chrome .dots { display: flex; gap: 5px; }
.cos-walk .mock-chrome .dots span {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--border-strong);
}
.cos-walk .mock-chrome .url {
  font-family: var(--font-mono);
  font-size: 11px; color: var(--muted-foreground);
  margin-left: 6px;
}

.cos-walk .mock-body { font-size: 12px; }

/* app shell mock */
.cos-walk .shell {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: stretch;
  min-height: 360px;
}
.cos-walk .sidebar {
  background: var(--surface-muted);
  border-right: 1px solid var(--border);
  padding: 8px 6px;
  display: flex; flex-direction: column; gap: 1px;
}
.cos-walk .main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cos-walk .brand-mini {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 8px; font-family: var(--font-mono);
  font-size: 10px; border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}
.cos-walk .brand-mini .star-svg { color: var(--primary); width: 11px; height: 11px; stroke: currentColor; fill: none; margin-right: 3px; vertical-align: middle; }
.cos-walk .nav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px; color: var(--muted-foreground);
}
.cos-walk .nav-item.active {
  background: var(--surface);
  color: var(--foreground); font-weight: 500;
}
.cos-walk .nav-item .dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: currentColor; opacity: 0.45;
}

.cos-walk .topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.cos-walk .topbar .breadcrumb {
  font-family: var(--font-mono);
  font-size: 11px; color: var(--muted-foreground);
}
.cos-walk .topbar .user {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--primary-soft); color: var(--primary);
  font-size: 10px; font-weight: 500;
  display: flex; align-items: center; justify-content: center;
}

/* content within mocks */
.cos-walk .content {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
}
.cos-walk .split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cos-walk .row-head {
  display: flex; justify-content: space-between; align-items: center;
}

.cos-walk .page-title { font-size: 13px; font-weight: 500; }
.cos-walk .page-sub {
  font-family: var(--font-mono);
  font-size: 10px; color: var(--muted-foreground);
}

.cos-walk .card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 14px;
  background: var(--surface);
}
.cos-walk .card.sm { padding: 10px 12px; }
.cos-walk .card.eval {
  background: linear-gradient(180deg, var(--primary-soft), transparent 60%);
}
.cos-walk .card-title {
  font-size: 12px; font-weight: 500;
  margin-bottom: 10px;
  display: flex; align-items: center; gap: 8px;
}
.cos-walk .card-title .ai-flag {
  font-size: 9px; color: var(--subtle-foreground);
  background: var(--surface-muted); padding: 2px 6px; border-radius: 3px;
  text-transform: uppercase; letter-spacing: 0.06em;
}

/* signin */
.cos-walk .signin-mock {
  padding: 28px 24px;
  display: flex; flex-direction: column; gap: 12px;
  max-width: 340px; margin: 12px auto;
}
.cos-walk .signin-mock h4 { font-size: 16px; font-weight: 500; }
.cos-walk .signin-sub {
  font-family: var(--font-mono);
  font-size: 10px; color: var(--muted-foreground);
  margin-bottom: 8px;
}
.cos-walk .field {
  display: flex; flex-direction: column; gap: 4px;
}
.cos-walk .field .label {
  font-family: var(--font-mono);
  font-size: 10px; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.cos-walk .field .input {
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 7px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
}
.cos-walk .btn {
  background: var(--foreground); color: var(--background);
  padding: 8px 14px; border-radius: 5px;
  text-align: center;
  font-size: 12px; font-weight: 500;
  cursor: default;
}
.cos-walk .btn.small { padding: 6px 12px; font-size: 11px; }
.cos-walk .btn.xs {
  padding: 4px 9px; font-size: 10px;
  font-family: var(--font-mono);
}
.cos-walk .btn.ghost {
  background: transparent; color: var(--muted-foreground);
  border: 1px solid var(--border);
}
.cos-walk .btn.primary { background: var(--primary); color: white; }

/* upload */
.cos-walk .upload-zone {
  border: 1px dashed var(--border-strong);
  border-radius: 5px; padding: 18px;
  text-align: center;
  background: var(--surface-muted);
}
.cos-walk .upload-icon { font-size: 16px; color: var(--subtle-foreground); }
.cos-walk .upload-text { font-size: 11px; margin: 4px 0; }
.cos-walk .upload-sub { font-size: 10px; color: var(--subtle-foreground); }

.cos-walk .form-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  gap: 8px;
}
.cos-walk .form-row.col { flex-direction: column; align-items: flex-start; gap: 4px; }
.cos-walk .form-row:last-child { border-bottom: none; }
.cos-walk .form-label {
  font-size: 10px; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.cos-walk .form-val { font-size: 11px; }

/* table */
.cos-walk .tbl {
  border: 1px solid var(--border);
  border-radius: 5px; overflow: hidden;
}
.cos-walk .tbl-head, .cos-walk .tbl-row {
  display: grid;
  grid-template-columns: 1.4fr 0.9fr 0.6fr 0.7fr 0.5fr;
  gap: 8px; padding: 6px 10px;
  align-items: center;
}
.cos-walk .tbl-head {
  background: var(--surface-muted);
  font-family: var(--font-mono);
  font-size: 9px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--subtle-foreground);
  border-bottom: 1px solid var(--border);
}
.cos-walk .tbl-row {
  font-size: 11px;
  border-bottom: 1px solid var(--border);
}
.cos-walk .tbl-row:last-child { border-bottom: none; }
.cos-walk .tbl-row.focus {
  background: var(--primary-soft);
  border-left: 2px solid var(--primary);
  padding-left: 8px;
}

.cos-walk .badge {
  display: inline-block; font-family: var(--font-mono);
  font-size: 9px; text-transform: uppercase;
  background: var(--surface-muted);
  padding: 2px 6px; border-radius: 3px;
  letter-spacing: 0.05em;
}
.cos-walk .badge.new { background: var(--primary-soft); color: var(--primary); }
.cos-walk .badge.submitted { background: oklch(0.92 0.06 152); color: var(--success); }

/* application rows */
.cos-walk .app-row {
  display: flex; align-items: center; justify-content: space-between;
  border: 1px solid var(--border); border-radius: 5px;
  padding: 12px 14px;
}
.cos-walk .app-row-title { font-size: 12px; font-weight: 500; }
.cos-walk .app-row-sub {
  font-size: 10px; color: var(--muted-foreground); margin-top: 2px;
}

/* evaluation */
.cos-walk .score-line {
  display: flex; align-items: baseline; gap: 16px; margin-bottom: 10px;
}
.cos-walk .score { font-size: 36px; font-weight: 600; line-height: 1; letter-spacing: -0.03em; }
.cos-walk .fit-label { font-size: 12px; font-weight: 600; }
.cos-walk .fit-label.strong { color: var(--success); }
.cos-walk .conf { font-size: 10px; color: var(--muted-foreground); margin-top: 3px; }
.cos-walk .score-bar {
  height: 5px; background: var(--surface-muted);
  border-radius: 3px; overflow: hidden; margin-bottom: 14px;
}
.cos-walk .score-bar-fill { height: 100%; background: var(--success); }
.cos-walk .eval-section { margin-top: 10px; }
.cos-walk .eval-h {
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--subtle-foreground);
  margin-bottom: 6px;
}
.cos-walk .eval-section ul { list-style: none; padding: 0; margin: 0; }
.cos-walk .eval-section li {
  font-size: 11px; padding: 3px 0;
  color: var(--muted-foreground);
}
.cos-walk .eval-section li::before { content: '· '; color: var(--success); margin-right: 2px; }
.cos-walk .eval-section ul.gaps li::before { color: var(--warning); }

.cos-walk .jd-text { font-size: 11px; color: var(--muted-foreground); line-height: 1.55; }

/* resume */
.cos-walk .resume-mock {
  padding: 16px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 5px;
}
.cos-walk .resume-head { margin-bottom: 14px; }
.cos-walk .resume-name { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.cos-walk .resume-contact {
  font-size: 10px; color: var(--muted-foreground); margin-top: 2px;
}
.cos-walk .resume-section { margin-top: 14px; }
.cos-walk .resume-section-h {
  font-family: var(--font-mono);
  font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--subtle-foreground);
  border-bottom: 1px solid var(--border); padding-bottom: 4px;
  margin-bottom: 8px;
}
.cos-walk .resume-bullet { margin-bottom: 10px; }
.cos-walk .resume-bullet .bullet-text { font-size: 11.5px; line-height: 1.45; }
.cos-walk .resume-bullet .bullet-rationale {
  font-size: 10px; color: var(--primary);
  margin-top: 3px;
}
.cos-walk .resume-meta {
  display: flex; gap: 14px; margin-top: 16px;
  padding-top: 10px; border-top: 1px solid var(--border);
  font-size: 10px; color: var(--subtle-foreground);
}
.cos-walk .resume-meta strong { color: var(--foreground); font-weight: 500; }

/* diff */
.cos-walk .diff-row {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cos-walk .diff-side {
  border: 1px solid var(--border);
  border-radius: 5px; padding: 10px 12px;
}
.cos-walk .diff-side.diff-old { background: oklch(0.97 0.02 25 / 0.5); }
.cos-walk .diff-side.diff-new { background: oklch(0.96 0.04 152 / 0.5); }
.cos-walk .diff-label {
  font-size: 9px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--subtle-foreground);
  margin-bottom: 6px;
}
.cos-walk .hint {
  font-size: 10px; color: var(--primary);
  margin-top: 10px;
}
.cos-walk .actions {
  display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end;
}

/* modal */
.cos-walk .modal-mock {
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface);
  padding: 16px; box-shadow: 0 4px 12px -4px rgba(0,0,0,0.06);
}
.cos-walk .modal-title { font-size: 13px; font-weight: 500; }
.cos-walk .modal-sub {
  font-size: 10px; color: var(--muted-foreground); margin: 4px 0 14px;
}
.cos-walk .modal-body { font-size: 11px; }
.cos-walk .prose-line { padding: 3px 0; color: var(--muted-foreground); }
.cos-walk .modal-actions {
  display: flex; gap: 6px; margin-top: 16px; justify-content: flex-end;
}
.cos-walk .modal-form { display: flex; flex-direction: column; gap: 4px; }
.cos-walk .reply-body {
  font-size: 11px; padding: 8px 10px;
  background: var(--surface-muted); border-radius: 4px;
  color: var(--muted-foreground); line-height: 1.5;
  width: 100%;
}

/* state banner */
.cos-walk .state-banner {
  border: 1px solid var(--border); border-radius: 5px;
  padding: 12px 14px;
  display: flex; justify-content: space-between; align-items: center;
  background: oklch(0.96 0.04 152 / 0.4);
}
.cos-walk .banner-h { font-size: 11px; font-weight: 600; color: var(--success); text-transform: uppercase; }
.cos-walk .banner-sub { font-size: 10px; color: var(--muted-foreground); margin-top: 3px; }
.cos-walk .state-banner-r { font-size: 10px; color: var(--muted-foreground); }

.cos-walk .tabs {
  display: flex; gap: 14px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  padding-bottom: 4px;
}
.cos-walk .tab { color: var(--muted-foreground); padding-bottom: 6px; }
.cos-walk .tab.active {
  color: var(--foreground); font-weight: 500;
  border-bottom: 2px solid var(--primary);
}

.cos-walk .artifact-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.cos-walk .artifact-tile {
  border: 1px solid var(--border); border-radius: 5px;
  padding: 10px 12px;
}
.cos-walk .artifact-tile.approved {
  background: oklch(0.96 0.04 152 / 0.3);
  border-color: oklch(0.85 0.06 152);
}
.cos-walk .at-type { font-size: 10px; color: var(--subtle-foreground); }
.cos-walk .at-state { font-size: 11px; font-weight: 500; margin: 4px 0; }
.cos-walk .at-action { font-size: 10px; color: var(--primary); }

/* cover letter */
.cos-walk .letter-mock {
  padding: 16px;
  border: 1px solid var(--border); border-radius: 5px;
}
.cos-walk .letter-block { margin-bottom: 12px; }
.cos-walk .letter-label {
  font-size: 9px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--subtle-foreground);
  margin-bottom: 4px;
}
.cos-walk .letter-text {
  font-size: 11px; line-height: 1.55; color: var(--muted-foreground);
}

/* interview */
.cos-walk .notes-mock {
  border: 1px solid var(--border); border-radius: 5px;
  padding: 12px;
  position: relative;
}
.cos-walk .notes-text p {
  font-size: 11px; color: var(--muted-foreground);
  line-height: 1.6; margin-bottom: 2px;
}
.cos-walk .autosave {
  position: absolute; top: 8px; right: 12px;
  font-size: 9px; color: var(--success);
}
.cos-walk .outcome-strip {
  display: flex; gap: 6px; align-items: center;
  margin-top: 10px;
}
.cos-walk .outcome-strip > span:first-child {
  font-size: 9px; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-right: 4px;
}
.cos-walk .outcome {
  font-size: 10px; padding: 4px 8px; border-radius: 4px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
}
.cos-walk .outcome.weak { background: oklch(0.93 0.05 152 / 0.4); border-color: oklch(0.8 0.05 152); }

/* dashboard funnel */
.cos-walk .funnel {
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px;
  border: 1px solid var(--border); border-radius: 5px;
}
.cos-walk .funnel-stage {
  display: flex; align-items: center; gap: 12px;
}
.cos-walk .fs-bar {
  height: 18px;
  background: var(--primary-soft);
  border-radius: 3px; min-width: 12px;
}
.cos-walk .funnel-stage:last-child .fs-bar {
  background: var(--success);
}
.cos-walk .fs-label { font-size: 10px; color: var(--muted-foreground); min-width: 140px; }

.cos-walk .grid-2 {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.cos-walk .mini-row {
  font-size: 11px; padding: 5px 0;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
}
.cos-walk .mini-row:last-child { border-bottom: none; }
.cos-walk .mini-row.warn { color: var(--warning); font-weight: 500; }

/* themes */
.cos-walk .theme {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.cos-walk .theme:last-child { border-bottom: none; }
.cos-walk .theme-h { font-size: 12px; font-weight: 500; }
.cos-walk .theme-meta { font-size: 10px; color: var(--muted-foreground); margin-top: 3px; }

/* closing */
.cos-walk .closing {
  border-top: 1px solid var(--border);
  margin-top: 56px;
  padding-top: 56px;
}
.cos-walk .closing h2 {
  font-size: 32px; font-weight: 600;
  letter-spacing: -0.02em; margin-bottom: 16px;
}
.cos-walk .closing p {
  font-size: 16px; color: var(--muted-foreground);
  line-height: 1.6; max-width: 720px; margin-bottom: 28px;
}
.cos-walk .closing-cta {
  display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 56px;
}
.cos-walk .footer-meta {
  display: flex; gap: 10px; align-items: center;
  font-family: var(--font-mono);
  font-size: 11px; color: var(--subtle-foreground);
}
.cos-walk .footer-meta .dim { opacity: 0.5; }

/* responsive */
@media (max-width: 900px) {
  .cos-walk .page { padding: 40px 24px 64px; }
  .cos-walk header.hero h1 { font-size: 40px; }
  .cos-walk .step { grid-template-columns: 1fr; gap: 32px; padding: 40px 0; }
  .cos-walk .mock { position: static; }
}
`;
