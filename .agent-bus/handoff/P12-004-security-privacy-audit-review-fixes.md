# P12-004 Security Privacy Audit Review Fixes

Status: accepted as an implementation/review block on 2026-05-17T09:14:30.0000000+07:00.

Changed:

- Added `docs/security/PHASE_12_SECURITY_PRIVACY_AUDIT.md` with repository-local security/privacy/audit scope, scan evidence, fixed finding, and residual E2E gate.
- Added `CreateApiAppOptions.allowTestFixtureAuth` and centralized API route session resolution through `requireRouteSession`.
- Added `shouldAllowPhase12TestFixtureAuth` and server wiring so fixture auth is disabled by default for `KISS_PM_RUNTIME_ENV=production_like`, `KISS_PM_RUNTIME_ENV=production`, and `NODE_ENV=production` unless `KISS_PM_ALLOW_TEST_FIXTURE_AUTH=true` is explicit.
- Extended production deployment validation to fail production-like/production smoke when `KISS_PM_ALLOW_TEST_FIXTURE_AUTH=true`.
- Updated deployment docs and P12 matrix row P12-004 truthfully.

Verification:

- `node scripts/agent-bus-guard.mjs --task P12-004-security-privacy-audit-review-fixes --once` exit 0 at startup.
- `rg` unsafe browser sink scan exit 1: no matches in `apps` or `packages`.
- `rg` secret placeholder scan exit 0: matches were controlled placeholders/negative tests only.
- `rg` route-session bypass scan exit 0: API route sessions are centralized through `requireRouteSession`; no direct `requireSession(runtime, context.req.query("testUser"))` route call matched.
- `npm test -- apps/api/src/phase12Deployment.test.ts` exit 0: 1 file, 6 tests passed.
- `npm test -- apps/api/src/phase12Deployment.test.ts apps/api/src/phase12ReadinessApi.test.ts apps/api/src/phase12RecoveryApi.test.ts` exit 0: 3 files, 13 tests passed.
- `npm run test:integration` exit 0: 24 files, 125 tests passed.
- `npm test` exit 0: 104 files, 597 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase12-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase12-requirements-matrix.json` exit 1 expected: P12 rows remain blocked until E2E-110..115 and P12-010.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P12-004-security-privacy-audit-review-fixes --once` exit 0 before handoff.

Review findings:

- Important finding fixed: server initially disabled fixture auth only for `NODE_ENV=production`; it now uses the Phase 12 target helper and also disables by default for `KISS_PM_RUNTIME_ENV=production_like` and `KISS_PM_RUNTIME_ENV=production`.
- No unresolved Critical/Important/Medium findings remain in P12-004 scope.

Residual gate:

- P12-004 matrix row remains blocked until E2E-111/E2E-112 provide executable permission, tenant-isolation, audit/readback/reload, and cleanup evidence.
- Release 2 is not ready.

Next:

- Claim `P12-005-permission-tenant-isolation-matrix-smoke`.
