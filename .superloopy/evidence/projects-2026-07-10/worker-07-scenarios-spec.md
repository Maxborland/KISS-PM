# Worker 07: Scenarios E2E spec

## Scope

- Added `e2e/full-eval/projects-scenarios-write.spec.ts` only.
- No product code was changed.
- No live Playwright mutation run was performed against the shared database.

## Covered flow

1. Log in as ADMIN and select a project whose planning read model contains a day overload.
2. Open the real Scenarios route and capture the UI-triggered `POST .../planning/scenarios/preview` response.
3. Prove preview-before-apply in three independent ways:
   - the preview response is `200` and carries the current `clientPlanVersion`;
   - API readback after preview and after opening compare has the unchanged plan version and assignments;
   - the scenario apply request counter is still zero before the Apply button is clicked.
4. Open the real inline Compare UI and assert the current-plan column, proposal column, explicit "nothing saved" label, and command count.
5. Apply a cleanup-safe `resilient` or `balanced` proposal through the real Apply button.
6. Assert the exact scenario apply endpoint, request plan version, response scenario-run id, one-version increment, touched assignments, API readback, and persistence after browser reload.
7. Restore all scenario-touched assignments in `finally` through the public `apply-command-batch` API, retrying version conflicts up to three times.
8. Assert the original touched assignments and target overload are restored, then reload and repeat API readback.

## Cleanup boundary

The compensating batch restores the business state changed by the selected scenario:

- the existing assignment is upserted from the pre-test snapshot;
- the scenario-created assignment is deleted;
- the original target overload is present again.

This is not a byte-for-byte database rollback. Planning history is append-only through the public contract, so plan-version increments, audit events, preview records, and the applied scenario-run remain. The test records this as a Playwright `cleanup-gap` annotation and does not claim those records are erased.

The fixture gate rejects `aggressive` proposals because `risk.accept_overload` has no public inverse command. It also fails before mutation when no assignment-only `balanced`/`resilient` proposal exists; that gap is surfaced as `scenario_fixture_unavailable:no_cleanup_safe_assignment_proposal`.

## Static verification

- PASS: `node_modules/.bin/playwright.cmd test e2e/full-eval/projects-scenarios-write.spec.ts --config playwright.config.ts --list`
  - Discovered exactly 1 Chromium test in 1 file.
- PASS: `node_modules/.bin/tsc.cmd --noEmit --pretty false --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node,@playwright/test e2e/full-eval/projects-scenarios-write.spec.ts`
  - Exit code 0, no diagnostics.

The initial `pnpm exec playwright ... --list` attempt did not reach Playwright because the workspace pnpm wrapper tried to run dependency installation and rejected ignored package build scripts. The already-installed local Playwright binary was used instead; no install or dependency change was made.

No browser test execution is allowed for this worker because it would mutate the shared database.
