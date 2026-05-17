# R2-UI-006 Tenant Admin Config Hardening

Status: done
Phase: R2
Aliases: R2-UI-006, R2-011

## Scope

Implement Release 2 UI hardening for Tenant Admin saved views/layout/runtime config preview surfaces.

Owned files:

- `apps/web/src/SavedViewLayoutBuilderSurface.tsx`
- `apps/web/src/SavedViewLayoutBuilderSurface.test.tsx`
- `apps/web/src/TenantLabelsAdminSurface.tsx`
- `apps/web/src/TenantLabelsAdminSurface.test.tsx`
- `apps/web/src/CustomFieldBuilderSurface.tsx`
- `apps/web/src/CustomFieldBuilderSurface.test.tsx`
- `apps/web/src/KpiThresholdBuilderSurface.tsx`
- `apps/web/src/KpiThresholdBuilderSurface.test.tsx`
- `apps/web/src/operationalSurfacePrimitives.tsx`
- `apps/web/src/operationalSurfacePrimitives.test.tsx`
- `apps/web/src/styles.css`
- `docs/status/release2-ui-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/**`
- `.agent-bus/events/events.jsonl`

## Acceptance

- Saved views, tenant labels, custom fields, and KPI thresholds expose runtime-impact preview before publish.
- Publish result shows versioned audit/readback and affected runtime surfaces after refetch/reload.
- Invalid configuration is blocked with affected-surface explanation and no partial mutation.
- Read-only users see disabled reasons, not broken controls.
- Component tests cover preview/publish/validation states.
- No API, domain, package, or E2E production changes in this slice.

## Verification

- RED: `npm test -- apps/web/src/SavedViewLayoutBuilderSurface.test.tsx apps/web/src/TenantLabelsAdminSurface.test.tsx apps/web/src/CustomFieldBuilderSurface.test.tsx apps/web/src/KpiThresholdBuilderSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` failed with 5 expected missing-runtime-preview failures.
- PASS: `npm test -- apps/web/src/SavedViewLayoutBuilderSurface.test.tsx apps/web/src/TenantLabelsAdminSurface.test.tsx apps/web/src/CustomFieldBuilderSurface.test.tsx apps/web/src/KpiThresholdBuilderSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` passed (5 files, 22 tests).
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `git diff --check`
- PASS: `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- EXPECTED FAIL: `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` is unsupported for this R2 backlog shape (`unsupported matrix phase: undefined`; status must be verified or blocked).
- `npm test -- apps/web/src/SavedViewLayoutBuilderSurface.test.tsx apps/web/src/TenantLabelsAdminSurface.test.tsx apps/web/src/CustomFieldBuilderSurface.test.tsx apps/web/src/KpiThresholdBuilderSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node scripts/agent-bus-guard.mjs --task R2-UI-006-tenant-admin-config-hardening --once`

## Result

Completed 2026-05-17.

- Added shared `RuntimeConfigPreview` primitive.
- Connected runtime preview to saved views, tenant labels, custom fields, and KPI thresholds.
- Updated Release 2 matrix evidence for `R2-011`.
- Left `E2E-R2-008` and `E2E-R2-009` for `R2-012` exit evidence.
