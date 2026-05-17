# P12-005 Permission Tenant Isolation Matrix Smoke Handoff

Status: accepted
Completed: 2026-05-17T09:35:00.0000000+07:00

Changed:
- Added deterministic P12 permission and tenant-isolation smoke runtime.
- Added governed ops API routes for permission smoke and tenant-isolation smoke.
- Added ops permission catalog coverage for P12 audit/readiness keys.
- Added API tests for readback, execution, backend denial, audit evidence, tenant isolation, and reset cleanup.
- Updated P12 matrix truthfully; P12-005 remains blocked only for later E2E-111/E2E-112 browser/UI evidence.

Verification:
- `npm test -- apps/api/src/phase12PermissionIsolationApi.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/api/src/phase12PermissionIsolationApi.test.ts apps/api/src/phase12ReadinessApi.test.ts apps/api/src/phase12RecoveryApi.test.ts apps/api/src/phase2Api.test.ts` exit 0: 4 files, 19 tests passed.
- `npm run test:integration` exit 0: 25 files, 128 tests passed.
- `npm test` exit 0: 105 files, 600 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase12-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase12-requirements-matrix.json` exit 1 expected: P12 rows remain blocked until E2E-110..115 and P12-010.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P12-005-permission-tenant-isolation-matrix-smoke --once` exit 0.

Review:
- Bug-hunt finding: permission smoke missed P4/P5 representative command coverage. Fixed with RED test and P4 task/P5 schedule denial scenarios.
- Code-review finding: tenant-isolation project probe used a potentially absent project id. Fixed with deterministic setup project and reset cleanup assertions.

Next:
- Claim `P12-006-operator-readiness-surfaces`.
