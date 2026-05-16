# Handoff: FIX-P3-P12-BUG-HUNT-001

Status: done
Agent: codex-main
Completed: 2026-05-16T13:22:30+07:00

## Changed

- Restored P3-P12 product UX specification layer in `docs/product/`.
- Added `docs/status/p3-p12-ux-screen-matrix.json` covering 33 screens across P3-P12.
- Added `scripts/verify-ux-screen-matrix.mjs`.
- Added `docs/roadmap/P3_P12_POST_RUN_VERIFICATION_GATE.md`.
- Fixed Phase 5 E2E reproducibility without Bun using `scripts/dev-api-server.mjs`.
- Added local proxy bypass in `scripts/run-e2e.mjs` and `playwright.config.ts`.
- Fixed E2E metadata extraction for current Playwright output.
- Fixed Gantt command pending/success feedback, in-flight project switching, and audit-readback degradation.
- Added Gantt regression tests for audit degradation and pending command/readback state.
- Added resolution evidence to `docs/bug-hunt-report.md`.

## Verification

- `npm run typecheck` -> exit 0.
- `npm run lint` -> exit 0.
- `npm test -- apps/api/src/phase5ScheduleApi.test.ts apps/web/src/GanttControlSurface.test.tsx packages/scheduling-engine/src` -> exit 0, 4 files / 40 tests passed.
- `npm test` -> exit 0, 44 files / 263 tests passed.
- `npm run test:e2e:phase -- --phase 5` -> exit 0, E2E-040..E2E-044 passed.
- `npm run verify:matrix -- docs/status/phase5-requirements-matrix.json` -> exit 0.
- `node scripts/verify-ux-screen-matrix.mjs docs/status/p3-p12-ux-screen-matrix.json` -> exit 0, 33 screens verified.
- `rg -n "TBD|TODO|later|nice to have|generic dashboard|ready-made Gantt|Bryntum|Ant Design" docs/product docs/status/p3-p12-ux-screen-matrix.json docs/roadmap/P3_P12_POST_RUN_VERIFICATION_GATE.md` -> exit 1, no matches.
- `node scripts/agent-bus-guard.mjs --task FIX-P3-P12-BUG-HUNT-001 --once` -> exit 0 before completion handoff.

## Coordination Notes

- Unrelated dirty files under `docs/ms-project-ref/**` were not edited.
- Cleaned stale `P5-008` claim status to `done` because the queue already marked it done and stale state blocked guard.
