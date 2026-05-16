# Bug Hunt Gate Report: P3-P12 / Master

Date: 2026-05-16T12:46:15+07:00
Task: `GATE-P3-P12-BUG-HUNT-001`
Scope: master worktree after Agent 2 completion signal. Review-only; product code was not changed.

## Verdict

blocked: current master cannot pass a P3-P12 gate review.

The main blocker is not a subtle runtime defect: the P3-P12 UX contract and post-run gate documents referenced by agent-bus are absent from this master checkout. Phase 5 runtime/unit checks are mostly healthy, but Phase 5 E2E/matrix proof also cannot be reproduced in this environment because the Playwright web server command requires `bun`, and `bun` is not installed here.

## Findings

### [CRITICAL] P3-P12 UX/post-run gate artifacts are missing from master

- **File:** repository state / `.agent-bus/queue.json`
- **Confidence:** HIGH
- **Bug:** Agent-bus claims mark `DOC-P3-P12-UX-CONTRACT-001` and `DOC-P3-P12-POST-RUN-GATE-001` as done, but the required docs are absent in master.
- **Scenario:** A lead runs the requested P3-P12 gate in master and checks `docs/product/P3_P12_PRODUCT_UX_SPEC.md`, `docs/product/SCREEN_INTERACTION_CATALOG.md`, `docs/status/p3-p12-ux-screen-matrix.json`, or `docs/roadmap/P3_P12_POST_RUN_VERIFICATION_GATE.md`.
- **Consequence:** The gate cannot compare implementation against the UX contract. Any accepted verdict would be based on missing source-of-truth docs.
- **Fix:** Integrate or recreate `docs/product/*`, `docs/status/p3-p12-ux-screen-matrix.json`, `docs/roadmap/P3_P12_POST_RUN_VERIFICATION_GATE.md`, and the UX matrix verifier in master, then rerun the gate.
- **Evidence:** `node -e "fs.existsSync(...)"` returned `false` for all required UX/post-run paths; `ls docs/product docs/roadmap` failed with `No such file or directory`.

### [HIGH] Phase 5 strict matrix cannot be revalidated in this master environment

- **File:** `apps/api/package.json`
- **Confidence:** HIGH
- **Bug:** `npm run test:e2e:phase -- --phase 5` fails before running tests because Playwright starts the API with `bun run src/server.ts`, but `bun` is not available in this environment.
- **Scenario:** A reviewer tries to reproduce the Phase 5 exit gate from master using the documented E2E command.
- **Consequence:** `test-results/kiss-pm-e2e-last-run.json` is written with `status: failed`, no E2E ids, and `npm run verify:matrix -- docs/status/phase5-requirements-matrix.json` fails. The gate cannot prove E2E-040..044 from this checkout.
- **Fix:** Ensure the master/CI gate environment installs Bun, or add a supported Node-compatible dev server path and update the Playwright webServer command. Then rerun Phase 5 E2E and strict matrix verification.
- **Evidence:** E2E failed with `sh: 1: bun: not found`; strict matrix reported missing E2E-040..044 and missing phase5 spec paths.

### [MEDIUM] Gantt command status shows success before backend confirmation

- **File:** `apps/web/src/GanttControlSurface.tsx:191`
- **Confidence:** HIGH
- **Bug:** `runScheduleCommand` calls `setStatus(successLabel)` before `await command()` and before API readback.
- **Scenario:** User clicks `Создать задачу в Гантте` on a slow or failing network request.
- **Consequence:** The UI can show `Задача создана через API` while the task is still pending or about to fail. This violates confirmed-state feedback and can mislead the user about persisted state.
- **Fix:** Use a pending label before the command, and set `successLabel` only after the command and `loadSchedule` readback succeed.

### [MEDIUM] Gantt project-open action can race with an in-flight schedule command

- **File:** `apps/web/src/GanttControlSurface.tsx:306`
- **Confidence:** HIGH
- **Bug:** The `Открыть Гантт` button is disabled only by `isLoading`, not by `commandInFlight`, while `runScheduleCommand` reloads the captured `activeProjectId` after the command.
- **Scenario:** User starts a baseline/task/dependency command on Project A, changes the project id, and clicks `Открыть Гантт` for Project B before the command resolves.
- **Consequence:** The in-flight command can finish and reload Project A over the user's Project B selection, showing the wrong planning surface.
- **Fix:** Disable project switching while `commandInFlight`, or bind each command to an explicit project id and ignore stale command readbacks if the selected project changed.

### [MEDIUM] Gantt schedule load fails completely if audit readback fails

- **File:** `apps/web/src/GanttControlSurface.tsx:125`
- **Confidence:** MEDIUM
- **Bug:** `loadSchedule` uses one `Promise.all` for schedule and audit. If audit readback rejects while schedule succeeds, the catch clears the schedule and renders the whole Gantt as error.
- **Scenario:** User has `project.read` and `audit.read`, schedule API returns 200, but `/schedule/audit` returns 500 or a transient network failure.
- **Consequence:** A usable plan is hidden because audit evidence failed. The user cannot inspect or continue planning even though the schedule read model is available.
- **Fix:** Load schedule as the primary request, load audit independently with degraded inline audit error, and keep the Gantt schedule visible.

## Verification

- `node scripts/agent-bus-guard.mjs --task GATE-P3-P12-BUG-HUNT-001 --once` -> exit 0.
- `npm run typecheck` -> exit 0.
- `npm run lint` -> exit 0.
- `npm test -- apps/api/src/phase5ScheduleApi.test.ts apps/web/src/GanttControlSurface.test.tsx packages/scheduling-engine/src` -> exit 0, 4 files / 38 tests passed.
- `npm test` -> exit 0, 44 files / 261 tests passed.
- `npm run test:e2e:phase -- --phase 5` -> exit 1, blocked by missing `bun`.
- `npm run verify:matrix -- docs/status/phase5-requirements-matrix.json` -> exit 1 after failed E2E metadata.
- Final `node scripts/agent-bus-guard.mjs --task GATE-P3-P12-BUG-HUNT-001 --once` -> exit 0.

## Summary

- CRITICAL: 1
- HIGH: 1
- MEDIUM: 3
- LOW: 0

## Fix Status

Task: `FIX-P3-P12-BUG-HUNT-001`
Date: 2026-05-16T13:20:00+07:00

- [CRITICAL] Missing P3-P12 UX/post-run artifacts: fixed by adding `docs/product/*`, `docs/status/p3-p12-ux-screen-matrix.json`, `docs/roadmap/P3_P12_POST_RUN_VERIFICATION_GATE.md`, and `scripts/verify-ux-screen-matrix.mjs`.
- [HIGH] Phase 5 E2E/matrix not reproducible without Bun: fixed by replacing the API dev command with `scripts/dev-api-server.mjs`, an esbuild-based TypeScript server launcher, and by forcing local `NO_PROXY` for Playwright webServer polling.
- [MEDIUM] Gantt command success shown before backend confirmation: fixed by showing pending status first and success only after command and API readback.
- [MEDIUM] Project switching during in-flight Gantt command: fixed by disabling project id input and open action while command is in flight.
- [MEDIUM] Audit readback failure hides usable Gantt: fixed by loading schedule as primary data and degrading audit independently.

Fix verification:

- `npm run typecheck` -> exit 0.
- `npm run lint` -> exit 0.
- `npm test -- apps/api/src/phase5ScheduleApi.test.ts apps/web/src/GanttControlSurface.test.tsx packages/scheduling-engine/src` -> exit 0, 4 files / 40 tests passed.
- `npm test` -> exit 0, 44 files / 263 tests passed.
- `npm run test:e2e:phase -- --phase 5` -> exit 0, E2E-040 through E2E-044 passed.
- `npm run verify:matrix -- docs/status/phase5-requirements-matrix.json` -> exit 0.
- `node scripts/verify-ux-screen-matrix.mjs docs/status/p3-p12-ux-screen-matrix.json` -> exit 0, 33 screens verified.
- Content audit for placeholder/forbidden phrases -> exit 1 with no matches.
