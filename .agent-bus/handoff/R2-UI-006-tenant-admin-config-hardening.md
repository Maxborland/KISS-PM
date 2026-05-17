# R2-UI-006 Tenant Admin Config Hardening Handoff

Task: `R2-UI-006-tenant-admin-config-hardening`
Aliases: `R2-UI-006`, `R2-011`
Branch: `codex/r2-tenant-admin-config-hardening`
Status: completed
Completed: 2026-05-17T19:24:00+07:00

## Changed

- Added shared `RuntimeConfigPreview` in `apps/web/src/operationalSurfacePrimitives.tsx`.
- Connected runtime config preview to:
  - `SavedViewLayoutBuilderSurface`
  - `TenantLabelsAdminSurface`
  - `CustomFieldBuilderSurface`
  - `KpiThresholdBuilderSurface`
- Added preview coverage in the corresponding component tests.
- Added minimal CSS for runtime config preview and blocker rows.
- Updated `docs/status/release2-ui-requirements-matrix.json` evidence for `R2-011`.

## Verification

- RED: `npm test -- apps/web/src/SavedViewLayoutBuilderSurface.test.tsx apps/web/src/TenantLabelsAdminSurface.test.tsx apps/web/src/CustomFieldBuilderSurface.test.tsx apps/web/src/KpiThresholdBuilderSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` failed with 5 expected missing-runtime-preview failures.
- PASS: `npm test -- apps/web/src/SavedViewLayoutBuilderSurface.test.tsx apps/web/src/TenantLabelsAdminSurface.test.tsx apps/web/src/CustomFieldBuilderSurface.test.tsx apps/web/src/KpiThresholdBuilderSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` passed (5 files, 22 tests).
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `git diff --check`
- PASS: `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- EXPECTED FAIL: `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` is unsupported for this Release 2 backlog shape (`unsupported matrix phase: undefined`; R2 rows require `verified|blocked` in the old verifier).

## Decisions

- Kept this slice UI-only. No API, domain, package, or E2E production files were changed.
- Kept `R2-011` status `in_progress` in the matrix because E2E-R2-008/E2E-R2-009 remain for the final R2 exit evidence slice.

## Next

- Start `R2-012` Release 2 E2E, fixtures, sales-demo quality gate, and exit evidence.
- Re-run final agent-bus guard after locks are removed and before/after PR creation as needed.
