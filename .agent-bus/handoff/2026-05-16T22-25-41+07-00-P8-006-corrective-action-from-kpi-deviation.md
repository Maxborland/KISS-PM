# P8-006 corrective action from KPI deviation

Status: accepted for implementation block; Phase 8 remains not accepted.

Changed:
- Wired `create_corrective_action` to canonical Phase 4 task creation from a KPI signal target.
- Required dry-run preview before execute and rejected direct state-changing execute.
- Rechecked action availability at execute time and linked created corrective tasks back to KPI signal rows to prevent duplicate corrective actions.
- Required backend `task.write` in addition to `control.action:write` before creating the canonical task.
- Validated action execution through `createActionExecutionLog` only after audit event id exists.
- Extended Phase 4 task runtime/project-core to allow an explicit corrective task title without creating a duplicate corrective-task model.

Evidence:
- `npm test -- apps/api/src/phase8ActionExecutionApi.test.ts` exit 0: 1 file, 9 tests passed.
- `npm test -- packages/project-core apps/api/src/phase8ActionExecutionApi.test.ts apps/web/src/PortfolioControlSurface.test.tsx` exit 0: 10 files, 67 tests passed.
- `npm run test:integration` exit 0: 11 files, 59 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 60 files, 387 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P8-006-corrective-action-from-kpi-deviation --once` exit 0.

Review:
- `$bug-hunt`: duplicate corrective action, missing `task.write`, direct execute without preview. Fixed and retested.
- `$requesting-code-review`: missing `task.write`, action log persisted before audit evidence, execute availability gap. Fixed and retested.

Matrix:
- `docs/status/phase8-requirements-matrix.json` updated with fresh P8-006 evidence.
- P8-006 row remains blocked only for E2E-071/E2E-075 reload/reset evidence in P8-009.

Next:
- Claim `P8-007-resource-overload-action-engine-binding`.
