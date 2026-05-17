# Handoff: R2-UI-003 Resource Capacity Hardening

Status: completed
Branch: `codex/r2-resource-capacity-hardening`
Time: 2026-05-17T17:43:00+07:00

## Changed

- Implemented Resource Load `CapacityMatrix` with hierarchy rows, sticky resource/day headers, crosshair, severity heatmap, reduced-capacity exception, overload/free-capacity states, summary strip, and source-aware cell drilldown.
- Extended resource conflict preview/result feedback with permission trace, warnings/blockers, confirmation state, changed assignment/reservation ids, overload status, audit evidence, and API readback bucket count.
- Added component tests for R2-007/R2-008 behavior and updated Release 2 requirements matrix evidence.

## Files

- `apps/web/src/ResourceLoadControlSurface.tsx`
- `apps/web/src/ResourceLoadControlSurface.test.tsx`
- `apps/web/src/styles.css`
- `docs/status/release2-ui-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

## Verification

- RED observed: `npm test -- apps/web/src/ResourceLoadControlSurface.test.tsx` failed with 4 expected missing-behavior failures for matrix, drilldown, preview trace, and apply readback details.
- PASS: `npm test -- apps/web/src/ResourceLoadControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` (2 files, 15 tests).
- PASS: `npm run typecheck`.
- PASS: `npm run lint`.
- PASS: `git diff --check`.
- PASS: `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`.
- EXPECTED GAP: `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` fails because the generic verifier does not support the R2 backlog shape or `planned/in_progress` statuses.
- PASS: `node scripts/agent-bus-guard.mjs --task R2-UI-003-resource-capacity-hardening --once`.

## Follow-Up

- E2E-R2-004 and E2E-R2-005 remain pending for the Release 2 exit/evidence slice.
- Next recommended implementation slice: `R2-004/R2-009` Portfolio and KPI control hardening, or merge/rebase stacked PRs first.
