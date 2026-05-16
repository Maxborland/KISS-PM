# P6-006 resource planning API governed commands

- Status: accepted for the API block; Phase 6 strict exit remains blocked until UI and E2E-050..055.
- Agent: codex-agent-2
- Task: P6-006-resource-planning-api-governed-commands
- Completed: 2026-05-16T15:42:48+07:00

## Changed

- Added `apps/api/src/phase6Runtime.ts` with deterministic in-memory resource planning runtime.
- Added `apps/api/src/phase6ResourcePlanningApi.test.ts` covering read model, overload detail, dry-run no mutation, apply readback, permissions, tenant isolation, stale preview, invalid preconditions, and reserve-capacity preview.
- Added P6 resource routes in `apps/api/src/app.ts`.
- Added `resource.read` and `resource.write` permissions in `apps/api/src/phase2Runtime.ts`.
- Updated `docs/status/phase6-requirements-matrix.json` with truthful API evidence while keeping P6 rows blocked for missing UI/E2E.
- Marked P6-006 done in queue and added next runnable task P6-007 Resource Load Control surface.

## Verification

- `npm test -- apps/api/src/phase6ResourcePlanningApi.test.ts` exit 0: 5 tests passed.
- `npm test -- packages/resource-planning` exit 0: 4 files, 20 tests passed.
- `npm run test:integration` exit 0: 8 files, 38 tests passed.
- `npm test` exit 0: 46 files, 277 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase6-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase6-requirements-matrix.json` exit 1 as expected: blocked P6 rows remain until UI/E2E evidence.
- `git diff --check` exit 0.

## Review findings

- Finding: P6 API schema listed `reserve_capacity`, but runtime precondition initially rejected it because domain overload recommendations do not include that key. Fix: allowed `reserve_capacity` for API preview/apply and added a no-mutation preview test.
- Finding: test initially asserted the full readback load bucket array after apply and ignored unrelated valid buckets. Fix: narrowed assertion to the affected bucket.
- No unresolved Critical/Important/Medium API permission, audit, tenant isolation, or load-integrity findings remain for this block.

## Next

- P6-007-resource-load-control-surface: implement Russian Resource Load Control UI against the P6 API.
- Keep P6 strict matrix blocked until P6 UI and E2E-050..055 are implemented and passing.
