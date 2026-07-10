# Schedule strict code review

## Findings by severity

### High

#### H1. Cancelling the staged-batch preview silently loses the batch and leaves untracked optimistic UI

- **Confidence:** Confirmed.
- **Symbols / evidence:** `ProjectSchedule.applyStaged` in `apps/web/src/delivery/schedule/schedule-surface.tsx:380-406`; `ProjectSchedule.applyCmd` in `apps/web/src/delivery/schedule/schedule-surface.tsx:514-526`; `usePlanning.applyBatch` in `apps/web/src/delivery/lib/use-planning.ts:125-159`.
- **Reproducible behavior / concrete path:** enable `Пакет`, edit a field routed through `applyCmd`, click `Применить пакетом`, then cancel the shared preview dialog. `usePlanning.applyBatch` returns `{ ok: false, message: "preview_cancelled" }`. Before checking that result, `applyStaged` always consumes the navigation sentinel, clears `staged`, and nulls `batchBaseRef`. It does not restore `base` or reload for `preview_cancelled`. The optimistic row patch therefore remains visible although no command was applied, while the pending banner and unload/navigation guard disappear. The next reload/navigation discards what looked saved.
- **Blast radius:** every staged single-command Schedule edit (name, progress, start, assignment, dependency, WBS move, inline create). This violates PROJ-036 and can make the UI claim a state that neither the API nor commit history contains.
- **Smallest fix:** handle `preview_cancelled` before clearing anything. Preserve `staged`, `batchBaseRef`, optimistic `readModel`, and the navigation sentinel so the user can retry or explicitly discard. Clear the batch only after success or an explicit discard; on conflict/validation reload authoritative state and then clear with an explicit loss message.
- **Test target:** a jsdom interaction test around `ProjectSchedule`: stage one rename, mock `applyBatch` to return `preview_cancelled`, assert the staged counter/banner and optimistic title remain, `reload` is not called, and navigation remains guarded. Add the complementary success and explicit-discard assertions.

#### H2. The visible `Пакет` mode is bypassed by many write paths

- **Confidence:** Confirmed.
- **Symbols / evidence:** `ProjectSchedule.applyCmd` stages only at `schedule-surface.tsx:514-522`; `ProjectSchedule.runBatch` always applies immediately at `schedule-surface.tsx:718-732`; callers bypassing staging include `workEdit` (`637-642`), `editFinish` (`653-665`), `makeMilestone` (`673-677`), summary delete (`681-694`), `submitTaskModal` (`741-761`), TSV apply (`974-995`), and finish-date fill (`997-1006`). The toolbar describes the control as a mode that accumulates edits at `schedule-surface.tsx:1103`.
- **Reproducible behavior / concrete path:** turn on `Пакет`, then edit duration/work, change finish date, save TaskModal, make a milestone, paste TSV, or run date fill. These paths call `runBatch`, which immediately invokes preview/apply and increments the server plan version; the staged counter remains unchanged. In the same mode, a name or progress edit is only staged. The same visible mode therefore has contradictory persistence semantics depending on the edited field.
- **Blast radius:** core edit workflow PROJ-036/PROJ-117; users cannot reason about whether a change is pending or committed, and navigation guards cover only the subset routed through `applyCmd`.
- **Smallest fix:** create one mutation gateway that accepts `PlanningCommand[]`; when `batchMode` is active it appends all commands and applies the same optimistic/read-model policy, otherwise it calls `apply`/`applyBatch`. Route every Schedule mutation through it. If TSV/fill must intentionally remain immediate atomic operations, explicitly disable them while a staged batch exists and label that exception in the UI contract.
- **Test target:** table-driven component test for each mutation entry point with batch mode on: assert zero preview/apply network calls, correct staged command count, one final `applyBatch`, and a single plan-version increment.

#### H3. Batch mode can be switched off while dirty, allowing interleaved commits and a stale compensating undo

- **Confidence:** Confirmed.
- **Symbols / evidence:** unguarded mode toggle at `schedule-surface.tsx:1103`; `batchBaseRef` is captured only when the first command is staged at `schedule-surface.tsx:517-520`; later reused as undo `before` at `schedule-surface.tsx:385-393`; non-batch edits overwrite `lastCommitRef` at `schedule-surface.tsx:530-532`; undo builds compensation from the recorded `before` at `schedule-surface.tsx:486-503`.
- **Reproducible behavior / concrete path:** stage `title A -> B`, turn `Пакет` off without applying/discarding, commit `title -> C` normally, then apply the still-visible staged batch (`title -> B`) and undo it. The staged batch's `before` is still the original A snapshot, not the state immediately before its apply (C), so the compensating command restores A and silently overwrites the valid intervening C commit.
- **Blast radius:** any entity/field touched both by a dirty batch and an intervening immediate commit; audit history remains monotonic but undo restores the wrong business state.
- **Smallest fix:** do not allow leaving batch mode while `staged.length > 0`; require Apply or Discard. As defense in depth, capture the authoritative current read model immediately before applying the staged batch and use that snapshot for compensation, rather than `batchBaseRef` from first staging.
- **Test target:** component/integration regression for stage -> toggle off attempt -> same-field edit -> apply -> undo. Assert the toggle is blocked or confirmed, and undo restores C, never A.

#### H4. Schedule converts working time with fixed 8-hour/calendar-day math while the engine uses task calendars and exceptions

- **Confidence:** Confirmed.
- **Symbols / evidence:** global `HPD = 8` at `schedule-surface.tsx:32`; work/duration writes use `MIN_PER_DAY = 480` at `schedule-surface.tsx:632-665`; bar resize derives work duration from calendar span at `schedule-surface.tsx:274-308`; `mapRows` divides duration, lag, and slack by 480 at `apps/web/src/delivery/schedule/schedule-rows.ts:80,122,130`; TSV/fill uses calendar `addIsoDays`/`daysBetween` at `apps/web/src/delivery/schedule/schedule-productivity.ts:90-98,165-205,264-272`. In contrast, `calculatePlan` resolves a task calendar and exceptions at `packages/domain/src/planning/schedulingEngine.ts:84-103`, and `addWorkingMinutesToInstant`/`diffWorkingMinutes` explicitly skip non-working time at `packages/domain/src/planning/workingTime.ts:10-54`.
- **Reproducible behavior / concrete path:** on a 6-hour calendar, a one-day task stores 360 duration minutes; editing it as `1 дн` sends 480 minutes and changes the task to 1.33 working days. For a Friday-start task crossing a weekend/holiday, `dayDur` is a calendar span; resize and finish-fill turn that span into `span * 480` working minutes, inflating duration/work. The fill preview can show Saturday/Sunday while the Gantt renders `calculatedFinish` from the working-time engine. Existing E2E asserts authored `plannedFinish` (`e2e/full-eval/projects-schedule-productivity.spec.ts:233-235`), while `mapRows` displays calculated dates (`schedule-rows.ts:93-98,124-125`), so the test can pass while the visible result disagrees.
- **Blast radius:** all custom calendars, weekends, holidays, per-task calendars, lag/slack display, drag/resize, TaskModal, TSV import, and date fill. This can materially change schedule dates, work, assignments, resource load, and scenario output.
- **Smallest fix:** resolve each task's effective calendar from `readModel.calendars` plus `calendarExceptions`; use shared domain working-time helpers for date/duration conversion and expose `workingMinutesPerDay` to row/edit command builders. Keep Gantt geometry in calendar days, but never convert that pixel span directly into working minutes.
- **Test target:** focused unit/integration matrix with 6-hour and 7-day calendars, Friday-to-Monday, a holiday exception, and a per-task calendar override. Assert authored commands, calculated readback, visible finish, duration, assignment work, lag, and slack agree. Update PROJ-124 E2E to assert the rendered WBS/Gantt finish, not only authored `plannedFinish`.

### Medium

#### M1. The TaskModal `не назначен` option does not remove an existing assignment

- **Confidence:** Confirmed.
- **Symbols / evidence:** TaskModal exposes `<option value="">- не назначен -</option>` at `apps/web/src/delivery/schedule/schedule-editors.tsx:261-265`; edit state records the current assignment id at `schedule-surface.tsx:736-739`; submit emits `assignment.upsert` only when `v.assigneeId` is truthy and has no delete branch at `schedule-surface.tsx:752-760`. The domain supports `assignment.delete` in `packages/domain/src/planning/planningCommands.ts:93`.
- **Reproducible behavior / concrete path:** open Edit for a task with one assignee, select `не назначен`, save, and reload. No assignment command is emitted, so the old assignment and resource-load contribution remain. The control accepts the choice but cannot realize it.
- **Blast radius:** assignment/resource-load consistency in PROJ-034/PROJ-118; users cannot clear an executor from Schedule and may believe capacity was released.
- **Smallest fix:** when editing and `m.asgId` exists but `assigneeId` is empty, append `assignment.delete`. Define behavior for multiple assignments explicitly; the current singular modal silently edits only the first assignment returned by `currentAsg`.
- **Test target:** live/component test with one existing assignment: clear selection, assert batch includes `assignment.delete`, reload shows `-`, and resource-load contribution is gone. Add a multi-assignment case to prevent accidental partial replacement.

#### M2. Task title validation drifts across Schedule paths and the planning API accepts values Full Evaluation says must be rejected

- **Confidence:** Confirmed.
- **Symbols / evidence:** quick-create enforces 3 characters at `schedule-surface.tsx:770-789`, but inline rename accepts any non-empty title at `schedule-surface.tsx:821-831`, and TaskModal only checks `title.trim()` at `schedule-editors.tsx:243-247`. The planning parser accepts any non-empty bounded string up to 500 characters at `apps/api/src/planningParsers.ts:135-170,517-522`; the reducer adds no title-length validation (`packages/domain/src/planning/commandReducer.ts:33-39,416-458`). PROJ-032 explicitly lists `title <3` as an edge and TSV separately enforces 3-160 at `schedule-productivity.ts:72-80`.
- **Reproducible behavior / concrete path:** create through TaskModal or rename an existing task to `X`; preview/apply accepts it. A 161-500 character title is also accepted by the command API even though TSV rejects it and the documented task contract is 3-160.
- **Blast radius:** inconsistent data quality across create/import/rename paths and layout overflow risk; direct API clients bypass the one UI path that validates correctly.
- **Smallest fix:** add one shared task-title validator (trimmed, safe single-line, 3-160) at the API/domain boundary, then reuse it in TaskModal, inline rename, quick-create, and TSV parsing for immediate feedback.
- **Test target:** parser/reducer tests plus Schedule component/E2E for lengths 0, 1, 2, 3, 160, and 161; assert rejected writes do not increment plan version and the dialog/editor stays open with an inline message.

#### M3. Resource selection causes O(tasks) duplicate directory requests and degrades to an empty fake control on permission/network failure

- **Confidence:** Confirmed.
- **Symbols / evidence:** `ProjectSchedule` calls `useResourceDirectory` once at `schedule-surface.tsx:180`; every rendered task mounts a `ResourceEditor` at `schedule-surface.tsx:1251-1255`, and each `ResourceEditor` calls the hook again at `schedule-editors.tsx:50-60`; TaskModal calls it a third way at `schedule-editors.tsx:231-239`. Each hook instance constructs its own live client and starts `getResourceDirectory` at `apps/web/src/delivery/lib/use-resource-directory.ts:25-44`. The client swallows every error and returns `[]` at `apps/web/src/delivery/lib/planning-client.ts:106-122`; the API requires `tenant.users.read` via `canReadTenantUsers` at `apps/api/src/workspaceUserRoutes.ts:27-43`, while Schedule write visibility only checks `tenant.project_plan.manage` at `schedule-surface.tsx:34-38`.
- **Reproducible behavior / concrete path:** render a 100-task plan: the parent plus every `ResourceEditor` can issue separate `/api/workspace/users` requests. Give a custom role plan-manage but not users-read, or fail that endpoint: resource edit buttons remain visible, but each popover contains only its heading and no option/error/retry because 403/network errors become an empty list.
- **Blast radius:** Schedule load/network volume grows with row count; custom roles get an apparently writable but unusable resource control. The same hook also affects Overview, Assignments, and Resources, though the per-row amplification is Schedule-specific.
- **Smallest fix:** fetch once in `ProjectSchedule` (or a shared cached provider) and pass directory data/status to row editors and TaskModal. Preserve error/forbidden status instead of converting every failure to `[]`; hide/disable assignment controls or show an explicit unavailable state when names cannot be read.
- **Test target:** render N task rows with a counting fetch and assert exactly one users request. Add 403 and network-failure cases for a plan manager: no raw IDs, no blank actionable popover, and no write attempt without a selected real resource.

#### M4. Baseline overlay labels are hard-coded to `B2` even when no baseline or another baseline is active

- **Confidence:** Confirmed.
- **Symbols / evidence:** overlay geometry is driven by real `baselineComparison.tasks` in `apps/web/src/delivery/schedule/schedule-rows.ts:44,73,109-111`, but bar tooltip and legend are literal `Baseline B2` at `schedule-surface.tsx:1331,1438`. `baselineComparison.label` is available in the read model but never propagated.
- **Reproducible behavior / concrete path:** open Schedule for a project with no baseline or a baseline named `Release candidate`. The legend still claims `Baseline B2`; if bars exist, every tooltip also says B2. This is stale mock data attached to real geometry.
- **Blast radius:** PROJ-119 baseline consistency and auditability; users can compare against the wrong named snapshot.
- **Smallest fix:** carry `baselineComparison.label/id` in the mapped result; render the legend only when an active baseline exists and use its real label in legend/tooltips.
- **Test target:** `mapRows`/component cases for no baseline, label B1, and a custom label; assert no B2 literal remains and overlay labels match the active snapshot.

#### M5. Cancelling an undo preview permanently disables the otherwise valid undo

- **Confidence:** Confirmed.
- **Symbols / evidence:** `undo` calls `applyBatch(inverses)` and then unconditionally clears `lastCommitRef` and `canUndo` before inspecting the result at `schedule-surface.tsx:497-510`; `usePlanning.applyBatch` represents user cancellation as `preview_cancelled` at `apps/web/src/delivery/lib/use-planning.ts:129-136`.
- **Reproducible behavior / concrete path:** make an undoable edit, click Undo or press Ctrl+Shift+Z, then cancel preview. No compensating command is applied, but Undo becomes disabled and the in-memory inverse is discarded until another edit occurs.
- **Blast radius:** PROJ-126 and any user who opens preview to inspect impact before deciding; cancellation unexpectedly destroys capability.
- **Smallest fix:** retain `lastCommitRef`/`canUndo` on `preview_cancelled`; clear only after successful compensation or when a version conflict proves the inverse stale.
- **Test target:** component test for undo -> cancel -> undo again; assert the second attempt still opens preview and sends no apply before confirmation.

### Low

#### L1. Invalid finish dates close the editor and fail silently

- **Confidence:** Confirmed.
- **Symbols / evidence:** `DateEditor` closes on Apply whenever a non-empty date exists at `apps/web/src/delivery/schedule/schedule-editors.tsx:30-40`; `editFinish` returns without feedback when `newDur < 1` at `schedule-surface.tsx:653-656`.
- **Reproducible behavior / concrete path:** choose a finish equal to or before task start and click Apply. The popover closes, no command is sent, no row error/toast appears, and the user receives no explanation. PROJ-042 already names this edge as a gap.
- **Blast radius:** localized UX/support issue, but it masks a validation failure in a core date-edit path.
- **Smallest fix:** validate against the task start before closing; keep the popover open, render an inline error, and disable Apply until finish is later than start under the effective calendar semantics.
- **Test target:** component test for equal, earlier, and valid finish; invalid choices keep the editor open, show the message, and issue zero preview/apply calls.

## Missing regression coverage

- Current Schedule component tests replace `mapRows` with zero rows and mock `useResourceDirectory` to an empty inert object (`schedule-permission-worker09.test.tsx:39-49`, `schedule-productivity-ui.test.tsx:39-49`). They prove toolbar text presence/absence, not row-level write guards, editor behavior, request count, staged state, or real command generation.
- `schedule-productivity.test.ts:98-119` explicitly codifies calendar-day weekend fill, but never reconciles it with the working-time engine or rendered `calculatedFinish`.
- Full Evaluation E2E verifies date-fill authored fields at `projects-schedule-productivity.spec.ts:233-235`; it should also verify the WBS/Gantt date after authoritative recalculation.
- No focused tests were found for `applyStaged` cancellation, dirty batch mode toggling/interleaving, TaskModal unassignment, custom working-day length, baseline labels, resource-directory request cardinality/failure, or undo-preview cancellation.
- The permission test uses an empty row set, so it would still pass if a future regression exposed a row-level drag/editor/context-menu write control to PR. Add at least one task, assignment, dependency, baseline, and Gantt bar to the PR fixture and assert zero mutation entry points plus zero write requests.

## Scope and method

- **Resolved scope:** current Schedule surface, its direct editors/row/productivity helpers, `usePlanning`/resource-directory seams, planning command validation, working-time semantics, and Full Evaluation Schedule tests/matrix. No general project inventory and no product edits.
- **CodeGraph-first evidence:** ran `codegraph sync`; index reported 2,228 files, 24,825 nodes, and 53,167 edges. Entered through `codegraph_context`, `codegraph_search`, `codegraph_files`, `codegraph_explore`, `codegraph_node`, `codegraph_callers`, and `codegraph_impact` before targeted line reads. CodeGraph's duplicate `.claude/worktrees/full-eval-uiux` symbols made some natural-language context results ambiguous; after the required graph pass, exact current-worktree files were read directly for line-level evidence.
- **Review posture:** static/read-only. No source, test, API, fixture, or configuration file was changed.

## Prioritized repair order

1. Fix H1 and H3 together so staged state cannot become untracked or use a stale undo base.
2. Unify all mutation paths behind the batch-aware gateway (H2).
3. Replace fixed/calendar-day conversions with effective-calendar working-time helpers (H4) before adding more date productivity behavior.
4. Close assignment/title boundary defects (M1, M2), then resource-directory request/error handling (M3).
5. Repair baseline/cancel/error honesty (M4, M5, L1) and add the listed focused regressions.
