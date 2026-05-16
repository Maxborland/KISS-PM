# P10-005 KPI threshold builder handoff

- Task: `P10-005-kpi-threshold-builder-future-evaluation-impact`
- Status: accepted
- Completed: 2026-05-17T04:06:15.7116415+07:00
- Agent: codex-p10-005

## Changed

- Added KPI threshold preview/publish domain helpers and tests in `packages/kpi-engine`.
- Added Phase 10 tenant-scoped KPI threshold read/preview/publish runtime and API routes.
- Added future KPI evaluation threshold impact through Phase 7 runtime while preserving historical evaluation threshold version traceability.
- Added KpiThresholdBuilderSurface UI and API client with preview-before-publish, API readback, read-only state, stale-preview recovery, and audit/result feedback.
- Updated `docs/status/phase10-requirements-matrix.json` truthfully. P10-005 remains blocked for strict phase verification until P10-009 E2E-092/E2E-094 proves browser reload/cleanup and full executable evidence.

## Review

- Bug-hunt finding fixed: publish now binds to the stored preview target instead of the first KPI bundle.
- Code-review finding handled: matrix remains blocked for missing P10-009 executable E2E evidence; no fake strict-green.

## Verification

- `npm test -- packages/kpi-engine/src/kpiEngine.test.ts` exit 0.
- `npm test -- apps/api/src/phase10KpiThresholdsApi.test.ts` exit 0.
- `npm test -- apps/web/src/KpiThresholdBuilderSurface.test.tsx` exit 0.
- `npm test -- packages/kpi-engine apps/api/src/phase10KpiThresholdsApi.test.ts apps/web/src/KpiThresholdBuilderSurface.test.tsx` exit 0.
- `npm test -- apps/web/src` exit 0.
- `npm test -- apps/api/src/phase10TenantLabelsApi.test.ts apps/api/src/phase10ProcessTemplateApi.test.ts apps/api/src/phase10CustomFieldsApi.test.ts apps/api/src/phase10KpiThresholdsApi.test.ts` exit 0.
- `npm run test:integration` exit 0.
- `npm test` exit 0.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

## Next

- Claim `P10-006-saved-views-control-surface-layout-builder-mvp`.
