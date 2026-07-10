# BUG-PROJ-20: independent QA of calendar live-resource fix

Date: 2026-07-10
Scope: read-only review of the five explicitly owned files. No product/test edits, no commit, no browser run, no full web typecheck.
Verdict: **PASS WITH RISKS**. No blocking defect found in the scoped live-resource fix.

## Reviewed files

- `apps/web/src/delivery/calendars/calendars-surface.tsx`
- `apps/web/src/delivery/resources/resources-editors.tsx`
- `apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx`
- `apps/web/src/delivery/resources/resources-editors-absence.test.tsx`
- `e2e/full-eval/projects-calendars-write.spec.ts`

Unrelated concurrent schedule/domain/persistence changes were not read or assessed.

## Findings

No blocking correctness finding in the owned diff.

`ProjectCalendars` passes `resDir.list`, the selected live resource ID, and project-bounded focused-month dates into `AbsenceDialog`. The dialog re-derives those current props on every open. The E2E verifies the selected live resource ID reaches the applied and persisted calendar exception.

The latest empty/non-working-range update is correct in the reviewed slice: when filtering produces zero commands, `doAbsence` emits the exact error `В выбранном диапазоне нет рабочих дней` and returns before `applyBatch`. The focused test asserts both effects.

The latest `Dialog.Description` change preserves the explanatory text and provides the Radix dialog description. The previous `Missing Description or aria-describedby` warning is absent in the latest focused rerun.

## Exact commands and results

1. `codegraph sync`
   - PASS, exit 0 before review; index reported already up to date.
   - PASS, exit 0 after the latest worktree update.

2. `pnpm vitest run apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx`
   - FAIL before Vitest: the environment's `pnpm` wrapper attempted an install and stopped with `ERR_PNPM_IGNORED_BUILDS`. This is a runner/bootstrap failure, not an assertion failure.

3. `.\\node_modules\\.bin\\vitest.cmd run apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx`
   - First sandbox attempt: FAIL before collection with esbuild `spawn EPERM`.
   - Approved out-of-sandbox rerun on the earlier worktree: PASS, exit 0; 1 file, 1 test.

4. `.\\node_modules\\.bin\\vitest.cmd run apps/web/src/delivery/resources/resources-editors-absence.test.tsx`
   - Earlier worktree: PASS, exit 0; 1 file, 1 test.
   - Earlier stderr contained two Radix description warnings, subsequently fixed.

5. `.\\node_modules\\.bin\\vitest.cmd run apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx apps/web/src/delivery/resources/resources-editors-absence.test.tsx`
   - Earlier aggregate rerun: PASS, exit 0; 2 files, 2 tests.

6. `git diff --check -- apps/web/src/delivery/calendars/calendars-surface.tsx apps/web/src/delivery/resources/resources-editors.tsx apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx apps/web/src/delivery/resources/resources-editors-absence.test.tsx e2e/full-eval/projects-calendars-write.spec.ts`
   - PASS, exit 0 before and after the latest update; no whitespace errors.
   - Git warns that CRLF will be replaced by LF when it next touches the three tracked modified files.

### Latest-worktree focused rerun

The two owned Vitest files now contain three unique tests. Each was rerun by exact name:

7. `.\\node_modules\\.bin\\vitest.cmd run apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx -t "passes the live directory, selected resource and focused project dates"`
   - PASS, exit 0; selected test passed, 1 skipped by the name filter.

8. `.\\node_modules\\.bin\\vitest.cmd run apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx -t "explains a fully non-working range without opening preview or applying a batch"`
   - PASS, exit 0; selected test passed, 1 skipped by the name filter.
   - Confirms exact error toast and zero `applyBatch` calls.

9. `.\\node_modules\\.bin\\vitest.cmd run apps/web/src/delivery/resources/resources-editors-absence.test.tsx -t "uses the supplied live resources, selected resource and date range on every open"`
   - PASS, exit 0; 1 test passed.
   - No Radix description warning on the latest worktree.

## Coverage

### Focused Vitest

- Live resource directory, selected resource ID, and focused project dates are passed to the dialog.
- July-to-August navigation recomputes defaults from `2026-07-10..2026-07-14` to `2026-08-01..2026-08-03`.
- The dialog renders supplied resources and refreshes selected resource/date values after close, prop update, and reopen.
- A Saturday-to-Sunday range reports `В выбранном диапазоне нет рабочих дней` and does not call `applyBatch`.
- `Dialog.Description` removes the prior Radix accessibility warning.

### E2E static inspection

- **Create/preview:** waits for `preview-command-batch`, requires HTTP 200, and requires exactly one command.
- **Apply:** waits for `apply-command-batch`, requires HTTP 200, and requires the apply envelope to equal the preview envelope.
- **Payload:** requires selected `resourceId`, one-day date, `workingMinutes: 0`, and `reason: "Отпуск"`.
- **Readback:** requires the persisted active exception to equal the request payload and checks plan-version advancement.
- **Reload:** reloads, reselects the resource, checks the absence row, and repeats API active-exception readback.
- **Remove:** checks matching preview/apply envelopes and restoration of the original exception ID/calendar/resource/date with full-day minutes.
- **Removal readback:** requires no active exception and plan-version advancement.
- **Removal reload:** requires the exception date to be absent from the UI.
- **Cleanup:** `finally` reads current state, retries once on 409, and restores full-day minutes with an empty reason if the exception remains active.

## False-pass and residual risks

1. The E2E overwrites both date inputs. It validates live resource selection and persistence but would pass if derived initial dates regressed; focused Vitest owns that coverage.

2. The E2E covers a one-day absence only. It does not prove multi-day batching, weekend/holiday filtering in mixed ranges, or overlap with an existing exception.

3. Cleanup treats HTTP 200 as success without final readback. A backend that accepted but did not persist cleanup could leak test data while cleanup reports success. The main remove path has stronger readback.

4. The final post-removal reload check is UI-only. API readback proves removal before reload, not again after reload.

5. The dialog test verifies DOM defaults but not `onSubmit` callback arguments. The E2E request envelope covers the integrated resource-ID path.

6. The dialog resets resource and dates on reopen but keeps the previously selected absence type. This may be intentional; the reopen test does not prove a full form reset.

7. The new empty-range test directly invokes captured `onSubmit`, so it proves the surface handler contract but not the physical dialog click/preview absence in a real browser.

8. No browser execution or full web typecheck was run, exactly as requested, because unrelated schedule code currently breaks compilation.

## CodeGraph change index

Initial synchronized snapshot: 2,214 files, 24,741 nodes, 52,845 edges.

Reviewed uncommitted fix:

- `calendars-surface.tsx`: added `absenceRangeForMonth`; changed `ProjectCalendars` live-resource/default-date wiring; added zero-command toast and return before `applyBatch`.
- `resources-editors.tsx`: added `AbsenceDialogProps`; changed `AbsenceDialog` initialization/reopen refresh; changed explanatory `p` to `Dialog.Description`.
- `calendars-absence-dialog.test.tsx`: added prop-wiring/default-date coverage and empty-range/no-`applyBatch` coverage.
- `resources-editors-absence.test.tsx`: added dialog live-resource/reopen/defaults coverage.
- `projects-calendars-write.spec.ts`: added absence create/apply/readback/reload/remove/cleanup E2E and helpers.
- Removed symbols: none observed in the scoped diff.

Reviewer-authored source changes: none. The only reviewer artifact is this Markdown report; indexed product/test symbol delta from this review is 0 nodes and 0 edges.

The final synchronized global snapshot was 2,216 files, 24,658 nodes, and 52,763 edges (`2214/24741/52845 -> 2216/24658/52763`). Other agents were concurrently editing unrelated code, so that global delta is not attributable to BUG-PROJ-20 or this reviewer.

SUPERLOOPY_EVIDENCE: projects-2026-07-10/qa-calendar-live-resource-independent.md
