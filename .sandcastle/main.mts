// Parallel Planner with Review — four-phase orchestration loop
//
// Customised for Career OS:
//   - All agents run claude-opus-4-7
//   - Host's pnpm content-addressed store is bind-mounted into each
//     sandbox so `pnpm install --prefer-offline` reuses already-downloaded
//     packages and never bloats the worktree
//   - Authoritative dependency graph lives in each issue's `Blocked by:`
//     line; the planner reads these and only emits unblocked issues
//
// Phases per outer iteration:
//   Phase 1 (Plan):    opus reads open issues, parses `Blocked by:` lines,
//                      and outputs a <plan> JSON of unblocked issues.
//                      If only one is unblocked, the parallel infrastructure
//                      collapses to sequential execution.
//   Phase 2 (Exec):    each unblocked issue runs in its own sandbox in
//                      parallel via Promise.allSettled. Implementer first,
//                      then reviewer in the same sandbox / branch.
//   Phase 3 (Merge):   a single merger agent on `main` merges all completed
//                      branches, resolves conflicts, runs typecheck + tests,
//                      and closes the corresponding issues.
//
// Outer loop repeats up to MAX_ITERATIONS so newly-unblocked issues are
// picked up after each round of merges (closed issues become "done"
// dependencies for downstream issues).
//
// Usage:
//   pnpm tsx .sandcastle/main.mts
// Or via the polling wrapper:
//   bash .sandcastle/poll.sh        # 30s polling interval

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Default Claude model for all agents in this template.
const MODEL = "claude-opus-4-7";

// Hooks run inside the sandbox before the agent starts each iteration.
// pnpm install --prefer-offline reads from the bind-mounted host pnpm store
// (see `mounts` config below). Packages already on the host are copied into
// the worktree's node_modules in seconds; new packages get fetched once into
// the shared store and become available to host + every future container.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "pnpm install --prefer-offline" }] },
};

// node_modules is NOT copied from host. The shared pnpm store (bind-mounted
// via the `mounts` option below) provides packages on demand. Keeps each
// worktree tiny (~5MB) instead of ~1GB.
const copyToWorktree: string[] = [];

// Bind-mount the host's pnpm content-addressed store into the container at
// the path expected by PNPM_STORE_DIR (set in .sandcastle/Dockerfile).
// On macOS the host store lives at ~/Library/pnpm/store.
const sandboxConfig = docker({
  mounts: [
    {
      hostPath: "~/Library/pnpm/store",
      sandboxPath: "/home/agent/.pnpm-store",
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
  // The planner reads every open issue's `Blocked by:` line and outputs the
  // set of issues whose blockers are all closed. That set can safely run in
  // parallel — by construction none of them depends on another open issue.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks,
    sandbox: sandboxConfig,
    name: "planner",
    maxIterations: 1,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) ready to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // Each unblocked issue gets its own sandbox. Implementer and reviewer
  // share that sandbox so both phases operate on the same branch.
  // Promise.allSettled: one failing pipeline does not cancel the others.
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
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: sandcastle.claudeCode(MODEL),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: sandcastle.claudeCode(MODEL),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
            },
          });

          // Merge commits from both phases so the merge step sees all of them.
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

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  failed: ${issues[i]!.id} (${issues[i]!.branch}) — ${outcome.reason}`,
      );
    }
  }

  // Only branches that actually produced commits should reach the merge phase.
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
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent in a fresh sandbox (on `main`) merges every completed branch
  // into main, resolves conflicts, runs typecheck + tests, and closes the
  // corresponding issues. Failed merges leave branches untouched for
  // human inspection.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    sandbox: sandboxConfig,
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
