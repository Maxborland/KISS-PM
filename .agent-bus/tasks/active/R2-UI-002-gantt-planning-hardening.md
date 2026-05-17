# Task: R2-UI-002-gantt-planning-hardening - Release 2 Project Gantt planning and tracking UI hardening

Status: done
Priority: critical
Owner / claimed by: Codex
Branch: `codex/r2-gantt-planning-hardening`

## Goal

Implement the Release 2 production UI slice for `R2-005/R2-006`: Project Gantt desktop planning surface hardening and baseline/tracking overlay over the existing Phase 5 schedule API.

## Scope

- Harden `apps/web/src/GanttControlSurface.tsx`.
- Update `apps/web/src/GanttControlSurface.test.tsx` test-first coverage.
- Reuse shared primitives from `apps/web/src/operationalSurfacePrimitives.tsx` where useful.
- Add/adjust CSS in `apps/web/src/styles.css`.
- Update `docs/status/release2-ui-requirements-matrix.json` evidence for `R2-005/R2-006`.
- Update agent-bus state/handoff.

## Out Of Scope

- API/domain/package changes unless a narrow existing DTO type issue blocks UI truth.
- E2E implementation for `E2E-R2-002`/`E2E-R2-003`; those remain Release 2 exit/follow-up work unless explicitly claimed.
- Full MS Project clone, realtime collaboration, packaged Gantt widget, resource leveling automation.
- Resource Load/conflict implementation (`R2-007/R2-008`).

## Acceptance Criteria

- [x] Failing tests are written before implementation.
- [x] Selected WBS row and timeline bar share one selection state.
- [x] Inline date/work/progress edit exposes active cell, Enter/Escape behavior, validation, dirty marker, pending save, API readback, audit/result display, and reload persistence evidence in component tests.
- [x] Tracking/baseline view shows baseline/live distinction, variance, today marker, and warning context where available, without mutating baseline on live edits.
- [x] Read-only users see plan and disabled reasons instead of broken controls.
- [x] No duplicated Gantt task entity and no packaged Gantt widget architecture.
- [x] Targeted tests, typecheck, lint, JSON parse, diff check, and final agent-bus guard are documented.

## Verification

- `npm test -- apps/web/src/GanttControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node scripts/agent-bus-guard.mjs --task R2-UI-002-gantt-planning-hardening --once`

## Risks

- Existing Gantt surface already has API write flows; do not regress readback/audit behavior while improving interaction.
- This is stacked on PR #3 for shared primitives; merge order must keep `codex/r2-shared-operational-primitives` first or rebase after it lands.

## Completion evidence

- `npm test -- apps/web/src/GanttControlSurface.test.tsx apps/web/src/operationalSurfacePrimitives.test.tsx` passed: 2 files, 19 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` failed because the generic verifier does not support this Release 2 backlog matrix shape (`unsupported matrix phase: undefined`; statuses must be `verified` or `blocked`).
