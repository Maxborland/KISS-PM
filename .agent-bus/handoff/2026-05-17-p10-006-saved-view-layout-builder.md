# P10-006 saved views and control-surface layout builder handoff

- Task: `P10-006-saved-views-control-surface-layout-builder-mvp`
- Agent: `codex-p10-006`
- Completed: 2026-05-17T04:26:38.6563821+07:00
- Verdict: accepted for the implementation block; Phase 10 strict gate remains blocked until E2E-090..095.

## Changed

- Added saved-view/control-surface layout preview and publish helpers in `packages/control-surfaces`.
- Added governed `/api/tenant/saved-views` read/preview/publish routes, runtime layout projection, previous-version readback, and configuration audit/action evidence.
- Added `SavedViewLayoutBuilderSurface` and `savedViewLayoutBuilderApiClient` in `apps/web`.
- Wired the surface into the app shell.
- Updated `docs/status/phase10-requirements-matrix.json`.

## Verification

- `npm test -- packages/control-surfaces/src/controlSurfaceLayoutBuilder.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/api/src/phase10SavedViewsApi.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/web/src/SavedViewLayoutBuilderSurface.test.tsx` exit 0: 1 file, 3 tests passed.
- `npm test -- packages/control-surfaces apps/api/src/phase10TenantLabelsApi.test.ts apps/api/src/phase10ProcessTemplateApi.test.ts apps/api/src/phase10CustomFieldsApi.test.ts apps/api/src/phase10KpiThresholdsApi.test.ts apps/api/src/phase10SavedViewsApi.test.ts` exit 0: 9 files, 33 tests passed.
- `npm test -- apps/web/src` exit 0: 16 files, 108 tests passed.
- `npm run test:integration` exit 0: 17 files, 88 tests passed.
- `npm test` exit 0: 86 files, 506 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase10-requirements-matrix.json` exit 1 expected: P10 rows remain blocked until E2E-090..095 and phase exit evidence exist.
- `node scripts/agent-bus-guard.mjs --task P10-006-saved-views-control-surface-layout-builder-mvp --once` exit 0 before completion updates.
- `git diff --check` exit 0.

## Review findings

- Fixed hardcoded publish target binding by resolving the stored preview target before publish.
- Fixed web API error handling so the surface receives parsed API error messages instead of raw JSON/text.

## Next

- Claim `P10-007-action-enable-disable-form-configuration`.
- Implement action enable/disable and safe action-form configuration for E2E-093/E2E-094/E2E-095 readiness.
