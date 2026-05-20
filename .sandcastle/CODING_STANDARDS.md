# Coding Standards

Loaded by the reviewer agent during code review
(`@.sandcastle/CODING_STANDARDS.md`). Implementer should also follow.

## Concision

- Sacrifice grammar for concision in commit messages, comments, PR bodies.
- **No emojis anywhere** — commits, code, comments, docs.
- Default to **no comments**. Only add when the WHY is non-obvious (hidden
  constraint, subtle invariant, workaround for a specific bug, surprising
  behavior). Never describe WHAT.

## Style

- TypeScript strict mode; do not use `any`. If forced, comment why.
- Named exports over default exports.
- Composition over inheritance.
- No nested ternaries — use `if/else` or `switch`.
- Explicit over clever.
- No `// TODO` or commented-out code in committed PRs.

## Architecture invariants (per PRODUCT.md / ARCHITECTURE.md)

- **No outbound action without the approval gate.** Every artifact reaching
  an external surface (email, LinkedIn, application submit, recruiter reply)
  must pass through `<ApprovalGate>` with its DB row in `approved` state.
- **Application state transitions only via the state machine.** Never raw
  `prisma.application.update({ data: { state: ... } })` — use
  `lib/state-machine/application.ts:transition()`.
- **Workers consume scoped memory only.** Don't read full candidate context
  — let `resolveScopedMemory()` decide what's in scope.
- **The event log is append-only.** No UPDATE / DELETE on `events`.
- **Application is the operational anchor.** Most meaningful events carry an
  `application_id`. Reach for it before inventing new join keys.

## Testing

- Write failing test first (RGR), make it pass, then refactor.
- Integration tests for any change touching workers or the event bus.
- Run `pnpm exec tsc --noEmit` AND `pnpm test` before every commit.

## Tooling

- Use **pnpm**, not npm. `pnpm add <pkg>` for new deps.
- Run `pnpm exec prisma generate` after schema changes.
- `pnpm db:push` for local schema sync, `pnpm db:migrate` for committed migrations.

## Documentation

- Update `PRODUCT.md` / `ARCHITECTURE.md` when changing semantics.
- Plan files at `/home/agent/.plans/<filename>` (bind-mounted read-only) —
  do not edit; they're the spec.
- Don't create new docs unless asked.
