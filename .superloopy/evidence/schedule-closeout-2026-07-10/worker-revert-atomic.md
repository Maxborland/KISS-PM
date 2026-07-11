# HIGH-4: atomic, idempotent planning revert

Date: 2026-07-10
Status: PASS
Scope: server `planning/revert-last`, narrow request parser, focused tests, and the existing DB happy-path request adaptation. No web, lifecycle worker, matrix, saved-view, or `registerPlanningRoutes.ts` edits.

## Contract

`POST /api/workspace/projects/:projectId/planning/revert-last` now requires:

```json
{
  "targetCommitId": "audit-event-id",
  "clientPlanVersion": 42,
  "idempotencyKey": "stable-client-request-key"
}
```

The request key is hash-bound to the actor, operation, explicit target commit, and source plan version. Reusing the key with a different target or envelope returns `idempotency_key_conflict`.

## Implementation evidence

- The endpoint acquires the tenant planning advisory lock inside `runDataSourceTransaction` and requires lock, audit, snapshot, mutation, version, and idempotency capabilities fail-closed.
- Idempotency replay runs after the lock but before snapshot/version checks. A retry after a committed but lost response returns the stored response even though the live plan version has advanced.
- The exact audit event named by `targetCommitId` is loaded and validated as a successful planning event for the same project with a non-empty, parseable compensation batch.
- The target commit must be the current plan head. Stale client versions return `plan_version_conflict`; an older explicit target at the current client version returns `planning_commit_not_current`.
- A successful `planning.commit.reverted` audit event is the durable consumed marker. A new key cannot revert the same target again.
- Every compensation is previewed before writes, then all commands, one plan-version increment, one non-revertible audit event (`compensatingCommands: []`), notifications, readback, and response idempotency are committed in one transaction.
- A thrown command failure or post-write missing readback aborts the transaction. Replay skips cache/event emission, so duplicate requests do not repeat external success signals.

## Focused scenarios

Dedicated file: `apps/api/src/planning/planningRevertRoute.test.ts`.

1. Double click: same response replayed; one revert audit and one version bump.
2. Concurrent duplicate: serialized requests converge on one committed response.
3. Lost response retry: exact request replays after the first success is discarded.
4. Multi-command failure: injected failure on compensation 2 rolls back compensation 1, version, audit, and idempotency row.
5. Stale version: 409 with current version; no compensation or revert audit.
6. Second request key: same target is rejected; no undo/redo oscillation or second audit/version bump.
7. Contract guards: target commit and idempotency key are mandatory; the same key cannot be rebound to another target.

## Verification

```text
pnpm --filter @kiss-pm/api typecheck
PASS

pnpm vitest run apps/api/src/planning/planningRevertRoute.test.ts apps/api/src/planningParsers.test.ts
PASS: 2 files, 14 tests

codegraph sync
PASS: synced final changed test file; index current

git diff --check -- apps/api/src/planning/planningRevertRoute.ts apps/api/src/planning/planningRevertRoute.test.ts apps/api/src/planningParsers.ts apps/api/src/planningRoutes.db.test.ts
PASS: no whitespace errors
```

The injected rollback case intentionally emits the simulated exception to stderr while Vitest remains green; the assertions verify that no draft state committed.

Attempted DB command:

```text
pnpm vitest run --config vitest.db.config.ts apps/api/src/planning/planningRevertRoute.db.test.ts
BLOCKED before test execution: PostgresError relation "deal_stages" does not exist
```

The temporary DB test was replaced by the deterministic transaction harness rather than migrating or resetting the shared local database. No product assertion failed in that DB attempt.

## Files and ownership

- `apps/api/src/planning/planningRevertRoute.ts`: atomic explicit-target implementation.
- `apps/api/src/planningParsers.ts`: `PlanningRevertEnvelope` and parser.
- `apps/api/src/planning/planningRevertRoute.test.ts`: dedicated focused transactional tests.
- `apps/api/src/planningRoutes.db.test.ts`: only the pre-existing revert happy path was adapted to send target/version/key. This file also contains concurrent unrelated changes from other workers; none were reverted.
- `.superloopy/evidence/schedule-closeout-2026-07-10/worker-revert-atomic.md`: this report.

`registerPlanningRoutes.ts` was not changed. The planning-client/web caller still uses the old no-body call and is intentionally outside this server-only bounded scope; it must send the new explicit envelope before the UI can use this stricter endpoint.

## CodeGraph change index

Structural entry used before edits: `codegraph sync`, `codegraph_context`, `codegraph_impact(registerPlanningRevertRoute)`. CodeGraph did not surface the route body reliably and selected duplicate `.claude/worktrees` symbols, so targeted file reads and `rg` were used only for exact endpoint strings and already-located code.

Observed graph baseline from the preceding HIGH-4 audit: 24,880 nodes / 53,270 edges. Final synchronized graph: 24,950 nodes / 53,314 edges across 2,235 files. The workspace had concurrent edits, so the aggregate delta is not attributable solely to this lane.

Changed/added symbols:

- Changed `registerPlanningRevertRoute`: separate per-command transactions -> one locked transaction with replay, explicit target validation, consumed-marker check, batch preview/apply, one version, and one audit.
- Added `PlanningRevertTransactionAbort`, `REVERT_ACTION`, `parseCompensatingCommands`, and `isSuccessfulRevertOf`.
- Added `PlanningRevertEnvelope`, `PlanningRevertEnvelopeParseResult`, and `parsePlanningRevertEnvelope`.
- Added focused test symbols headed by `createHarness`, `targetEvent`, and seven route-contract tests.
- Removed the route edge to `executeApplyPlanningCommand`; added edges to transaction capabilities, batch preview, command permission checks, normalization, audit/idempotency persistence, notifications, and read-model creation.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-revert-atomic.md
