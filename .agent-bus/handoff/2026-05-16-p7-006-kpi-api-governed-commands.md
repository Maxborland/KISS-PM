# Handoff: P7-006 KPI API Governed Commands

- task_id: P7-006-kpi-api-governed-commands
- agent_id: codex-p7-api
- completed_at: 2026-05-16T19:10:30+07:00
- verdict: accepted

## Changed

- Implemented deterministic P7 KPI API/runtime read model and governed commands.
- Added routes for KPI definitions, definition preview/create/publish/retire, evaluation run/readback, deviations/readback, and audit/action evidence.
- Added backend permissions `kpi:read`, `kpi.config:write`, and `kpi.evaluate:execute` to Phase 2 access profiles.
- Added API tests for tenant isolation, permission denial, dry-run no mutation, governed command audit, evaluation/deviation readback, version conflicts, invalid formulas, and source-entity preconditions.
- Updated `docs/status/phase7-requirements-matrix.json` truthfully: P7-006 has API evidence but stays blocked until UI/E2E evidence exists.

## Verification

- `npm test -- apps/api/src/phase7KpiApi.test.ts` exit 0: 1 file, 5 tests passed.
- `npm test -- packages/kpi-engine` exit 0: 1 file, 11 tests passed.
- `npm run test:integration` exit 0: 9 files, 44 tests passed.
- `npm test -- apps/api/src/phase6ResourcePlanningApi.test.ts` exit 0: 1 file, 6 tests passed.
- `npm test` exit 0: 51 files, 315 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase7-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase7-requirements-matrix.json` exit 1 as expected: P7 rows remain blocked until UI/E2E/exit gate.
- `node scripts/agent-bus-guard.mjs --task P7-006-kpi-api-governed-commands --once` exit 0.
- `git diff --check` exit 0.

## Review Findings

- Important: explicit KPI `sourceValues` could be accepted for a different entity than the evaluation target. Fixed in `apps/api/src/phase7Runtime.ts` and covered by `apps/api/src/phase7KpiApi.test.ts`.
- No unresolved Critical/Important/Medium findings remain in the P7-006 API scope.

## Next

- Claim `P7-007-kpi-definition-admin-ui`.
- Build the KPI Definition Admin UI against the accepted P7 API.
- Keep P7 strict gate blocked until E2E-060..064 and P7-010 exit verification pass.
