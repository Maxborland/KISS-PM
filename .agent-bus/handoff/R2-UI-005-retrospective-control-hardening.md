# R2-UI-005 Retrospective Control Hardening Handoff

Timestamp: 2026-05-17T19:10:27+07:00
Branch: `codex/r2-retrospective-control-hardening`
Task: `R2-UI-005-retrospective-control-hardening`
Aliases: `R2-UI-005`, `R2-010`

## Status

Completed as a component-level Release 2 UI hardening slice.

## Changed

- `ClosedPortfolioRetrospectiveSurface` now exposes a Release 2 `KPIStrip` and `OperationalDataGrid` for immutable `ProjectSnapshot` rows.
- Snapshot rows show plan/fact, current-vs-previous variance, quality/CSI, template/KPI versions, and immutable snapshot proof.
- Retrospective insights now show a template-improvement action contract with source trend/snapshots/metrics, dry-run requirement, and no-snapshot-rewrite proof.
- Template-improvement preview now makes `mutatesState=false` and source snapshot immutability visible.
- Apply result now includes `ActionAuditPreview` with `ActionExecution`, `AuditEvent`, future-template readback, and snapshot unchanged evidence.
- `docs/status/release2-ui-requirements-matrix.json` now records component-level evidence for `R2-010`.

## Verification

- RED evidence: `npm test -- apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx` failed with 2 expected missing-behavior failures before implementation.
- `npm test -- apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` passed: 2 files, 13 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.
- `node scripts/agent-bus-guard.mjs --task R2-UI-005-retrospective-control-hardening --once` passed after escalation for Node/git spawn access.

## Known Gaps

- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` still fails because the current strict verifier does not support the Release 2 backlog shape and expects only verified/blocked statuses.
- `E2E-R2-007` remains pending. This slice does not claim E2E or full Release 2 closure.

## Next

- Continue with `R2-011` Tenant Admin saved views/layout/config preview hardening.
- Then use `R2-012` for Release 2 E2E, fixtures, sales-demo gate, and final exit evidence.
