# Planning write-flow race/idempotency evidence - 2026-07-07

Status: DONE

## Scope

Atomic area: `RISK-WRITE-FLOW-RACE-IDEMPOTENCY` for planning scenario/baseline/schedule write flows.

In scope for this slice:
- Scenario proposal apply duplicate/race behavior.
- Existing baseline.capture and task.update_schedule race/idempotency tests as regression guard.

Out of scope by instruction:
- e2e tests.
- `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json`.
- Production changes unless a real bug is found.

## Changed files

- `apps/api/src/planningRoutes.db.test.ts`
  - Added `keeps scenario apply single-use under concurrent duplicate requests`.
  - The test creates a real overload, previews a scenario proposal, sends two parallel apply requests for the same proposal and client plan version, then fresh-reads the planning read-model and `planning_scenario_runs`.
- `docs/qa/full-eval/agent-reports/planning-write-race-2026-07-07.md`
  - This report.
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-write-flow-planning-scenario-race-2026-07-07.json`
  - Structured evidence for the reconciliation orchestrator.

## Behavior evidenced

- Scenario apply is single-use under concurrent duplicate requests.
- Exactly one concurrent duplicate scenario apply succeeds with HTTP 200.
- The duplicate request receives HTTP 409 with either `plan_version_conflict` or `planning_scenario_already_applied`, depending on where it observes the serialized transaction state.
- Fresh readback confirms the plan version bumps exactly once.
- DB readback confirms exactly one `planning_scenario_runs` row for the proposal and `applied_at` is set.
- Existing planning race/idempotency coverage for `baseline.capture` and `task.update_schedule` still passes.

## Production changes

None. Current planning route behavior passed the new targeted DB/API race coverage. No production bug was found in this slice.

## Commands / results

- CodeGraph status/context before edits
  - Result: connected and healthy; 2164 indexed files, 23852 nodes, 51896 edges.
  - Used `codegraph_context` and `codegraph_explore` for planning route/scenario context before file edits.
- `$env:DATABASE_URL='postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm'; .\node_modules\.bin\vitest.CMD run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t "keeps scenario apply single-use"`
  - First result: failed only because the new assertion expected `applied_at` to be a `Date`; the DB client returned a truthy timestamp string. Flow assertions had already reached readback.
  - Final result: passed; 1 selected test passed, 22 skipped.
- `$env:DATABASE_URL='postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm'; .\node_modules\.bin\vitest.CMD run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t "deduplicates concurrent|keeps scenario apply single-use"`
  - Result: passed; 3 selected tests passed, 20 skipped.
  - Covered `baseline.capture`, `task.update_schedule`, and scenario apply race tests.
- `git diff --check -- apps/api/src/planningRoutes.db.test.ts`
  - Result: passed; Git warned that CRLF will be replaced by LF next time Git touches the file.
- `codegraph sync`
  - Result: passed; already up to date.

Vitest emitted a pre-existing warning in `packages/domain/src/planning/commandReducer.ts` about a duplicate `assignment.delete` case. This slice did not touch that file.

## CodeGraph change index

Before:
- `registerPlanningRoutes` exposed scenario preview/apply routes in `apps/api/src/planning/registerPlanningRoutes.ts`.
- Scenario apply route serialized writes with `lockTenantResourcePlanning`, checked `planVersion`, loaded `planning_scenario_runs`, rejected already-applied runs, applied commands, incremented the plan version, and marked the scenario run applied.
- `apps/api/src/planningRoutes.db.test.ts` already covered sequential scenario preview/apply validation and existing concurrent idempotency tests for `baseline.capture` and `task.update_schedule`.

After:
- Production CodeGraph nodes/edges unchanged.
- Manual test-block index: added Vitest case at `apps/api/src/planningRoutes.db.test.ts:2112`, `keeps scenario apply single-use under concurrent duplicate requests`.
- New test exercises route edges through real API requests: read-model -> apply-command assignment.upsert -> scenario-proposals preview -> scenario-proposals/:proposalId/apply x2 -> read-model -> direct `planning_scenario_runs` readback.

Fallback note: CodeGraph did not expose the Vitest callback as a separate symbol node, so the added test block is indexed manually with file/line reference after `codegraph sync`.

## Remaining risks

- Full planning route suite was not run; targeted DB/API tests for this risk slice passed.
- Scenario create/preview concurrent duplicate proposal creation remains intentionally out of this atom unless the matrix owner wants a separate coverage item. This slice covers the higher-risk scenario write mutation: apply.
- No e2e or reconciliation matrix changes were made by instruction.