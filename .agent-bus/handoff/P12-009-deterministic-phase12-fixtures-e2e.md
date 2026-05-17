# P12-009 deterministic Phase 12 fixtures and E2E handoff

Task: `P12-009-deterministic-phase12-fixtures-e2e`
Status: accepted implementation block
Updated: 2026-05-17T10:29:00.6710000+07:00

## Changed

- Added executable Phase 12 Playwright scenarios:
  - `E2E-111` in `e2e/tests/phase12/permission-matrix-smoke.spec.ts`
  - `E2E-112` in `e2e/tests/phase12/tenant-isolation-full.spec.ts`
  - `E2E-113` in `e2e/tests/phase12/production-deploy-smoke.spec.ts`
  - `E2E-114` in `e2e/tests/phase12/recovery-smoke.spec.ts`
- Reused existing `E2E-110` and `E2E-115` from P12-008, so the Phase 12 suite now covers `E2E-110..115`.
- Added `getApiJson` helper in `e2e/tests/phase12/helpers.ts`.
- Updated `docs/status/phase12-requirements-matrix.json`:
  - P12-001..P12-009 are now verified with structured E2E evidence.
  - P12-010 remains blocked for the final strict exit gate.

## Evidence

- `npm run test:e2e:phase -- --phase 12` exit 1 RED: new E2E-111..114 initially exposed over-strict audit/secret assertions and an invalid Tenant B fixture shape reference.
- `npm run test:e2e:phase -- --phase 12` exit 0: 6 tests passed, E2E-110..115 recorded in `test-results/kiss-pm-e2e-last-run.json`.
- `npm test -- packages/shared-test-fixtures` exit 0: 10 files, 20 tests passed.
- `npm test -- apps/api/src/phase12PermissionIsolationApi.test.ts apps/api/src/phase12RecoveryApi.test.ts apps/api/src/phase12ReadinessApi.test.ts` exit 0: 3 files, 12 tests passed.
- `npm test -- apps/web/src/OperatorReadinessSurface.test.tsx` exit 0: 1 file, 6 tests passed.
- `npm test` exit 0: 107 files, 612 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase12-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase12-requirements-matrix.json` exit 1 expected: P12-010 remains blocked until final strict exit gate.
- `git diff --check` exit 0 with line-ending normalization warning for `docs/status/phase12-requirements-matrix.json`.

## Review

- Bug-hunt finding: E2E-113 originally checked the main deterministic API target `development`, which was too weak for production-like deployment smoke.
- Fix: E2E-113 now starts an isolated `production_like` API process with required env vars, mocked external services, fixture reset/auth disabled, and verifies `/health/deployment` before exercising readiness UI/API on the deterministic test server.
- Code-review finding: nested audit target assertions were too strict and failed on valid richer audit DTOs.
- Fix: audit assertions now use nested `expect.objectContaining` while still proving action key and target entity id.

## Next

Next runnable task: `P12-010-phase12-verification-matrix-market-release-exit-gate`.

Only P12-010 may mark Phase 12 and Release 2 accepted, after strict matrix verification, E2E-110..115, full tests/typecheck/lint, review loop, agent-bus guard, and logical commit pass.
