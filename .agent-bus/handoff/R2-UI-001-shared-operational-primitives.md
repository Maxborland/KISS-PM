# Handoff: R2-UI-001-shared-operational-primitives

Timestamp: 2026-05-17T17:12:00+07:00
Agent: codex
Branch: `codex/r2-shared-operational-primitives`
Status: completed

## Changed

- Added shared Release 2 operational UI primitives in `apps/web/src/operationalSurfacePrimitives.tsx`.
- Added test-first coverage in `apps/web/src/operationalSurfacePrimitives.test.tsx`.
- Integrated `OperationalSurfaceShell`, `KPIStrip`, `SignalSummaryBar`, and `ActionAuditPreview` into `apps/web/src/PortfolioControlSurface.tsx`.
- Added Portfolio regression assertions in `apps/web/src/PortfolioControlSurface.test.tsx`.
- Added operational primitive CSS to `apps/web/src/styles.css`.
- Updated `docs/status/release2-ui-requirements-matrix.json` evidence for `R2-001..R2-004`.

## Verification

- `node scripts/agent-bus-guard.mjs --task R2-UI-001-shared-operational-primitives --once` passed before app/doc edits.
- `npm test -- apps/web/src/operationalSurfacePrimitives.test.tsx apps/web/src/PortfolioControlSurface.test.tsx` passed: 2 files, 19 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('p3-p12 ux matrix json ok')"` passed.

## Known verification gap

- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` failed because the generic matrix verifier does not support the Release 2 backlog matrix shape:
  - `unsupported matrix phase: undefined`
  - rows are expected to be `verified` or `blocked`, while Release 2 rows are intentionally `planned`/`in_progress`.

## Decisions

- Kept this slice limited to shared primitives plus one real Portfolio Control consumer.
- Did not implement Gantt, resource matrix, KPI deviation rewrite, API routes, packages, or E2E tests in this slice.
- Marked `R2-001..R2-004` as `in_progress`, not complete, because cross-surface migration and E2E-R2 acceptance remain later work.

## Next step

Claim the next closed Release 2 slice. Recommended options:

- `R2-005/R2-006`: Project Gantt planning + tracking hardening.
- `R2-007/R2-008`: Resource Load capacity matrix + conflict resolution preview/apply.
