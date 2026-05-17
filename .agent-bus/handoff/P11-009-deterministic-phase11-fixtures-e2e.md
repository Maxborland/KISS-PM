# P11-009 deterministic Phase 11 fixtures and E2E handoff

Status: accepted
Completed: 2026-05-17T08:09:46.1465239+07:00

Changed:
- Added deterministic Phase 11 shared fixture seed and defensive-copy tests.
- Added Playwright E2E-100..104 under `e2e/tests/phase11/`.
- Added a narrow `projectId` query hook in `apps/web/src/App.tsx` so E2E-103 can open an imported canonical project through the existing Project Work control surface.
- Updated `docs/status/phase11-requirements-matrix.json`: P11-001..P11-009 verified with structured E2E evidence; P11-010 remains blocked for strict exit-gate aggregation.

Verification:
- `npm test -- packages/shared-test-fixtures/src/phase11Fixtures.test.ts` exit 1 RED: `phase11Fixtures` module was missing.
- `npm test -- packages/shared-test-fixtures/src/phase11Fixtures.test.ts` exit 0: 1 file, 2 tests passed.
- `npm test -- packages/shared-test-fixtures` exit 0: 9 files, 17 tests passed.
- `npm test -- apps/api/src/phase11IntegrationsApi.test.ts` exit 0: 1 file, 8 tests passed.
- `npm test -- apps/web/src/IntegrationAdminDiagnosticsSurface.test.tsx apps/web/src/ProjectWorkControlSurface.test.tsx` exit 0: 2 files, 14 tests passed.
- `npm run test:e2e:phase -- --phase 11` exit 0: 5 Playwright tests passed.
- `npm test` exit 0: 101 files, 579 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0 after removing an unused E2E helper import.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase11-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase11-requirements-matrix.json` exit 1 expected: P11-010 remains blocked until final exit-gate task.
- `git diff --check` exit 0.

Review:
- Bug-hunt found a stale `Pending P11-009` test entry and stale P11-010 blocker wording in the matrix after E2E passed. Fixed matrix text and reran matrix verifier.
- Code-review pass found no remaining Critical/Important/Medium issues in the P11-009 scope.

Next:
- Claim `P11-010-phase11-verification-matrix-exit-gate`.
- Aggregate final strict Phase 11 evidence and make `node scripts/verify-requirements-matrix.mjs docs/status/phase11-requirements-matrix.json` pass without `--allow-blocked`.
