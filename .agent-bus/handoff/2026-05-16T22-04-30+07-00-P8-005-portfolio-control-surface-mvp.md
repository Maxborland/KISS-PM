# P8-005 Portfolio Control Surface MVP Handoff

Status: accepted for block P8-005; Phase 8 remains blocked.

## Changed
- Added typed P8 Portfolio Control API client.
- Added Portfolio Control web surface with TanStack Query read model, widgets, severity rows, source refs, Gantt drilldown, recommended action selection, dry-run preview, apply-after-preview, audit/result panel, permission states, and API error recovery.
- Wired Portfolio Control into the app shell and navigation.
- Added component tests for load, empty/error, read-only, preview no-mutation, not-implemented execute, successful execute readback/audit shape, audit-hidden permission state, stale preview recovery, and actions/audit API errors.
- Updated Phase 8 matrix P8-005 evidence truthfully; row remains blocked until P8-006/P8-007/P8-008 and P8-009 E2E.

## Review fixes
- Fixed API action DTO mismatch by using top-level `commandType` from `/api/control/surfaces/:surfaceId/actions`.
- Fixed execute success contract to consume API `{ result }` and refetch readback/audit instead of expecting `{ execution, readback }`.
- Fixed hidden actions/audit query failures with explicit UI error states.
- Fixed missing `audit.read` ambiguity by reporting command success with audit visibility state, not fake failure.
- Fixed apply-error recovery when readback also fails.

## Verification
- `npm test -- apps/web/src/PortfolioControlSurface.test.tsx` exit 0: 1 file, 11 tests passed.
- `npm test -- apps/web/src` exit 0: 9 files, 77 tests passed.
- `npm test -- apps/api/src/phase8ActionExecutionApi.test.ts apps/api/src/phase8ControlSurfacesApi.test.ts` exit 0: 2 files, 13 tests passed.
- `npm run test:integration` exit 0: 11 files, 57 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 60 files, 385 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

## Next
Claim `P8-006-corrective-action-from-kpi-deviation` and wire `create_corrective_action` to a real canonical task/project action binding with source KPI signal evidence, backend permission guard, audit/action log, and readback/projection refresh.
