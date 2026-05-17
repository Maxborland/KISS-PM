# Handoff — P12-001 Production deployment/env/secret contract

Timestamp: 2026-05-17T08:45:00.0000000+07:00

Status: accepted for the P12-001 implementation block. Phase 12 and Release 2 remain blocked.

Changed:
- Added `apps/api/src/phase12Deployment.ts`.
- Added `apps/api/src/phase12Deployment.test.ts`.
- Added `GET /health/deployment` in `apps/api/src/app.ts`.
- Expanded `.env.example` with P12 deployment variable names only.
- Added `docs/operations/PHASE_12_PRODUCTION_DEPLOYMENT_ENVIRONMENT.md`.
- Updated `docs/status/phase12-requirements-matrix.json` truthfully: P12-001 has implementation evidence but remains blocked for E2E-113.
- Updated queue and current state; next runnable is `P12-002-observability-readiness-runtime`.

Verification:
- `node scripts/agent-bus-guard.mjs --task P12-001-production-deployment-env-secret-contract --once` exit 0 at startup.
- `npm test -- apps/api/src/phase12Deployment.test.ts` exit 1 RED: missing module before implementation.
- `npm test -- apps/api/src/phase12Deployment.test.ts` exit 1 RED during bug-hunt: fixture-only switches were not denied in production-like smoke.
- `npm test -- apps/api/src/phase12Deployment.test.ts` exit 0: 1 file, 4 tests passed.
- `npm run test:integration` exit 0: 22 files, 116 tests passed.
- `npm test` exit 0: 102 files, 588 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase12-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase12-requirements-matrix.json` exit 1 expected: P12 rows remain blocked until E2E-110..115.
- `git diff --check` exit 0.

Review:
- Bug-hunt/code-review finding: production-like deployment smoke did not fail when fixture-only switches were enabled.
- Fix: added dev-only switch checks for `KISS_PM_ALLOW_TEST_FIXTURE_RESET` and `VITE_KISS_PM_ALLOW_FIXTURE_AUTH`, plus regression test and docs.

Next:
- Claim `P12-002-observability-readiness-runtime`.
- Keep P12 strict matrix blocked until E2E-110..115 and P12-010 pass.
