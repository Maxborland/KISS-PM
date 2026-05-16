# P6-011 Phase 6 Review Fixes

Status: accepted
Task: P6-011-phase6-review-fixes
Date: 2026-05-16T18:20:00+07:00

## Scope

Fixed the P6 Bug Hunt / Receiving Code Review findings after the Phase 6 exit gate:

- `reserve_capacity` could be previewed/applied as a resource overload resolution even though it added demand and left the overload open.
- Resource Load exposed `Открыть Гантт проекта` for `project-alpha-a`, which was not available in the schedule runtime and produced a 404.
- Web reservation DTO allowed `manual` while API/domain accepted `stage`, creating a frontend/backend contract mismatch.

## Changed

- `apps/api/src/phase6Runtime.ts`
  - Removed the special `reserve_capacity` bypass from overload resolution preview.
  - Added backend precondition rejection for `reserve_capacity` as an overload resolution command.
- `apps/api/src/phase6ResourcePlanningApi.test.ts`
  - Added regression coverage for `reserve_capacity` returning 409 with no mutation/audit.
  - Added reservation source type contract coverage: `manual` returns 400 and `stage` returns 201.
- `apps/web/src/resourcePlanningApiClient.ts`
  - Aligned `ResourceReservationDto.sourceType` with API/domain: `opportunity | project | stage`.
  - Aligned reservation status with API/domain: `active | released`.
- `apps/web/src/ResourceLoadControlSurface.tsx`
  - Gantt opener is rendered only for explicitly available schedule project ids.
- `apps/web/src/ResourceLoadControlSurface.test.tsx`
  - Added available-only Gantt opener coverage.
- `e2e/tests/phase6/overload-resolution-entry.spec.ts`
  - Added browser proof that the unavailable Gantt action is not exposed in the P6 fixture.
- `docs/status/phase6-requirements-matrix.json`
  - Refreshed P6-006/P6-007/P6-008/P6-010 evidence truthfully after review fixes.
- `docs/phases/PHASE_6_RESOURCE_PLANNING_CONFLICT_RESOLUTION.md`
  - Clarified that capacity reservation remains a Resource Load action and must not be reported as overload resolution when it adds demand.
- `docs/product/SCREEN_INTERACTION_CATALOG.md`, `docs/product/ROLE_BASED_JOURNEYS.md`
  - Aligned P6 product wording with the corrected reservation and available-project Gantt behavior.
- `.agent-bus/state/CURRENT.md`, `.agent-bus/queue.json`
  - Recorded P6-011 accepted state and next step.

## Verification

- `npm test -- apps/api/src/phase6ResourcePlanningApi.test.ts` exit 0: 6 tests passed.
- `npm test -- apps/web/src/ResourceLoadControlSurface.test.tsx` exit 0: 8 tests passed.
- `npm run test:integration` exit 0: 8 files, 39 tests passed.
- `cmd /c "set PW_API_PORT=4299&& set PW_WEB_PORT=5299&& npm run test:e2e:phase -- --phase 6"` exit 0: E2E-050..055 passed.
- PowerShell bug-hunt API reproduction exit 0: `reserve_capacity` preview returns 409 with load still 50 ч/critical, `manual` reservation sourceType returns 400, `stage` sourceType returns 201.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 49 files, 295 tests passed.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase6-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P6-011-phase6-review-fixes --once` exit 0.

## Review Findings

- HIGH false `reserve_capacity` resolution -> fixed by backend precondition rejection and API regression proof.
- MEDIUM unavailable Gantt action -> fixed by available-project gating and component/E2E proof.
- MEDIUM reservation sourceType mismatch -> fixed by web DTO alignment and API contract proof.

## Next

Proceed to `P7-000-kpi-engine-control-signals-phase-contract`. Do not call Release 2 ready; P7-P12 remain unimplemented/spec-only.
