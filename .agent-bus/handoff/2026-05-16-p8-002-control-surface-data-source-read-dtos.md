# P8-002 Control Surface Data Source Read DTOs

Status: accepted block; P8 phase not accepted.

Changed:
- Added tenant-scoped control surface read DTO builder in `packages/control-surfaces`.
- Added deterministic Portfolio Control read runtime in `apps/api/src/phase8Runtime.ts`.
- Added read-only API routes for control surface list/detail/view.
- Added P8 permissions to Phase 2 profiles and API package dependency on `@kiss-pm/control-surfaces`.
- Updated P8 matrix truthfully; P8-002 remains blocked for later UI/E2E evidence.

Verification:
- `node scripts/agent-bus-guard.mjs --task P8-002-control-surface-data-source-read-dtos --once` exit 0 at startup.
- `npm test -- packages/control-surfaces/src/controlSurfaceReadModel.test.ts apps/api/src/phase8ControlSurfacesApi.test.ts` exit 1 RED: missing read model/API routes.
- `npm test -- packages/control-surfaces/src/controlSurfaceReadModel.test.ts apps/api/src/phase8ControlSurfacesApi.test.ts` exit 1 RED after review test: malformed pagination was not rejected.
- `npm test -- packages/control-surfaces/src/controlSurfaceReadModel.test.ts apps/api/src/phase8ControlSurfacesApi.test.ts` exit 0: 2 files, 11 tests passed.
- `npm test -- packages/control-surfaces apps/api/src/phase8ControlSurfacesApi.test.ts` exit 0: 3 files, 19 tests passed.
- `npm run test:integration` exit 0: 10 files, 50 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 57 files, 361 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

Review findings:
- Bug-hunt found malformed pagination could return partial read DTOs. Fixed with package/API tests and strict page validation.
- Code review found row action/drilldown availability used raw permission keys without scope evaluation. Fixed by passing backend policy-evaluated callbacks into the read model and adding API coverage where the permission key exists but row scope denies availability.
- Code review found stale matrix evidence counts. Fixed counts and evidence.

Cleanup:
- P8-002 adds read-only deterministic in-memory runtime derived from P6/P7 projections. `/test-fixtures/reset` recreates P8 runtime. E2E cleanup/readback remains for P8-009.

Next:
- `P8-003-action-definitions-execution-log-foundation`.
