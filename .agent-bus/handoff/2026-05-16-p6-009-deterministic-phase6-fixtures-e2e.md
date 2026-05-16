# P6-009 deterministic Phase 6 fixtures and E2E

- Status: accepted
- Task: P6-009-deterministic-phase6-fixtures-e2e
- Completed: 2026-05-16T17:22:00+07:00
- Commit: pending at handoff creation

## Changed

- Added deterministic Phase 6 shared fixture seed for Tenant A/Tenant B resource load, overload, assignment, reservation, permission users, and E2E ids.
- Added executable Playwright E2E-050..055 in `e2e/tests/phase6/`.
- Updated E2E catalog statuses for E2E-050..055 to `passing`.
- Updated Phase 6 matrix rows P6-001..P6-009 with structured E2E evidence; P6-010 remains blocked for final strict phase-exit gate.
- Fixed narrow P6 UI DTO mismatch: API/domain returns `loadPercent`; Resource Load Control no longer expects stale `utilizationPercent`.

## Evidence

- `npm test -- packages/shared-test-fixtures/src/phase6Fixtures.test.ts` exit 0: 2 tests passed.
- `npm test -- apps/web/src/ResourceLoadControlSurface.test.tsx` exit 0: 7 tests passed.
- `npm test -- apps/api/src/phase6ResourcePlanningApi.test.ts` exit 0: 5 tests passed.
- `npm test -- packages/resource-planning` exit 0: 4 files, 20 tests passed.
- `cmd /c "set PW_API_PORT=4287&& set PW_WEB_PORT=5287&& npm run test:e2e:phase -- --phase 6"` exit 0: E2E-050..055 passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase6-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase6-requirements-matrix.json` exit 1: expected P6-010 blocked final gate row.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P6-009-deterministic-phase6-fixtures-e2e --once` exit 0.

## Notes

- PowerShell argument forwarding dropped `--phase`; the successful required npm command was run through `cmd /c` so `scripts/run-e2e.mjs` received `--phase 6`.
- Default port `4187` was initially busy; the accepted run used `PW_API_PORT=4287` and `PW_WEB_PORT=5287`.
- Strict matrix is not expected to pass until P6-010 flips the final exit-gate row after the final review/verification loop.

## Next

Claim `P6-010-phase6-verification-matrix-exit-gate`, run the final P6 gate loop, and do not call Release 2 ready after P6.
