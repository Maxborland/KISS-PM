# Independent diagnosis: C02 / C03 Schedule Full Evaluation

Date: 2026-07-10
Mode: read-only diagnosis; no product/test source edits; no E2E or shared-DB access.

## Verdict

| Bundle | Current likely first failure | Classification | Confidence |
|---|---|---|---|
| C02 | `projects-schedule-closeout.spec.ts:363` expects the first newly-created root task to have Indent disabled, although `openSchedule` requires a pre-existing row and quick-create appends another root task after existing roots. | Test fixture/oracle bug, not a product bug | High |
| C03 | The zoom helper at `:446/:1170-1172` measures the whole `[data-task-id]` Gantt row, not a bar; if execution reaches the inspector, `:469-475` also selects an arbitrary first row and expects a spinbutton before the editable value is clicked. | Invalid locator/oracle, not an established product bug | High for the locator defects; medium for which one is observed first |

No source evidence identifies an API-contract defect responsible for either current failure.

## Evidence basis and limits

- The current machine receipt was overwritten by a later run and now records C02/C03 as `pending`; it no longer preserves their error text. `c02-blocker.png` exists, but no C03 blocker screenshot is written because C03 calls `executeBundle("C03", undefined, ...)` at `projects-schedule-closeout.spec.ts:423` and the catch only screenshots `defaultPage` at `:1024-1027`.
- Therefore `actual` below is derived from the current source/DOM contract. It is a deterministic static diagnosis, not a claim that E2E was reproduced.
- CodeGraph was used as the structural entry point. `codegraph sync` was intentionally not run because this assignment permits writing only this report; exact current lines were then read directly because the spec and Schedule files are uncommitted/untracked.

Source snapshot (SHA-256):

- `e2e/full-eval/projects-schedule-closeout.spec.ts`: `97D24F47D0D31F38B221525732072208D0798D1ADB07418C217829295031C6C9`
- `apps/web/src/delivery/schedule/schedule-surface.tsx`: `F510FCCA06C897948CB1284E5ED311E1475DCB1DC60EB90C062DF2CBEF640E77`
- `apps/web/src/delivery/lib/use-planning.ts`: `0C0D136C1C3A33AF6C332A933DDA14DCCD420718B294262F7CA809FA35FB8830`
- `apps/api/src/planning/registerPlanningRoutes.ts`: `8C327BE4997C3F470B3C42118A348ACD52E825AC195CE95844ABE59E937F999B`
- `apps/api/src/planningParsers.ts`: `F7154541DCDB85606D1B0891F117F23488F239B8C446D895E890D26DE50D662B`

## C02 diagnosis

### Current first failure: false indent boundary

Expected by test:

- `projects-schedule-closeout.spec.ts:358-363` creates `first`, selects it, and expects `getByTitle("На уровень глубже")` to be disabled.

Actual product contract:

- `openSchedule` at `:1142-1146` refuses to continue unless at least one `[data-schedule-row-id]` already exists.
- Quick-create at `:1201-1210` creates another task; Schedule quick-create supplies `parentTaskId: null` and appends it to the root list.
- `ProjectSchedule.prevSibling/canIndent` at `schedule-surface.tsx:987-990` enables indent whenever a row has a preceding sibling. `indent` at `:992` correctly moves it under that sibling with `task.move_wbs`.
- Consequently, “first created by this test” is not “first root sibling”. In the seeded project it has a preceding root and the toolbar control should be enabled.

Classification: **test fixture/oracle bug**. The product rule is internally consistent and is also used by the row context menu (`schedule-surface.tsx:1496-1507`).

Minimal patch:

1. Before creating C02 tasks, select the actual first rendered root row and assert Indent disabled there.
2. After creating `first`, assert Indent enabled (or omit that assertion), then keep the existing `second -> first` indent/readback.
3. Prefer a stable semantic locator by adding a non-production test attribute such as `data-schedule-parent-id`, or derive the boundary row from the read model. Do not infer hierarchy boundaries from creation order in a seeded plan.

### Next deterministic C02 oracle failures after that patch

1. **Batch mode is persistent, but the test assumes apply exits it.**
   - Test `:377` enters batch mode; `:386-394` applies it; `:397` clicks `Пакет` again expecting to start the reset case.
   - Product `applyStaged` clears `staged` but does not clear `batchMode` (`schedule-surface.tsx:573-592`). The toggle exposes this explicitly through `aria-pressed` at `:1426`.
   - Thus `:397` exits batch mode. `stageInlineEdit` at `:399` then starts a real preview/apply flow, and `Сбросить` at `:400` never appears.
   - Patch: remove the click at `:397`; assert `Пакет` still has `aria-pressed="true"`, stage the discard edit, then click `Сбросить`.

2. **The shared write helper destroys toolbar undo state.**
   - `inlineEdit` at `:1213-1224` delegates to `planningWrite`.
   - `planningWrite` always reloads at `:1285-1288`.
   - Toolbar undo is deliberately in-memory: `lastCommitRef`/`canUndo` are component state (`schedule-surface.tsx:389,418`), armed by `mutateCommands` and consumed by `undo` at `:696-737`.
   - Therefore after `inlineEdit(... undoTitle ...)` at test `:407`, the reload has remounted Schedule and the `Откат` button is disabled before `:409` can click it.
   - Patch: add `verifyReload?: boolean` to the test-only `WriteOptions`, skip `page.reload()` only for the write that arms toolbar undo and for the undo gesture, then perform one explicit reload/readback after the undo assertion.

3. **Double undo expects an unreachable toast.**
   - After successful undo, product sets `canUndo=false` (`schedule-surface.tsx:719-725`) and renders the toolbar button disabled (`:1427`).
   - Test `:414-415` clicks that disabled button and expects `Нет применённого действия для отката`. A disabled native button does not call `undo`, so the toast branch at `:699` is unreachable from that control.
   - Patch: assert the button is disabled and that the read model/version is unchanged; remove the toast oracle. If a second-click toast is the desired UX, that is a separate product decision requiring the button to remain enabled.

### C02 API contract check

- Batch request type is `{ commands, clientPlanVersion, idempotencyKey? }` in `packages/planning-client/src/api/types.ts:42-45`; client routes are `preview-command-batch` and `apply-command-batch` in `planningApiClient.ts:82-97`.
- API parser rejects empty/malformed batches and preserves version/key at `planningParsers.ts:78-100`.
- Apply route checks every command permission (`registerPlanningRoutes.ts:399-412`), idempotency hash/replay (`:443-467`), and version conflict (`:469-492`).
- It applies all commands and increments the plan version once (`:516-524`), then returns the authoritative read model (`:556-572`). This matches the test's intended “two edits, one version” contract.
- `task.move_wbs` is emitted by `moveCmd` at `schedule-surface.tsx:984-1002`; the observed boundary mismatch occurs before any API request.

## C03 diagnosis

### Zoom locator measures the wrong element

Expected by test:

- `projects-schedule-closeout.spec.ts:442-449` expects three measured widths to decrease for Day, Week, Month.

Actual locator/DOM:

- `firstGanttBar` at `:1170-1172` returns `page.locator("[data-task-id]").first()`.
- `[data-task-id]` is the full Gantt row container at `schedule-surface.tsx:1648`, not the visual bar.
- The actual task bar is the descendant `.gantt-bar` at `:1656-1659`; summary and milestone rows render different descendants at `:1649-1653`.
- Product zoom constants are correctly declared as `36/20/8` at `:308`, and actual bar width is calculated as `dayDur * dayW` at `:1643-1658`.

Classification: **wrong locator/oracle**. Measuring a row may accidentally observe timeline width, flex width, or viewport width; it does not prove task-bar reflow.

Minimal patch:

```ts
function firstGanttBar(page: Page) {
  return page.locator("[data-task-id] .gantt-bar").first();
}
```

Also assert the exact ratio within rounding tolerance (`day/week ~= 36/20`, `week/month ~= 20/8`) rather than only ordering.

### Inspector units oracle is impossible as written

Expected by test:

- `projects-schedule-closeout.spec.ts:469-475` clicks the first arbitrary Schedule row and immediately expects one admin spinbutton under `Единицы`.

Actual product contract:

- The first row may be a summary. `FactNum` is disabled for every non-task row at `schedule-surface.tsx:1721-1725`.
- Even for an editable task, `FactNum` initially renders a clickable `<dd>`, not an input (`:1874-1884`). The spinbutton exists only after that value is clicked.
- Plan readers correctly receive static `Fact`, because the editor is gated by `canManagePlan` (`:1725`); `canManagePlan` comes from `tenant.project_plan.manage` at `:41-50`.

Classification: **wrong row locator plus wrong interaction oracle**. No product bug is established.

Minimal patch:

1. Select a real task from the visual bar: obtain the ancestor `[data-task-id]` of the first `.gantt-bar`, then click the matching `[data-schedule-row-id]`.
2. For admin, click `units.locator("dd")`, then assert the spinbutton appears.
3. For planReader, assert no spinbutton before and after clicking the static value, and assert zero planning POSTs.
4. If the bundle continues to claim “admin units write”, commit a changed value through preview/apply, assert authoritative `workMinutes`/assignment readback, then restore it. Merely counting an input does not prove a write.

### Policy harness caveat

- `projects-schedule-closeout.spec.ts:424-425` records a soft failure when `SCHEDULE_FILTERS_COLUMNS_POLICY` is absent. `executeBundle` turns any soft error into a blocker at `:1018-1021`.
- Current Schedule renders Baseline and Saved Views at `schedule-surface.tsx:1433-1434`; there are no Filters/Columns controls.
- If the run omitted the environment variable, that failure is **harness configuration**, not product behavior. Minimal patch is to encode the decided policy (`absent`) in the spec/config instead of making a product oracle depend on an ad hoc shell variable.

### C03 API contract check

- Both actors load the same read-model route at `registerPlanningRoutes.ts:96-111`; authorization delegates to `canReadProjectPlan` in `planningRouteAuth.ts:10-18`.
- Schedule write controls are gated client-side by plan-manage permission (`schedule-surface.tsx:45-50,342-348`), while API preview/apply independently checks command permissions. The reader's static inspector is consistent with that contract.
- Admin unit editing calls `editUnits -> workEdit` at `schedule-surface.tsx:897-913`, producing `task.update_work_model` and, when assigned, `assignment.upsert`. Nothing in C03 currently reaches or disproves that API path.

## Acceptance checks for the proposed test patch

### C02

- Boundary: actual first root row has Indent disabled; a root row with a previous sibling has it enabled.
- Hierarchy: indent and outdent each produce one accepted preview/apply chain; `parentTaskId` and order persist after reload.
- Batch: entering mode sets `aria-pressed=true`; two staged edits produce zero planning POSTs before Apply; Apply sends one batch envelope and increments version exactly once.
- Reset: while mode remains active, staged edit plus Reset sends zero planning POSTs and restores the authoritative read model.
- Undo: the arming write is not followed by an intervening remount; first undo creates one compensating batch/version; button then becomes disabled; explicit reload preserves reverted data.
- Evidence honesty: either implement reject/conflict/navigation and unsupported/stale/foreign undo checks, or remove those unexecuted claims from `BUNDLE_ASSERTIONS.C02` (`projects-schedule-closeout.spec.ts:118-121`).

### C03

- Policy: Baseline href is exact; Filters/Columns policy is declared in checked-in test/config and matches the DOM for both roles.
- Zoom: measure `.gantt-bar`, not `[data-task-id]`; widths follow 36/20/8 scaling for the same task.
- Collapse: row count decreases and restores; if connectors are claimed, assert the affected SVG edge disappears/restores.
- Column resize: first header clamps at 36 px and resets to its default after remount.
- Inspector: select a leaf task; admin activates the units editor by clicking the value; reader never receives an editable control or planning write path; close removes the inspector.
- Evidence honesty: either execute/read back an admin units mutation and connector behavior, or narrow `BUNDLE_ASSERTIONS.C03` (`:122-125`) to what the test actually proves.

## Change index

- Product/test files changed: none.
- Added artifact: `.superloopy/evidence/schedule-closeout-2026-07-10/diagnosis-c02-c03.md`.
- Symbols added/changed/removed: none (Markdown-only artifact).
- CodeGraph nodes/edges before -> after: unchanged by this assignment; sync intentionally skipped to honor the one-file write scope.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/diagnosis-c02-c03.md
