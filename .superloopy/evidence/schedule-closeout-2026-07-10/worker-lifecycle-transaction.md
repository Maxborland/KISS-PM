# Schedule planning lifecycle and transactionality worker

Date: 2026-07-10
Status: PASS
Scope: F1 and F2 from `.superloopy/evidence/schedule-closeout-2026-07-10/lane-api-data.md` only.

## Findings resolved

### F1 - non-active planning lifecycle

- `packages/persistence/src/planningRepository.ts` now resolves a plan snapshot only when the tenant-scoped project has `status = active`.
- Planning read-model, single preview, batch preview, single apply, and batch apply all consume this repository snapshot.
- Single and batch apply acquire `lockTenantResourcePlanning` before their snapshot read, so lifecycle is re-checked inside the transaction after the planning lock.
- Missing and non-active projects retain the existing non-disclosing response: `404 { error: "project_not_found" }`.

### F2 - post-write readback rollback

- Added `PlanningPostWriteReadbackError` in `apps/api/src/governedPlanningApply.ts`.
- Missing post-write readback now throws instead of returning a normal failed value from the transaction callback.
- `runPlanningWriteTransaction` catches that typed error only after `runDataSourceTransaction` rejects, then maps it to the existing 404 response.
- Single and batch apply use this path. The transaction therefore rolls back command rows, plan version, audit, notifications, and idempotency work before an HTTP error is produced.
- `applyGovernedPlanningDelta` uses the same rollback sentinel for consistency.

## Tests added

`apps/api/src/planningRoutes.db.test.ts` now covers:

- `draft`, `paused`, `closed`, and `cancelled` projects.
- Denial for read-model, single preview, batch preview, single apply, and batch apply.
- No task progress, plan version, audit, or idempotency mutation for lifecycle denial.
- Fault injection on the second transaction snapshot read for both single and batch apply.
- `404 project_not_found` mapping plus rollback of task dates, plan version, audit count, and idempotency count.
- The parallel saved-view fixture was preserved and updated with stable `clientRequestId: "planning-saved-view-create-db-test"`.

## Fresh verification

An explicitly disposable PostgreSQL database was used:

- Database: `kiss_pm_schedule_lifecycle_20260710164359`
- Migrations: applied successfully.
- Cleanup: database dropped successfully after verification.

Commands and results:

- `pnpm --filter @kiss-pm/api typecheck` - PASS.
- `pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t 'denies planning read|rolls back task' --reporter=dot --silent` - PASS, 6 passed / 24 skipped.
- `pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t 'lists and creates saved views' --reporter=dot --silent` - PASS, 1 passed / 29 skipped.
- `pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts --reporter=dot --silent` - PASS, 30 passed.
- `git diff --check -- apps/api/src/governedPlanningApply.ts apps/api/src/planning/registerPlanningRoutes.ts apps/api/src/planningRoutes.db.test.ts packages/persistence/src/planningRepository.ts` - PASS (line-ending warnings only).

The first focused test attempt failed only because the new assertion used a nonexistent `audit_events.source_entity_id` column. The fixture query was corrected to the actual JSONB contract, `source_entity ->> 'id'`, then the focused and full suites passed.

## Change index

Files changed by this worker:

- `packages/persistence/src/planningRepository.ts`
- `apps/api/src/governedPlanningApply.ts`
- `apps/api/src/planning/registerPlanningRoutes.ts`
- `apps/api/src/planningRoutes.db.test.ts`
- `.superloopy/evidence/schedule-closeout-2026-07-10/worker-lifecycle-transaction.md`

Symbols:

- Added: `PlanningPostWriteReadbackError` class and constructor.
- Added: `runPlanningWriteTransaction`.
- Changed: `applyGovernedPlanningDelta` missing-readback behavior.
- Changed: `registerPlanningRoutes` single and batch apply transaction execution/readback branches.
- Changed: `createPlanningRepository().getPlanSnapshot` project predicate.
- Added test cases for the four lifecycle states and single/batch post-write rollback.

CodeGraph was synchronized before investigation and after implementation.

- Initial global index: 2,230 files / 24,848 nodes / 53,215 edges.
- Final global index checkpoint: 2,235 files / 24,947 nodes / 53,228 edges.
- Source-specific additions visible in CodeGraph: `PlanningPostWriteReadbackError` class, its constructor, `runPlanningWriteTransaction`, and the new import from `registerPlanningRoutes.ts`.
- The global delta includes concurrent repository work from other lanes and is not attributed solely to this worker.

## Scope guard

No web Schedule files, revert route, matrix/docs, saved-view route, or unrelated project APIs were edited. The only saved-view-related change is the coordinated fixture field in the already-touched DB test.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-lifecycle-transaction.md
