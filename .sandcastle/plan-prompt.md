# ISSUES

Here are the open issues in the repo:

<issues-json>

!`{{LIST_TASKS_COMMAND}}`

</issues-json>

# AUTHORITATIVE DEPENDENCY GRAPH

Every issue body in this project declares its dependencies in a **`Blocked by:`** line near the top, listing the issue numbers it depends on. Examples:

- `**Blocked by:** none (root)` — has no upstream dependency
- `**Blocked by:** #4` — depends on issue #4 being closed
- `**Blocked by:** #4, #6, #9` — depends on multiple

**These markers are the authoritative dependency graph.** Do not infer dependencies from titles, files, or guesses — read the `Blocked by:` line.

An issue is **READY** if and only if every number on its `Blocked by:` line refers to either:

1. an issue whose state is `closed` (already merged), OR
2. an issue that does not appear in the open issues list above (already done / never existed)

If any `Blocked by` number is still open, the issue is **NOT READY** and must be excluded from this plan.

# TASK

1. Parse each open issue's `Blocked by:` line.
2. Cross-reference against the list of open issue numbers above.
3. Output **every ready issue** as an entry in the plan — these can safely be worked in parallel because none of them depends on another open issue.
4. For each ready issue, assign a branch name using the format `sandcastle/issue-{id}-{slug}` where `{slug}` is a short kebab-case derivative of the title.

This pattern gives us the best of both worlds:

- If only one issue is ready, the parallel infrastructure collapses to sequential execution.
- If five independent issues are ready, all five run concurrently.
- The dependency graph stays curated by humans (in `Blocked by:` lines), not guessed by the LLM.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "4", "title": "Define core Prisma schema", "branch": "sandcastle/issue-4-core-schema"}]}
</plan>

If every open issue is blocked by another open issue, emit an empty list:

<plan>
{"issues": []}
</plan>

Do not include any issue that has at least one open `Blocked by` dependency.
