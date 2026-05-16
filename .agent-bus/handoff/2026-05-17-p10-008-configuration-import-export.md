# P10-008 configuration validation/export/import handoff

Task: `P10-008-configuration-validation-admin-preview-export-import-permissions-audit-api`
Status: accepted
Completed: 2026-05-17T05:10:39.4359715+07:00

## Changed

- Added configuration export/import package helpers in `packages/tenant-config`.
- Added checksum validation, tenant mismatch detection, validation issues with recovery text, import preview, apply, and audit metadata.
- Added Phase 10 runtime storage for import previews and import action executions.
- Added configuration overview, versions, validate, preview, publish, export, import-preview, and import-apply API routes.
- Added backend permission checks for `tenant.config.read`, `tenant.config.write`, `tenant.config.export`, and `tenant.config.import`.
- Added runtime readback after import for labels, custom-field registry, and action configuration.
- Added `ConfigurationOverviewSurface` and typed API client with Russian UI, export/import JSON controls, preview-before-apply, readback, audit/result evidence, read-only state, and validation recovery.
- Updated P10 matrix row `P10-008` with truthful blocked status pending P10-009 E2E browser/reload/cleanup evidence.

## Verification

- `npm test -- packages/tenant-config/src/configurationExportImport.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/api/src/phase10ConfigurationApi.test.ts` exit 0: 1 file, 4 tests passed.
- `npm test -- apps/web/src/ConfigurationOverviewSurface.test.tsx` exit 0: 1 file, 3 tests passed.
- `npm test -- packages/tenant-config apps/api/src/phase10TenantLabelsApi.test.ts apps/api/src/phase10ProcessTemplateApi.test.ts apps/api/src/phase10CustomFieldsApi.test.ts apps/api/src/phase10KpiThresholdsApi.test.ts apps/api/src/phase10SavedViewsApi.test.ts apps/api/src/phase10ActionConfigsApi.test.ts apps/api/src/phase10ConfigurationApi.test.ts` exit 0: 15 files, 56 tests passed.
- `npm test -- apps/web/src` exit 0: 18 files, 115 tests passed.
- `npm run test:integration` exit 0: 19 files, 94 tests passed.
- `npm test` exit 0: 92 files, 525 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase10-requirements-matrix.json` exit 1 expected: P10 strict gate remains blocked until E2E-090..095.
- `node scripts/agent-bus-guard.mjs --task P10-008-configuration-validation-admin-preview-export-import-permissions-audit-api --once` exit 0.
- `git diff --check` exit 0.

## Review

- Bug-hunt finding fixed: `/api/tenant/configuration/validate` initially consumed/replaced import preview state. It now uses pure domain validation and has a regression test proving preview -> validate -> apply works.
- Review hardening fix: read/export validation no longer advances Phase 10 runtime timestamps via `phase10Runtime.now`; read-only/export package timestamps use the Phase 2 fixed runtime clock.
- Independent review subagent could not be spawned because the session hit the agent thread limit. Local bug-hunt/requesting-code-review/receiving-code-review pass found no remaining Critical/Important/Medium issues in P10-008 scope.

## Next

Claim `P10-009-deterministic-phase10-fixtures-e2e` for deterministic Phase 10 fixtures and executable E2E-090..095. P10 strict exit remains blocked until P10-009 and P10-010 are accepted.
