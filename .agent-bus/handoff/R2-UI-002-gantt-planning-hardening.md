# Handoff: R2-UI-002-gantt-planning-hardening

Timestamp: 2026-05-17T17:28:00+07:00
Agent: codex
Branch: `codex/r2-gantt-planning-hardening`
Status: completed

## Changed

- Hardened `apps/web/src/GanttControlSurface.tsx` for `R2-005/R2-006`.
- Added shared selection state between WBS grid rows and timeline bars.
- Added selected task and active-cell status readouts.
- Added inline edit behavior:
  - focus sets active cell;
  - dirty marker appears after draft changes;
  - invalid finish/start blocks save;
  - Escape resets the task draft from API readback state;
  - Enter saves dirty valid task edits;
  - pending marker appears during save;
  - API readback refresh clears dirty state.
- Added Tracking Gantt overlay with baseline id, live plan, baseline plan, start/finish variance, and today marker.
- Added CSS for selected rows/bars, active cell, dirty/validation/pending markers, and tracking rows.
- Updated `docs/status/release2-ui-requirements-matrix.json` evidence for `R2-005/R2-006`.

## Verification

- `node scripts/agent-bus-guard.mjs --task R2-UI-002-gantt-planning-hardening --once` passed before app/doc edits.
- RED stage: `npm test -- apps/web/src/GanttControlSurface.test.tsx` failed with 3 expected missing-behavior failures (`gantt-selected-task`, `gantt-active-cell`, `gantt-tracking-overlay` absent).
- `npm test -- apps/web/src/GanttControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` passed: 2 files, 19 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.

## Known verification gap

- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` failed because the generic verifier does not support the Release 2 backlog matrix shape:
  - `unsupported matrix phase: undefined`
  - rows are expected to be `verified` or `blocked`, while Release 2 rows are intentionally `planned`/`in_progress`.

## Decisions

- Kept this slice to web UI/component tests over the existing Phase 5 schedule API.
- Did not add API/domain/package/E2E changes.
- Marked `R2-005/R2-006` as `in_progress`, not complete, because `E2E-R2-002` and `E2E-R2-003` remain later Release 2 evidence work.

## Next step

- Merge PR #3 first or keep this PR stacked on it.
- Recommended next implementation slice: `R2-007/R2-008` Resource Load / Capacity Matrix and conflict resolution preview/apply.
