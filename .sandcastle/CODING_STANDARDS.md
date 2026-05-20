# Coding Standards

Loaded by the reviewer agent during code review (referenced via
`@.sandcastle/CODING_STANDARDS.md`). The implementer should also respect
these — they apply throughout the project.

## Concision

- Sacrifice grammar for concision in commit messages, comments, PR bodies.
- No emojis anywhere — commits, code, comments, docs (unless the user
  explicitly requested them in a specific file).
- Default to writing **no comments**. Only add a comment when the WHY is
  non-obvious (hidden constraint, subtle invariant, workaround for a
  specific bug, surprising behavior). Never describe WHAT the code does.

## Style

- TypeScript strict mode is on; do not use `any`. If forced, comment why.
- Named exports over default exports.
- Prefer composition over inheritance.
- Avoid nested ternary operators — use `if/else` or `switch`.
- Explicit code over clever code.
- No `// TODO` or commented-out code in committed PRs. Either do it or open a follow-up issue.

## Architecture invariants (per PRODUCT.md / ARCHITECTURE.md)

- **No outbound action without the approval gate.** Every artifact reaching
  an external surface (email, LinkedIn, application submit, recruiter
  reply) must pass through the `<ApprovalGate>` and have its DB row in the
  `approved` state. Enforced at both DB and UI layers.
- **Application state transitions only via the state machine.** Never raw
  `prisma.application.update({ data: { state: ... } })` — go through
  `lib/state-machine/application.ts:transition()`.
- **Workers consume scoped memory only.** Don't read the entire candidate
  context — let `resolveScopedMemory()` decide what's in scope.
- **The event log is append-only.** No UPDATE / DELETE on the `events`
  table. Enforced by DB trigger or app-level guard.
- **Application is the operational anchor.** Most meaningful events
  carry an `application_id`. Reach for it before inventing new join keys.

## Testing

- Write failing test first (RGR), make it pass, then refactor.
- Integration tests for any change touching workers or the event bus —
  mocking the event log hides regressions.
- Run `pnpm typecheck` AND `pnpm test` before every commit.

## Tooling

- Use **pnpm**, not npm. `pnpm add <pkg>` for new dependencies.
- Run Prisma generate after schema changes (`pnpm exec prisma generate`).
- Use `pnpm db:push` for local schema sync, `pnpm db:migrate` for committed migrations.

## Documentation

- Update `PRODUCT.md` / `ARCHITECTURE.md` when changing semantics, not just code.
- Plan files live at `plans/<slice>/<slug>.md` — keep them current as
  acceptance criteria evolve mid-implementation.
- Don't create new docs unless asked.
