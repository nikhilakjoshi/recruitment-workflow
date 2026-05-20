// Sequential Reviewer — implement-then-review loop
//
// This template drives a two-phase workflow per issue:
//   Phase 1 (Implement): A sonnet agent picks an open issue, works on it
//                        on a dedicated branch, commits the changes, and signals
//                        completion.
//   Phase 2 (Review):    A second sonnet agent reviews the branch diff and either
//                        approves it or makes corrections directly on the branch.
//
// Both phases share a single sandbox created via createSandbox(), so the
// implementer and reviewer work on the same explicit branch.
//
// The outer loop repeats up to MAX_ITERATIONS times, processing one issue per
// iteration. This is a middle-complexity option between the simple-loop (no review
// gate) and the parallel-planner (concurrent execution with a planning phase).
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

// Maximum number of implement→review cycles to run before stopping.
// Each cycle works on one issue. Raise this to process more issues per run.
const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
// pnpm install --prefer-offline reads from the bind-mounted host pnpm store
// (see `mounts` config below). Packages already on the host are copied into
// the worktree's node_modules in seconds; any new packages get fetched once
// into the shared store and become available to both host and container.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "pnpm install --prefer-offline" }] },
};

// node_modules is NOT copied from host. The shared pnpm store (bind-mounted
// via the `mounts` option below) provides packages on demand. Keeps worktrees
// tiny (~5MB) instead of ~1GB.
const copyToWorktree: string[] = [];

// Bind-mount the host's pnpm content-addressed store into the container at
// the path expected by PNPM_STORE_DIR (see Dockerfile). pnpm inside the
// container reads/writes here, sharing all package downloads with the host's
// pnpm and any other Sandcastle iterations.
//
// On macOS the host store lives at ~/Library/pnpm/store. If pnpm has never
// run on this machine you can pre-create the dir; otherwise pnpm finds it
// automatically.
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

  // Generate a unique branch name for this iteration.
  const branch = `sandcastle/sequential-reviewer/${Date.now()}`;

  // Create a single sandbox that both the implementer and reviewer share.
  // This gives both agents a real, named branch that persists across phases.
  const sandbox = await sandcastle.createSandbox({
    branch,
    sandbox: sandboxConfig,
    hooks,
    copyToWorktree,
  });

  try {
    // -----------------------------------------------------------------------
    // Phase 1: Implement
    //
    // A sonnet agent picks the next open issue, writes the
    // implementation (using RGR: Red → Green → Repeat → Refactor), and
    // commits the result.
    //
    // The agent signals completion via <promise>COMPLETE</promise> when done.
    // -----------------------------------------------------------------------
    const implement = await sandbox.run({
      name: "implementer",
      maxIterations: 100,
      agent: sandcastle.claudeCode("claude-opus-4-7"),
      promptFile: "./.sandcastle/implement-prompt.md",
    });

    if (!implement.commits.length) {
      console.log("Implementation agent made no commits. Skipping review.");
      continue;
    }

    console.log(`\nImplementation complete on branch: ${branch}`);
    console.log(`Commits: ${implement.commits.length}`);

    // -----------------------------------------------------------------------
    // Phase 2: Review
    //
    // A second sonnet agent reviews the diff of the branch produced by
    // Phase 1. It uses the {{BRANCH}} prompt argument to inspect the right
    // branch, and either approves or makes corrections directly on the branch.
    // -----------------------------------------------------------------------
    await sandbox.run({
      name: "reviewer",
      maxIterations: 1,
      agent: sandcastle.claudeCode("claude-opus-4-7"),
      promptFile: "./.sandcastle/review-prompt.md",
      promptArgs: {
        BRANCH: branch,
      },
    });

    console.log("\nReview complete.");
  } finally {
    await sandbox.close();
  }
}

console.log("\nAll done.");
