# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `{{VIEW_TASK_COMMAND}}`. Read the `Blocked by:` line in the issue body and confirm every listed dependency is closed before starting — if any is still open, leave a comment on the issue and stop.

The issue body references a plan file under `plans/<slice>/<issue-slug>.md`. **Read that plan file first** — it contains the full context, type signatures, file touchpoints, and acceptance criteria. The plan file is the source of truth for what to build.

Also read `PRODUCT.md`, `ARCHITECTURE.md`, and `ROADMAP.md` for global product semantics. Do not duplicate what's there — apply it.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

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

Before committing, run `pnpm typecheck` (or `pnpm exec tsc --noEmit`) and `pnpm test` (if tests exist) to ensure everything passes.

This project uses **pnpm**, not npm. Use `pnpm add <pkg>` for new dependencies (which writes to `pnpm-lock.yaml`).

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + plan file reference (`plans/<slice>/<slug>.md`)
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise. Per CLAUDE.md: sacrifice grammar for concision, no emojis.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - the merger phase will close it after a clean merge to main.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.

Every outbound artifact (resume, cover letter, LinkedIn edit, recruiter response, application submission) must go through the approval gate — there is no auto-send. This is foundational to the product (see PRODUCT.md §15).
