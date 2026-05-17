# R2-UI-004 Portfolio KPI Control Hardening

Status: done
Phase: R2
Aliases: R2-UI-004, R2-004, R2-009

## Scope

Implement Release 2 UI hardening for Portfolio Control and KPI Deviation surfaces.

Owned files:

- `apps/web/src/PortfolioControlSurface.tsx`
- `apps/web/src/PortfolioControlSurface.test.tsx`
- `apps/web/src/KpiDeviationControlSurface.tsx`
- `apps/web/src/KpiDeviationControlSurface.test.tsx`
- `apps/web/src/styles.css`
- `docs/status/release2-ui-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/**`
- `.agent-bus/events/events.jsonl`

## Acceptance

- Portfolio Control exposes highest-risk row/object, clear next governed action, permission state, preview/result, audit/readback, and links to related control surfaces.
- KPI Deviation exposes formula/threshold/source trace, severity, previous comparison, owner/recommendation, corrective action or accepted-risk path, permission state, audit/readback, and historical stability note.
- Component tests cover state/action/readback behavior.
- No API, domain, package, or E2E production changes in this slice.

## Verification

- `npm test -- apps/web/src/PortfolioControlSurface.test.tsx apps/web/src/KpiDeviationControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node scripts/agent-bus-guard.mjs --task R2-UI-004-portfolio-kpi-control-hardening --once`

## Result

Completed: 2026-05-17T17:58:55+07:00

- Portfolio Control now exposes an R2 OperationalDataGrid with object, signal, source refs, next governed action, permission/readback contract, and row selection into the existing preview/apply/audit panel.
- KPI Deviation now exposes SignalSummaryBar, KPIStrip, and a governed action handoff contract with source trace, formula/threshold versions, corrective-action path, accepted-risk reason requirement, permission state, and historical stability note.
- Release 2 matrix rows R2-004/R2-009 updated with component-level evidence; E2E-R2-001/E2E-R2-006/E2E-R2-009/E2E-R2-010 remain pending for later R2 E2E closure.
- No API, domain, package, or E2E production changes were made.
