# Worker 08: Baseline and commits Playwright spec

Status: implemented, static verification only

## Scope

- Added `e2e/full-eval/projects-baseline-commits-write.spec.ts`.
- No product files or shared helpers changed.
- No browser test was executed against the live/shared database.

## Coverage

- AC1: ADMIN captures a uniquely labelled baseline through the Baseline UI, confirms preview/apply `200`, reads the new active baseline from the planning read-model, reloads, and finds the matching planning commit and audit event.
- AC2: Baseline capture is skipped before login or mutation unless `KISS_PM_E2E_DISPOSABLE_DATABASE=1` explicitly marks the database disposable.
- AC3: ADMIN creates a reversible `task.update_identity` fixture, opens Commits, confirms the exact version/audit event, invokes the UI `revert-last`, and verifies API plus reload readback of the original task title.
- AC4: The commits test verifies its audit event is still the latest reversible event before revert. Its `finally` restore only overwrites the unique marker; it refuses to clobber a concurrent foreign title.

## Exact baseline blocker

`baseline.capture` is intentionally irreversible: both domain compensating-command builders return no inverse for it. There is no baseline-delete endpoint and no project-delete endpoint for disposing a project after capture. Therefore exact restoration of a shared project's prior baseline list, active baseline, captured timestamps, audit history, and plan version is impossible through public interfaces.

The baseline mutation path is consequently gated behind `KISS_PM_E2E_DISPOSABLE_DATABASE=1`. On the shared database the test is a no-op skip, not a fake restore. A future safe alternative requires either an isolated ephemeral database/project lifecycle or a supported baseline cleanup API.

## Verification

- `node_modules/.bin/playwright.cmd test e2e/full-eval/projects-baseline-commits-write.spec.ts --list` -> PASS, 2 tests in 1 file.
- Targeted strict TypeScript check using the local `tsc.cmd` and `tsconfig.base.json` compiler options -> PASS.
- Initial `pnpm exec playwright ... --list` did not reach Playwright because the Codex pnpm launcher attempted an install and stopped on `ERR_PNPM_IGNORED_BUILDS`; the already-installed local Playwright binary was used instead.
- Live mutation run: not performed by instruction.
- Runtime pass/fail: not claimed; the baseline path additionally requires an explicitly disposable database.
- Screenshots/traces/videos: none, because no browser scenario was executed.
