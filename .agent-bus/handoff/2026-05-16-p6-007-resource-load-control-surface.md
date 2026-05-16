# P6-007 resource load control surface handoff

- Agent: codex-agent-2
- Task: P6-007-resource-load-control-surface
- Verdict: accepted for this UI block; Phase 6 gate remains blocked until E2E-050..055.
- Commit target: `Implement P6 resource load control surface`

## Changed

- Added `apps/web/src/resourcePlanningApiClient.ts` for Phase 6 resource planning API routes.
- Added `apps/web/src/ResourceLoadControlSurface.tsx` with Russian management-control UI: load buckets, overload signal, affected entities, recommended preview, apply, reservation action, audit/result feedback, permission/error/empty/loading states, and API readback refresh.
- Added `apps/web/src/ResourceLoadControlSurface.test.tsx` with component tests for read model, preview/apply, audit, read-only denial, stale preview recovery, and reload/refetch behavior.
- Wired the surface into `apps/web/src/App.tsx` and navigation; added scoped styles in `apps/web/src/styles.css`.
- Updated `docs/status/phase6-requirements-matrix.json`, `.agent-bus/queue.json`, and `.agent-bus/state/CURRENT.md`.

## Verification

- `npm test -- apps/web/src/ResourceLoadControlSurface.test.tsx` exit 0: 7 tests passed.
- `npm test -- apps/web/src/App.test.tsx` exit 0: 12 tests passed.
- `npm test -- apps/web/src` exit 0: 5 files, 38 tests passed.
- `npm test -- apps/api/src/phase6ResourcePlanningApi.test.ts` exit 0: 5 tests passed.
- `npm test -- packages/resource-planning` exit 0: 4 files, 20 tests passed.
- `npm run test:integration` exit 0: 8 files, 38 tests passed.
- `npm test` exit 0: 47 files, 284 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase6-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase6-requirements-matrix.json` exit 1 as expected: all P6 rows remain blocked until executable E2E/phase-exit evidence.
- `git diff --check` exit 0.

## Review notes

- Bug-hunt/code-review self-review found one medium edge: the Gantt-open action used a string cast after an optional array lookup. Fixed by deriving `selectedProjectId` and reran the narrow UI test, typecheck, and lint.
- No unresolved Critical/Important/Medium findings remain for this block.

## Next

- Claim `P6-009-deterministic-phase6-fixtures-e2e`.
- Implement deterministic Phase 6 fixtures and Playwright E2E-050..055 over the accepted P6 API and Resource Load Control UI.
- Required proof for the next block: browser UI flow, backend direct denial, API/domain readback, audit/action evidence, reload persistence, and cleanup/reset.
