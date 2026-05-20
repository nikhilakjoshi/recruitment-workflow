# TASK

Merge the following branches into the current branch (`main`):

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution. When in doubt, favour the side that matches the plan file referenced in the issue body.
3. After resolving conflicts, run `pnpm typecheck` and `pnpm test` to verify everything works.
4. If type-checks or tests fail, fix the issues before proceeding to the next branch.

After all branches are merged, make a single commit summarizing the merge.

# CLOSE ISSUES

For each branch that was merged successfully, close its issue using the following command:

`{{CLOSE_TASK_COMMAND}}`

Add a closing comment like: `Merged via {{BRANCH_NAME}}. See plan file for context.`

Here are all the issues being merged this round:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.

# NOTES

- This project uses **pnpm**, not npm.
- If a merge fails or tests can't be fixed within the iteration budget, leave the branch unmerged and report the failure in the final output. Do not force a bad merge.
- The merger never bypasses the human approval gate for outbound artifacts; that's enforced at the database/UI layer.
