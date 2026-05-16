# P10-007 action configuration handoff

Task: `P10-007-action-enable-disable-form-configuration`
Status: accepted
Completed: 2026-05-17T04:48:51.5246150+07:00

## Changed

- Added action configuration domain helpers in `packages/action-engine`.
- Added governed Phase 10 action-config preview/publish/readback runtime and API routes.
- Added `action.config.write` to the tenant-admin permission catalog.
- Projected tenant-disabled actions into Portfolio Control read models as `configuration_disabled`.
- Denied direct governed action preview/execute when an action is disabled by tenant configuration.
- Added `ActionConfigurationSurface` and typed API client with preview, publish, API readback, audit evidence, read-only state, and stale-preview recovery.
- Updated P10 matrix row `P10-007` with truthful blocked status pending P10-009 E2E browser/reload/cleanup evidence.

## Verification

- `npm test -- packages/action-engine/src/actionConfiguration.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/api/src/phase10ActionConfigsApi.test.ts` exit 0: 1 file, 2 tests passed.
- `npm test -- apps/web/src/ActionConfigurationSurface.test.tsx` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/web/src/PortfolioControlSurface.test.tsx apps/web/src/ActionConfigurationSurface.test.tsx` exit 0: 2 files, 17 tests passed after review fix.
- `npm test -- apps/web/src` exit 0: 17 files, 112 tests passed.
- `npm run test:integration` exit 0: 18 files, 90 tests passed.
- `npm test` exit 0: 89 files, 515 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase10-requirements-matrix.json` exit 1 expected: P10 strict gate remains blocked until E2E-090..095.
- `git diff --check` exit 0.

## Review

- Bug-hunt finding fixed: Portfolio Control previously could present configuration-disabled actions with generic not-recommended copy; it now shows `отключено конфигурацией` and is covered by `PortfolioControlSurface.test.tsx`.
- Independent review subagent could not be spawned because the session hit the agent thread limit. Local bug-hunt/requesting-code-review/receiving-code-review pass found no remaining Critical/Important/Medium issues in P10-007 scope.

## Next

Claim `P10-008-configuration-validation-admin-preview-export-import-permissions-audit-api` for configuration validation, admin preview, export/import, permissions, and audit API/UI work. P10 strict exit remains blocked until P10-009 E2E-090..095 and P10-010 strict matrix exit gate.
