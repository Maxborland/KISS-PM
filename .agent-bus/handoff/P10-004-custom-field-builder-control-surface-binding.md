# Handoff: P10-004 Custom field builder and control-surface binding

Completed: 2026-05-17T03:41:31.8468551+07:00
Agent: codex-agent
Verdict: accepted for block implementation; P10 phase remains blocked until E2E-090..095 and strict exit gate.

## Changed
- Added tenant-config custom-field preview/publish helpers with non-mutating dry-run, stale/duplicate/binding validation, and publish audit data.
- Added typed project custom-field values to ManagedProject with tenant/target/active/value validation, immutable source behavior, and audit/correlation metadata.
- Added control-surface binding helper for active project custom fields and Phase 8 portfolio readback rows for projects with custom field values.
- Added P10 custom-field API routes:
  - `GET /api/tenant/custom-fields`
  - `POST /api/tenant/custom-fields/preview`
  - `POST /api/tenant/custom-fields/publish`
  - `PUT /api/projects/:projectId/custom-fields/:fieldKey`
  - configuration audit includes custom-field publish and project value action executions.
- Added `custom_field.write` permission and enforced per-definition `permissionRules.writePermissionKey` for project value writes.
- Added `CustomFieldBuilderSurface` and `customFieldBuilderApiClient`, wired into app shell.
- Updated `docs/status/phase10-requirements-matrix.json`; P10-004 remains blocked only for future E2E-091 browser reload/cleanup evidence.

## Verification
- `npm test -- apps/api/src/phase10CustomFieldsApi.test.ts` exit 0: 1 file, 4 tests passed.
- `npm test -- apps/web/src/CustomFieldBuilderSurface.test.tsx` exit 0: 1 file, 4 tests passed.
- `npm test -- packages/tenant-config packages/project-core packages/control-surfaces` exit 0: 21 files, 106 tests passed.
- `npm test -- apps/web/src` exit 0: 14 files, 102 tests passed.
- `npm run test:integration` exit 0: 15 files, 83 tests passed.
- `npm test` exit 0: 81 files, 490 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

## Review Findings
- Fixed: value-write route ignored `definition.permissionRules.writePermissionKey`.
- Fixed: project-core accepted malformed custom-field snapshot enum strings.
- Fixed: UI test audit mock showed value-write evidence before value-write execution.

## Next
Claim `P10-005-kpi-threshold-builder-future-evaluation-impact`.
