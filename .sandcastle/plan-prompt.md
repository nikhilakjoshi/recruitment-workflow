# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list --state open --label Sandcastle --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work.

# AUTHORITATIVE DEPENDENCY GRAPH

Every issue body in this project declares its dependencies in a **`Blocked by:`** line near the top, listing the issue numbers it depends on. Examples:

- `**Blocked by:** none (root)` — no upstream dependency
- `**Blocked by:** #4` — depends on issue #4 being closed
- `**Blocked by:** #4, #6, #9` — multiple

**These markers are the authoritative dependency graph.** Do not infer dependencies from titles, files, or guesses — read the `Blocked by:` line.

An issue is **READY** if and only if every number on its `Blocked by:` line refers to either:

1. an issue whose state is `closed` (already merged), OR
2. an issue that does not appear in the open issues list above (already done / never existed)

If any `Blocked by` number is still open, the issue is **NOT READY** and must be excluded from this plan.

# TASK

1. Parse each open issue's `Blocked by:` line.
2. Cross-reference against the list of open issue numbers above.
3. Output **every ready issue** as an entry in the plan — these can safely be worked in parallel because none of them depends on another open issue.
4. If only one issue is ready, the parallel infrastructure collapses to sequential execution automatically.

For each unblocked issue, assign a branch name using the format `sandcastle/issue-{id}-{slug}`.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "sandcastle/issue-42-fix-auth-bug"}]}
</plan>

Include only unblocked issues. If every issue is blocked, include the single highest-priority candidate (the one with the fewest or weakest dependencies).
