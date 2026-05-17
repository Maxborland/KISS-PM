# Phase 12 Security, Privacy, and Audit Review

## Scope

This review covers the repository-local Phase 12 release path for KISS PM:

- API route authentication, permission checks, and tenant isolation surfaces;
- fixture-only switches that must not be enabled in production-like smoke;
- secret and sensitive-value handling in deployment/readiness DTOs;
- browser/client unsafe sink scan for obvious XSS primitives;
- ops audit surfaces added for release readiness and recovery smoke.

External penetration testing, cloud IAM, production database encryption, real secret-manager provisioning, and legal privacy/compliance certification are out of repository scope until deployment credentials and environment ownership are provided.

## Findings and Fixes

### Fixed: backend fixture authentication lacked a production kill switch

Risk: Important. The API uses deterministic `?testUser=...` fixture authentication for local and E2E verification. Before this block, production-like deployment smoke denied fixture reset and frontend fixture auth switches, but the backend application runtime did not expose an equivalent opt-out for `testUser`.

Fix:

- `createApiApp({ allowTestFixtureAuth: false })` now rejects route session resolution with `403 test_mode_only`.
- `apps/api/src/server.ts` enables fixture auth only outside `KISS_PM_RUNTIME_ENV=production_like`, `KISS_PM_RUNTIME_ENV=production`, and `NODE_ENV=production` unless `KISS_PM_ALLOW_TEST_FIXTURE_AUTH=true` is explicitly set.
- `validatePhase12DeploymentEnvironment` fails `production_like` / `production` smoke when `KISS_PM_ALLOW_TEST_FIXTURE_AUTH=true`.
- `apps/api/src/phase12Deployment.test.ts` proves backend denial and deployment-smoke failure for the backend fixture-auth switch.

Residual release gate: E2E-111/E2E-112 must still prove production permission and tenant-isolation behavior through executable browser/API flows before P12-004 can become fully verified.

## Scan Evidence

Commands executed on 2026-05-17:

- `rg -n "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\\.write|eval\\(|new Function|setTimeout\\(\\s*['\\\"]|setInterval\\(\\s*['\\\"]|localStorage|sessionStorage|postMessage|setAttribute\\(\\s*['\\\"]on" apps packages`
  - exit 1, no unsafe sink matches in `apps` or `packages`.
- `rg -n "secret://kiss-pm/prod/app|raw-super-secret-value|KISS_PM_SECRET_REF=.*[^=]" apps docs .env.example -g "!node_modules/**"`
  - exit 0, matches are controlled placeholder references or negative test fixtures; tests assert the raw values are not returned in deployment/readiness DTOs.
- `rg -n 'requireSession\\(runtime, context\\.req\\.query\\("testUser"\\)\\)|requireRouteSession\\(' apps/api/src/app.ts`
  - exit 0, route-level session resolution is centralized through `requireRouteSession`; no remaining direct `requireSession(runtime, context.req.query("testUser"))` route call matched.

## Release Notes

P12-004 is implementation-complete as an internal review/fix block, but the matrix row remains blocked until E2E-111 and E2E-112 provide executable permission, tenant-isolation, audit, readback, reload, and cleanup evidence.
