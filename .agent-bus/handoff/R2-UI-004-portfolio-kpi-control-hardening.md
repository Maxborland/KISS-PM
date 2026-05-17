# R2-UI-004 Portfolio KPI Control Hardening Handoff

Timestamp: 2026-05-17T17:58:55+07:00
Branch: `codex/r2-portfolio-kpi-control-hardening`
Task: `R2-UI-004-portfolio-kpi-control-hardening`
Aliases: `R2-UI-004`, `R2-004`, `R2-009`

## Status

Completed as a component-level Release 2 UI hardening slice.

## Changed

- `PortfolioControlSurface` now includes a Release 2 `OperationalDataGrid` for portfolio signals with risk, object, signal text, project/source refs, next governed action, and readback contract.
- `PortfolioControlSurface` now includes a selected-row next-action contract showing target object, action label, required permission, source refs, and preview/result/readback requirement before the existing preview/apply/audit flow.
- `KpiDeviationControlSurface` now includes `SignalSummaryBar`, `KPIStrip`, and a governed action handoff contract with entity, KPI definition version, formula version, threshold version, source trace, corrective-action path, accepted-risk reason requirement, permission state, and historical stability evidence.
- Component tests were added for the R2 Portfolio grid/next-action contract and KPI summary/action contract.
- `docs/status/release2-ui-requirements-matrix.json` now records component-level evidence for `R2-004/R2-009`.

## Verification

- RED evidence: `npm test -- apps/web/src/PortfolioControlSurface.test.tsx apps/web/src/KpiDeviationControlSurface.test.tsx` failed with expected missing-behavior failures before implementation.
- `npm test -- apps/web/src/PortfolioControlSurface.test.tsx apps/web/src/KpiDeviationControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` passed: 3 files, 29 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.
- `node scripts/agent-bus-guard.mjs --task R2-UI-004-portfolio-kpi-control-hardening --once` passed after escalation for Node/git spawn access.

## Known Gaps

- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` still fails because the current strict verifier does not support the Release 2 backlog shape and expects only verified/blocked statuses.
- E2E-R2-001, E2E-R2-006, E2E-R2-009, and E2E-R2-010 remain pending. This slice does not claim E2E or full Release 2 closure.

## Next

- Continue with `R2-010` Closed Portfolio / Retrospective hardening or `R2-011` Tenant Admin saved views/config preview hardening.
- Consider merging/rebasing the stacked PR chain before more UI slices if review becomes hard to follow.
