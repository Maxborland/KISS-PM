# Independent coverage review: Schedule closeout C06-C11

Date: 2026-07-10
Scope: read-only review of `e2e/full-eval/projects-schedule-closeout.spec.ts` and the related Schedule UI, planning client, API routes, persistence, idempotency, errors, saved views, and role contracts. Product and test files were not edited. No E2E or DB-backed test was run.

## Verdict

**FAIL / coverage is not sufficient for a C06-C11 Full Evaluation closeout.** The six Playwright tests are discoverable, but a green bundle can overstate its evidence because `updateBundle()` copies every predeclared string from `BUNDLE_ASSERTIONS[bundle]` into every scenario row without tying each claim to an executed assertion (`projects-schedule-closeout.spec.ts:1034-1041`). C06, C07, C08, C09, C10, and C11 all claim states that their test bodies never enter.

The current machine receipt is honest about execution status: all 13 C06-C11 role rows are still `pending` (`schedule-closeout-machine.json`, generated 2026-07-10 13:34:28, run `schedule-closeout-20260710`). This review does not upgrade any row.

## Findings

### High: the receipt can certify unexecuted assertions

- `BUNDLE_ASSERTIONS` promises detailed per-scenario behavior at lines 134-159, while `updateBundle()` assigns the complete bundle list to every row after only the bundle callback succeeds. There is no assertion ID, observation, response, screenshot, or state hash per claim.
- C06 therefore marks PROJ-047, PROJ-057, and PROJ-058 alike even though its body exercises one summary delete and one negative-duration reject. The same inflation applies to C07-C11.
- Fresh targeted execution is not independently greenable: `afterAll` always requires all 40 rows and 11 bundles (`983-992`). `--grep 'C06 '` reaches C06 but then fails because the other 37 rows remain pending. Targeted commands below are diagnostic until the final gate becomes selected-bundle aware or is split into a separate full-run project.

### High: C06 does not cover its three assigned scenarios

- PROJ-047: the test creates a parent/child/grandchild and deletes the parent (`589-625`), but creates no assignments or dependencies for those IDs. The orphan assertions are vacuous. It does not delete a standalone leaf, prove leaves-first command order, or delete the last task in the seeded plan, so the honest empty-plan state is never reached.
- PROJ-057: only one negative duration is submitted. The test checks HTTP reject and read-model equality, but not the visible validation block, row highlighting, multiple issues, an issue without `entityId`, or clearing after a later success.
- The current UI itself drops entity-less validation issues and collapses multiple issues for the same entity because it builds `Map<entityId, message>` only when `entityId` exists (`schedule-surface.tsx:784-786`) and renders only that map (`1451-1462`). C06 cannot detect this contract failure as written.
- PROJ-058: there is no controlled delayed response, no assertion between gesture and response, no authoritative replacement comparison, no exact commit notice/flash assertion, and no double input against the Schedule planning write lock. C10's saved-view double click tests a different mutation gateway.

### High: C08/C09 preserve a mock baseline identity and weak cross-surface oracles

- C08 explicitly expects `Baseline B2` (`746`) while claiming a real baseline legend. Product code still hard-codes that label in both Gantt tooltip and legend (`schedule-surface.tsx:1655,1762`). This is a regression oracle for the mock, not evidence of live identity.
- C08 checks that a `title="Сегодня"` element exists and old strings are absent, but not the marker coordinate, timeline origin, first/last week labels, a project starting in 2027, or a pre-origin task. A marker outside the visible timeline can satisfy the locator assertion.
- C08 does not inspect an admin assignment request for a live user ID. The bundle receipt borrows that claim from other bundles. Reader coverage hides only `Задача` and quick-create; it does not enumerate all Schedule mutation entry points or perform a direct unchanged-state denial in C08.
- C09 proves API `finishDeltaDays === 1`, one baseline table row, and one header string, but the Gantt oracle is only existence of a `Baseline B2` element (`779-785`). It never compares current-bar and baseline-bar geometry.
- Recapture checks only `finishDeltaDays` and `workDeltaMinutes`; `startDeltaDays` can remain non-zero and still pass (`789-793`). The active baseline label/ID is not asserted after either capture. Captured baselines are not removed in cleanup, leaving cross-bundle state in the disposable database.

### Medium: C07 covers a useful slice, not the declared workflow

- The connected workflow performs six UI writes plus one revert (`639-668`), not the declared 10+ create -> schedule/work -> dependency -> milestone -> delete sequence. There is no dependency, milestone, delete, or audit-envelope assertion.
- Same-key `assertConcurrentReplay()` calls happen only after the original apply has committed (`1265-1315`); they prove replay, not concurrent initial claim. Backend DB tests cover initial single/batch races, and the focused revert unit test covers concurrent initial revert.
- The two-window UI section proves one stale single-command preview returns 409, one request is sent, the visible conflict notice appears, and authoritative state reloads (`699-718`). It does not exercise batch 409, a dirty staged batch, an open inline draft, retry behavior, or the documented loss/preservation outcome.
- Lower-layer support is strong: `planningRevertRoute.test.ts` covers double click, divergent key, concurrent duplicate, lost response, rollback, stale version, reader denial, and already-reverted target. That does not substitute for the missing browser states.

### Medium: C10 covers immediate CRUD but not the complete saved-view contract

- Covered: shared create, UI double-click suppression, immediate same-key replay, divergent payload 409, rename, reload/select of zoom, reader GET/select, hidden mutation controls, direct reader POST/PATCH 403, delete, and list readback (`801-938`).
- Missing: duplicate-name policy, exact empty state, user-scoped ownership/visibility, column-width and collapsed-group restoration, corrupt payload handling, direct reader DELETE 403 plus unchanged state, initial concurrent create/rename claim, lost-response retry, and delete retry/reconciliation.
- API accepts any object payload and has no server-side saved-view schema/version validation (`planningSavedViewRoutes.ts:30-34`). `parseNameRequest()` has no name length bound (`111-115`), while UI alone limits names to 80 characters.
- Replays return the resource's current row (`45-47`, `75-79`), not an immutable original response. An old create key replayed after rename, or an old rename key replayed after a later rename, can return different content from the original success. C10's immediate replay cannot detect this delayed-replay drift.
- The DB saved-view test is sequential (`planningRoutes.db.test.ts:2624-2763`); there is no saved-view initial-race test comparable to planning apply race tests.

### Medium: C11 omits declared accessibility states

- Actually scanned: default Schedule, selected/inspector state, admin create dialog, and mobile viewport for admin and planReader (`942-979`).
- Not scanned: planning preview dialog, validation/error block, forbidden surface, saved-view error/retry state, and a reader-specific forbidden page. The reader direct 403 leaves the Schedule unchanged and then scans that normal page.
- Keyboard coverage presses `ArrowDown` but never asserts focus movement, selection, absence of write requests, or preserved read model. Only critical Axe violations are asserted; `incomplete`/unscanned results are not examined despite the receipt claim `no skipped scan`.
- Only the final mobile state is screenshotted per role; default/dialog/preview/error evidence cannot be visually attributed later.

## C06-C11 route/action/state/oracle matrix

| Bundle | Route / role | Action and intended state | Evidence oracle actually present | Coverage gap | Targeted command |
|---|---|---|---|---|---|
| C06 | `/projects/:id/schedule`, admin; preview/apply single+batch | invalid duration, subtree delete, rollback, optimistic/busy states | reject status + whole read-model equality; deleted IDs absent after batch/reload | orphan checks vacuous; no leaf/last-task/order; no visible errors, optimistic interval, exact notice/flash, or double input | `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --project chromium --workers 1 --grep 'C06 '` |
| C07 | `/schedule` + `/commits`, two admins; `/planning/revert-last` | connected commit workflow, revert idempotency, stale single/batch conflict | monotonic versions for six writes; revert envelope/replay/conflict; one stale single preview 409 + reload | not 10+ workflow; no dependency/milestone/delete; no initial apply race; no batch/dirty-draft conflict outcome | `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --project chromium --workers 1 --grep 'C07 '` |
| C08 | `/schedule`, admin + planReader | live project/date/resource identity and role-aware read-only state | real heading, existence of today marker, literal absence checks, two hidden reader controls | no origin/label/coordinate oracle; validates mock `Baseline B2`; no live-user envelope; incomplete reader write-surface proof | `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --project chromium --workers 1 --grep 'C08 '` |
| C09 | `/baseline` + `/schedule`, admin | capture, one-day shift, table/header/Gantt equality, recapture zero | API finish delta +1; table/header text +1; baseline element exists; finish/work zero after recapture | no Gantt geometry equality; no start-delta zero; no live baseline label/ID; baseline state remains after cleanup | `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --project chromium --workers 1 --grep 'C09 '` |
| C10 | `/schedule` + `/planning/saved-views`, admin + planReader | persisted CRUD/select, idempotency, empty/duplicate policy, role denial | shared create/rename/select/delete, immediate replay/conflict, reader POST/PATCH 403 | no duplicate/empty/user-scope/full-payload/corrupt payload; no reader DELETE; no initial race or delayed replay | `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --project chromium --workers 1 --grep 'C10 '` |
| C11 | `/schedule`, admin + planReader | Axe across default/dialog/inspector/preview/error/mobile and read-only keyboard/forbidden | critical-only scans for default, inspector, admin dialog, mobile; reader direct write 403 | preview/error/forbidden not scanned; keyboard result unasserted; Axe incomplete not checked; screenshots lack state attribution | `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --project chromium --workers 1 --grep 'C11 '` |

## Command preconditions

The six targeted Playwright commands above must run only after UI `3180` and API `4192` are bound to a dedicated throwaway seeded database. Set `E2E_WEB_PORT=3180`, `E2E_API_PORT=4192`, `KISS_PM_E2E_DISPOSABLE_DATABASE=1`, and a fresh stable `SCHEDULE_CLOSEOUT_RUN_ID` before each run. The environment flag is only a guard assertion; it does not prove that API `4192` is actually connected to a disposable DB. In the current spec each targeted run is expected to hit its bundle and then fail the global 40-row `afterAll` gate.

## Verification performed

- `codegraph sync`: up to date before review.
- `pnpm exec playwright test ... --list --grep 'C0[6-9]|C1[01]'`: PASS, six tests discovered; no browser test executed.
- `pnpm vitest run apps/api/src/planning/planningRevertRoute.test.ts apps/web/src/delivery/schedule/schedule-batch-integrity.test.tsx apps/web/src/delivery/schedule/schedule-saved-views.test.ts apps/web/src/delivery/lib/planning-error-mapping.test.ts --config vitest.config.ts`: PASS, 4 files / 41 tests. The expected injected rollback error was printed to stderr by the passing revert test.
- DB-backed `planningRoutes.db.test.ts` was inspected statically and not run.

## Change index

- Product/test/config files changed: none.
- Added artifact: `.superloopy/evidence/schedule-closeout-2026-07-10/diagnosis-c06-c11.md`.
- CodeGraph entry: 2,238 files / 25,083 nodes / 53,307 edges.
- CodeGraph final: 2,238 files / 25,083 nodes / 53,307 edges; delta `0 files / 0 nodes / 0 edges` because the Markdown evidence artifact is outside the indexed source graph.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/diagnosis-c06-c11.md
