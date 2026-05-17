# R2-UI-005 Retrospective Control Hardening

Status: done
Phase: R2
Aliases: R2-UI-005, R2-010

## Scope

Implement Release 2 UI hardening for Closed Portfolio and Retrospective Trends surfaces.

Owned files:

- `apps/web/src/ClosedPortfolioRetrospectiveSurface.tsx`
- `apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx`
- `apps/web/src/operationalSurfacePrimitives.tsx`
- `apps/web/src/operationalSurfacePrimitives.test.tsx`
- `apps/web/src/styles.css`
- `docs/status/release2-ui-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/**`
- `.agent-bus/events/events.jsonl`

## Acceptance

- Closed Portfolio shows immutable `ProjectSnapshot` evidence with plan/fact, current vs previous, deltas, quality/CSI where configured, source trace, and snapshot readback.
- Retrospective Trends exposes recurring pattern severity, source snapshots, recommendation, and preview/result/audit/readback contract for template-improvement action.
- Read-only users see disabled reasons and no broken action affordance.
- Component tests cover snapshot/no-previous/action-contract states.
- No API, domain, package, or E2E production changes in this slice.

## Verification

- `npm test -- apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node scripts/agent-bus-guard.mjs --task R2-UI-005-retrospective-control-hardening --once`

## Result

Completed: 2026-05-17T19:10:27+07:00

- Closed Portfolio now exposes a Release 2 `KPIStrip` and `OperationalDataGrid` over immutable `ProjectSnapshot` rows with plan/fact, current-vs-previous variance, quality/CSI, template/KPI versions, and immutable snapshot proof.
- Retrospective Trends now exposes a template-improvement action contract with source trend/snapshot/metric refs, dry-run requirement, no-snapshot-rewrite proof, `mutatesState=false` preview, and `ActionExecution`/`AuditEvent` result readback.
- Release 2 matrix row `R2-010` updated with component-level evidence; `E2E-R2-007` remains pending.
- No API, domain, package, or E2E production changes were made.
