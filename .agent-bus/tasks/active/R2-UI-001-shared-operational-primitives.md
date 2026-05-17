# Task: R2-UI-001-shared-operational-primitives - Release 2 shared operational UI primitives

Status: done
Priority: critical
Owner / claimed by: Codex
Branch: `codex/r2-shared-operational-primitives`

## Goal

Implement the first Release 2 production UI slice for `R2-001/R2-002/R2-003`: shared operational surface shell, operational data grid/configurable layout foundation, KPI strip, signal summary, permission/result primitives, and one narrow real consumer integration.

## Scope

- Add `apps/web/src/operationalSurfacePrimitives.tsx`.
- Add `apps/web/src/operationalSurfacePrimitives.test.tsx` test-first coverage.
- Integrate primitives narrowly into `PortfolioControlSurface` to prove runtime use.
- Add CSS in `apps/web/src/styles.css`.
- Update `docs/status/release2-ui-requirements-matrix.json` evidence for R2-001/R2-002/R2-003 only.
- Update agent-bus state/handoff.

## Out Of Scope

- Gantt implementation (`R2-005/R2-006`).
- Resource matrix/conflict flow implementation (`R2-007/R2-008`).
- KPI Deviation full screen rewrite (`R2-009`).
- API/domain/package changes.
- E2E test implementation beyond preserving existing tests; E2E-R2 remains planned until later rows.

## Acceptance Criteria

- [x] Failing tests are written before implementation.
- [x] `OperationalSurfaceShell` renders object/scope/freshness/primary action/status/result/readback regions and readonly/permission/error states.
- [x] `OperationalDataGrid` supports grouped columns, visibility state, reset layout, row actions with disabled reasons, and keyboard row activation.
- [x] `KPIStrip` and `SignalSummaryBar` support severity, deltas, help/source text, requires-action summary, and disabled next-action reason.
- [x] `PermissionDeniedInline` and `ActionAuditPreview` provide reusable evidence/denial UI.
- [x] Portfolio Control uses the primitives without changing domain/API behavior.
- [x] Targeted tests, typecheck, JSON parse, diff check, and final agent-bus guard are documented.

## Verification

- `npm test -- apps/web/src/operationalSurfacePrimitives.test.tsx apps/web/src/PortfolioControlSurface.test.tsx`
- `npm run typecheck`
- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node scripts/agent-bus-guard.mjs --task R2-UI-001-shared-operational-primitives --once`

## Risks

- Existing screens are large and uneven; keep integration narrow to avoid rewriting Release 2 out of sequence.
- Generic matrix verifier still does not support the planned R2 matrix shape; use JSON parse and update evidence fields.

## Completion evidence

- `npm test -- apps/web/src/operationalSurfacePrimitives.test.tsx apps/web/src/PortfolioControlSurface.test.tsx` passed: 2 files, 19 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('p3-p12 ux matrix json ok')"` passed.
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` failed because the generic verifier does not support this Release 2 backlog matrix shape (`unsupported matrix phase: undefined`; statuses must be `verified` or `blocked`).
