# P12-006 operator readiness surfaces handoff

Timestamp: 2026-05-17T09:51:20+07:00

Status: accepted implementation block; P12 phase gate remains blocked until E2E-110..115 and P12-010.

Changed:
- Added resettable release-readiness run state with tenant-scoped latestRun and run detail readback.
- Added governed `POST /api/ops/release-readiness/run`, `GET /api/ops/release-readiness/runs/:runId`, and tenant-scoped `GET /api/ops/audit`.
- Added `OperatorReadinessSurface`, typed API client, App navigation/wiring, and focused styles.
- Updated P12 matrix P12-006 with truthful blocked status pending E2E-113/E2E-114.

Fresh verification:
- `npm test -- apps/api/src/phase12ReadinessApi.test.ts` exit 0: 1 file, 5 tests passed.
- `npm test -- apps/api/src/phase12ReadinessApi.test.ts apps/api/src/phase12RecoveryApi.test.ts apps/api/src/phase12PermissionIsolationApi.test.ts` exit 0: 3 files, 12 tests passed.
- `npm test -- apps/web/src/OperatorReadinessSurface.test.tsx apps/web/src/App.test.tsx` exit 0: 2 files, 21 tests passed.
- `npm test -- apps/web/src` exit 0: 20 files, 129 tests passed.
- `npm run test:integration` exit 0: 25 files, 130 tests passed.
- `npm test` exit 0: 106 files, 609 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase12-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase12-requirements-matrix.json` exit 1 expected: all P12 rows still blocked pending E2E-110..115/P12-010.
- `git diff --check` exit 0.

Review notes:
- Bug-hunt finding fixed: App test DTO mocks were widened to `string`; explicit P12 DTO types now keep test fixtures aligned with client contract.
- Bug-hunt finding fixed: added direct backend denial coverage for `/api/ops/audit` for a read-only observer.
- Component evidence includes API refetch after commands and remount/readback persistence for latest readiness run, avoiding local-only success proof.

Next runnable:
- `P12-007-demo-tenant-template-pack-onboarding`.
