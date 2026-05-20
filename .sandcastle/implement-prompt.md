# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view {{TASK_ID}} --json number,title,body,labels`. Read the `Blocked by:` line in the issue body and confirm every listed dependency is closed before starting — if any is still open, leave a comment on the issue with `gh issue comment {{TASK_ID}} --body "..."` and stop.

The issue body has a `Plan: <filename>` line. **Read that plan file first** at `/home/agent/.plans/<filename>` — that path is a read-only bind-mount of the human's curated plan directory. The plan file contains pinned design decisions, type signatures, file touchpoints, acceptance criteria, and out-of-scope guardrails. **The plan file is the source of truth.** Do not improvise around it; if something is missing, leave a comment on the issue and stop.

Also read `PRODUCT.md`, `ARCHITECTURE.md`, and `ROADMAP.md` in the worktree for global product semantics. Do not duplicate them — apply them.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

**This project uses pnpm, not npm.** Use `pnpm add <pkg>` for new dependencies (writes to `pnpm-lock.yaml`).

**Every outbound artifact** (resume, cover letter, LinkedIn edit, recruiter response, application submission) **must go through the approval gate** — there is no auto-send. This is foundational to the product (see PRODUCT.md §15).

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, run `pnpm exec tsc --noEmit` and `pnpm test` to ensure the tests pass.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
