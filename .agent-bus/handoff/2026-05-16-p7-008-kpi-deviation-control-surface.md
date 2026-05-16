# P7-008 KPI Deviation Control Surface Handoff

- task: P7-008-kpi-deviation-control-surface
- status: accepted for this UI block
- completed_at: 2026-05-16T12:41:28Z

## Changed

- Added `apps/web/src/kpiDeviationApiClient.ts` for typed P7 KPI deviation list/detail, evaluation run, and audit API calls.
- Added `apps/web/src/KpiDeviationControlSurface.tsx` and `apps/web/src/KpiDeviationControlSurface.test.tsx`.
- Wired the KPI Deviation Control surface into `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, and `apps/web/src/styles.css`.
- Updated `docs/status/phase7-requirements-matrix.json` P7-008 with truthful UI evidence while keeping E2E rows blocked.

## Evidence

- `npm test -- apps/web/src/KpiDeviationControlSurface.test.tsx` exit 0: 8 tests passed.
- `npm test -- apps/web/src/App.test.tsx` exit 0: 14 tests passed.
- `npm test -- apps/web/src` exit 0: 8 files, 66 tests passed.
- `npm test -- apps/api/src/phase7KpiApi.test.ts` exit 0: 5 tests passed.
- `npm run test:integration` exit 0: 9 files, 44 tests passed.
- `npm test` exit 0: 53 files, 335 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase7-requirements-matrix.json` exit 0.

## Review

- Bug Hunt and requested code review findings were processed through receiving-code-review.
- Fixed local-only action evidence, audit permission leakage, partial traceability, and KPI navigation targeting.

## Next

Claim `P7-009-deterministic-phase7-fixtures-e2e`. Phase 7 remains blocked until executable E2E-060..064 and P7-010 strict exit gate pass.
