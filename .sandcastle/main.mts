// Parallel Planner with Review — four-phase orchestration loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
// pnpm install --prefer-offline reads from the bind-mounted host pnpm store
// (see sandboxConfig.mounts below). No copying node_modules from host; the
// store provides packages on demand and copies (not hard-links — cross-mount)
// them into the worktree's node_modules in seconds.
// Write the install transcript to the bind-mounted pnpm store path so it
// persists on the host even when the container exits. Sandcastle does not
// surface failed-hook stdout/stderr, so the host-side file is our only way
// to read the actual pnpm error. Inspect via:
//   cat ~/Library/pnpm/store/_install.log
const hooks = {
  // host.onWorktreeReady runs ON THE HOST before the container starts,
  // inside the freshly-created git worktree. We write a .env file here
  // so the container's tools (Prisma, Vitest, Next dev server) can reach
  // the host's docker-compose Postgres via `host.docker.internal:5433`
  // (Docker Desktop's automatic bridge to the host machine).
  //
  // Without this, agents try `localhost:5433` from inside the container —
  // which resolves to the container itself, where no Postgres exists —
  // and any DB-dependent test fails with "Can't reach database server".
  host: {
    onWorktreeReady: [
      {
        command:
          "cat > .env <<'EOF'\n" +
          "DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5433/career_os?schema=public\n" +
          "AUTH_SECRET=test-secret-32-chars-padding-padding-padding-padding\n" +
          "AUTH_USER_EMAIL=me@example.com\n" +
          "AUTH_USER_PASSWORD_HASH=$2b$12$KIzv0WPiqgIBSnk3CnRdvuD7yU3UA2vCWOLJrUztMjFcg4D2eXX/y\n" +
          "CRON_SECRET=test-cron-secret\n" +
          "AI_GATEWAY_API_KEY=test\n" +
          "BRAVE_SEARCH_API_KEY=test\n" +
          "GCS_PROJECT_ID=test\n" +
          "GCS_BUCKET=test\n" +
          "GCS_KEY_FILE=./gcs-service-account.json\n" +
          "EOF",
      },
    ],
  },
  // sandbox.onSandboxReady runs INSIDE the container once it's up.
  // pnpm install --prefer-offline reads from the bind-mounted host pnpm store
  // (see sandboxConfig.mounts below). Output captured to the host-visible
  // store dir so failed-install errors surface for debugging.
  sandbox: {
    onSandboxReady: [
      {
        // CI=true skips ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY.
        // --store-dir is explicit because pnpm 10 ignores PNPM_STORE_DIR env;
        // without this it creates a store at $WORKSPACE/.pnpm-store and
        // doesn't reuse the bind-mounted host store at all.
        command:
          "CI=true pnpm install --prefer-offline --store-dir /home/agent/.pnpm-store >/home/agent/.pnpm-store/_install.log 2>&1",
        timeoutMs: 600000,
      },
    ],
  },
};

// node_modules is NOT copied from host. The shared pnpm store provides
// packages on demand. Keeps each worktree tiny (~5 MB) instead of ~1 GB.
const copyToWorktree: string[] = [];

// Sandbox configuration shared by all phases (planner, implementer, reviewer, merger).
// - imageName matches the locally built `career-os-sandcastle` image.
// - mount #1: host pnpm content-addressed store → container PNPM_STORE_DIR.
// - mount #2: host's ~/.claude/plans/ (native Claude plan directory) →
//   /home/agent/.plans/. Plans are the spec each implementer reads. Kept out
//   of the repo so they stay private + can be edited without a commit/push.
//   Read-only — agent treats plans as authoritative spec, not editable.
const sandboxConfig = docker({
  imageName: "career-os-sandcastle",
  mounts: [
    {
      hostPath: "~/Library/pnpm/store",
      sandboxPath: "/home/agent/.pnpm-store",
    },
    {
      hostPath: "~/.claude/plans",
      sandboxPath: "/home/agent/.plans",
      readonly: true,
    },
  ],
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — we parse that to drive Phase 2.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks,
    sandbox: sandboxConfig,
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: sandcastle.claudeCode("claude-opus-4-7"),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  // Extract the <plan>…</plan> block from the agent's stdout.
  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  // The plan JSON contains an array of issues, each with id, title, branch.
  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    // No unblocked work — either everything is done or everything is blocked.
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if it produces commits, the reviewer runs in the same sandbox.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: sandboxConfig,
        hooks,
        copyToWorktree,
      });

      try {
        // Run the implementer
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: sandcastle.claudeCode("claude-opus-4-7"),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Only review if the implementer produced commits
        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: sandcastle.claudeCode("claude-opus-4-7"),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
            },
          });

          // Merge commits from both runs so the merge phase sees all of them.
          // Each sandbox.run() only returns commits from its own run.
          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    // All agents ran but none made commits — nothing to merge this cycle.
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent merges all completed branches into the current branch,
  // resolving any conflicts and running tests to confirm everything works.
  //
  // The {{BRANCHES}} and {{ISSUES}} prompt arguments are lists that the agent
  // uses to know which branches to merge and which issues to close.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    sandbox: sandboxConfig,
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.claudeCode("claude-opus-4-7"),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      // A markdown list of issue IDs and titles, one per line.
      ISSUES: completedIssues
        .map((i) => `- ${i.id}: ${i.title}`)
        .join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
