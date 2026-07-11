# Worker Baseline + Commits permission hardening

Date: 2026-07-10
Branch: `codex/pre-prod-hardening-on-master`

## Scope

Owned and changed:
- `apps/web/src/delivery/baseline/baseline-surface.tsx`
- `apps/web/src/delivery/commits/commits-surface.tsx`
- `apps/web/src/delivery/baseline/baseline-permission.test.tsx`
- `apps/web/src/delivery/commits/commits-permission.test.tsx`
- `e2e/full-eval/projects-baseline-commits-write.spec.ts`

## Policy alignment

- `baseline.capture` is gated by `tenant.project_baselines.manage`, matching `permissionForCommand`.
- Commit revert controls are gated by `tenant.project_plan.manage`, matching the compensating planning-command policy used by `revert-last` and `apply-command-batch`.
- No role-name checks were introduced.
- Both surfaces keep read-only history and comparison content visible.
- Every mutation handler has an early permission guard in addition to hidden UI controls.
- Prototype/non-live mode retains existing controls through the established `!live` behavior.

## TDD evidence

RED before implementation:
- `baseline-permission.test.tsx`: failed because read-only users saw “Зафиксировать базовый план”.
- `commits-permission.test.tsx`: failed because read-only users saw “Откатить последний” and “Откатить коммит”.
- Result: 2 failed / 2.

GREEN after implementation:
- `baseline-permission.test.tsx`: passed.
- `commits-permission.test.tsx`: passed, including manager click invoking `revertLast` exactly once and read-only invoking it zero times.
- Result: 2 passed / 2.

## Live E2E evidence

Main dev DB, web 3180 / API 4191:
- ADMIN reversible task-title commit -> API readback -> commit history -> `revert-last` -> restored task -> reload: passed.
- PLAN reader baseline: capture UI absent; direct `preview-command` for `baseline.capture` returned 403; no apply request; plan version, baselines and active baseline unchanged after reload: passed.
- PLAN reader commits: all revert UI absent; direct `revert-last` returned 403; no apply request; plan version, tasks and baselines unchanged after reload: passed.
- Baseline capture was intentionally skipped on the main DB.
- Result: 3 passed, 1 intentional skip.
- JSON: `worker-baseline-commits-main.json`.

Disposable DB `kiss_pm_projects_test`, web 3182 / API 4192:
- ADMIN `baseline.capture` -> preview -> explicit apply -> API readback -> reload -> commit audit readback: passed.
- Result: 1 passed / 1.
- JSON: `worker-baseline-capture-disposable.json`.
- Disposable services were stopped after the test; main web 3180 and API 4191 were restored and returned HTTP 200.

## Static verification

- Next route type generation: passed.
- Web TypeScript: passed.
- Focused permission Vitest: 2/2 passed.

## Safety / limitations

- Main DB received only the reversible commit test; the test restored the original title and verified readback after reload.
- Direct denied requests may append security/audit denial events by design, but did not change planning state.
- Baseline capture has no inverse/delete API, so it ran only against the isolated disposable database.
- Browser E2E used Chromium through Playwright; no media/provider behavior belongs to this surface.


## CodeGraph change index

Pre-change global index snapshot:
- 2202 files, 24492 nodes, 52575 edges.

Post-change global index snapshot:
- 2206 files, 24554 nodes, 52536 edges.
- This is a shared-worktree global delta and includes concurrent worker changes; it is not attributed solely to this block.

Owned symbol changes:
- Added `canManageBaselineControls`.
- Changed `ProjectBaseline` to consume runtime/session permissions and guard `onCapture`.
- Added `canManageCommitControls`.
- Changed `ProjectCommits` to guard `onRevert` and `onRevertLast` and hide revert controls in read-only mode.
- Added two focused test modules and expanded the Baseline/Commits E2E module.
- Removed symbols: none.
- Impact for each new helper is local to its owning surface.
