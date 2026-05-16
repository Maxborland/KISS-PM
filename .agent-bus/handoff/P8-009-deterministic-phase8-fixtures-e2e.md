# P8-009 Deterministic Phase 8 Fixtures and E2E

Completed: 2026-05-16T23:38:18.8293318+07:00
Verdict: accepted for P8-009 block only. Phase 8 is still blocked until P8-010 strict exit gate.

## Changed

- Added deterministic Phase 8 fixture seed in `packages/shared-test-fixtures`.
- Added executable Playwright E2E-070..075 under `e2e/tests/phase8`.
- Added P8 E2E helper functions for reset, Portfolio Control, Resource Load Control, action preview/execute, audit/readback, project task readback, and cleanup assertions.
- Updated Phase 8 requirements matrix with structured E2E evidence.
- Updated agent-bus queue/state and added next runnable `P8-010-phase8-verification-matrix-exit-gate`.

## Coverage

- E2E-070: Portfolio Control read model and Gantt drilldown with no Tenant B leakage.
- E2E-071: corrective task creation from KPI signal with UI preview/apply, backend direct execute denial for a resource manager, no-partial-mutation task/audit readback, API task readback, control audit, reload, and reset cleanup.
- E2E-072: Resource Load action-engine apply with dry-run no mutation, load readback, resource/control audit, reload, and reset cleanup.
- E2E-073: accepted risk requires reason, writes audit, refreshes signal, persists on reload, and clears on reset.
- E2E-074: read-only UI no mutation path, backend direct denial, dry-run-required direct execute denial, and Tenant B no-leak.
- E2E-075: request explanation refreshes Portfolio Control, persists on reload, and clears on reset.

## Verification

- `npm test -- packages/shared-test-fixtures/src/phase8Fixtures.test.ts` exit 1 RED: missing fixture module before implementation
- `npm test -- packages/shared-test-fixtures/src/phase8Fixtures.test.ts` exit 0: 1 file, 1 test passed
- `PW_API_PORT=4287 PW_WEB_PORT=5287 npm run test:e2e:phase -- --phase=8` exit 1 RED: No tests found
- `PW_API_PORT=4288 PW_WEB_PORT=5288 npm run test:e2e:phase -- --phase=8` exit 0: 6 tests passed
- `PW_API_PORT=4289 PW_WEB_PORT=5289 npm run test:e2e:phase -- --phase=8` exit 1 RED: corrective-task direct denial used relative URL and hit web port instead of API
- `PW_API_PORT=4289 PW_WEB_PORT=5289 npm run test:e2e:phase -- --phase=8` exit 0: 6 tests passed after direct-denial fix
- `npm test -- packages/shared-test-fixtures` exit 0: 6 files, 11 tests passed
- `npm test -- apps/api/src/phase8ActionExecutionApi.test.ts apps/api/src/phase8ControlSurfacesApi.test.ts` exit 0: 2 files, 21 tests passed
- `npm test -- apps/web/src/PortfolioControlSurface.test.tsx apps/web/src/ResourceLoadControlSurface.test.tsx` exit 0: 2 files, 21 tests passed
- `npm run test:integration` exit 0: 11 files, 65 tests passed
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0

## Review

- Bug-hunt finding fixed: P8-006/P8-009 evidence now includes E2E-071 backend direct denial for `action-create-corrective-task` plus empty task/control-audit readback after denial.
- Remaining coordination finding to close before final handoff: remove owned P8-009 locks after final verification and before P8-010 starts.

## Next

Claim `P8-010-phase8-verification-matrix-exit-gate`, promote eligible rows from blocked to verified using the fresh E2E evidence, run strict verifier without `--allow-blocked`, full regression/typecheck/lint, review loops, and final Phase 8 acceptance decision.
