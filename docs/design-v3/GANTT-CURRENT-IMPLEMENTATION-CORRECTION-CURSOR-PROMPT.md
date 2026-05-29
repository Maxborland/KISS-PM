# Cursor Prompt — Gantt Current Implementation Correction

Context:

You are working in KISS PM design-v3 Storybook.

Worktree:

```txt
E:\KISS-PM\.worktrees\design-v3-vh-split-pane
```

Target story:

```txt
http://localhost:6006/iframe.html?id=views-screens--project-gantt
```

Relevant files:

```txt
apps/web/src/views/blocks/gantt-slice-block.tsx
apps/web/src/widgets/gantt/*
apps/web/src/styles/widgets/gantt.css
apps/web/src/views/screens/screens.stories.tsx
```

## Important language rule

- Visible UI text must be Russian.
- API contracts, TypeScript types, reducer actions, command/event names, internal code identifiers must be English.
- UI labels/tooltips/errors/context menu items must be Russian.
- Product abbreviations may remain as-is: WBS, KPI, SPI, CPI, FS, SS, FF, SF.

Current problem:
The latest Gantt implementation still has UX and layout regressions. Screenshot shows English/mixed UI copy and a broken/slipped drawer layout. This prompt is a correction pass, not a new feature expansion.

Do not claim completion until every P0 item below is implemented and manually verified in Storybook.

---

# P0 corrections

## 1. Clicking a Gantt bar must NOT open the side drawer

Current problem:
Clicking a bar in the chart opens the side task drawer. This is wrong.

Required behavior:

- Single click on a Gantt bar selects the task/bar only.
- It must not open the side drawer.
- Double-click on a bar may open task details if desired.
- Right-click opens context menu.
- Explicit actions that may open drawer:
  - clicking “Свойства” / “Открыть свойства”;
  - double-click row/cell if that is the chosen UX;
  - toolbar/context menu action;
  - keyboard shortcut if implemented.

Acceptance:

- Click bar once → only selection changes.
- Drawer remains closed.
- Existing selected row/bar visual state remains synchronized.

Internal action names in English:

- `selectTaskBar`
- `openTaskDetails`
- `toggleTaskDetailsDrawer`

Visible UI Russian:

- “Открыть свойства”
- “Свойства задачи”

---

## 2. Side drawer must overlay; opening it must not rebuild/reflow the whole interface

Current problem:
Opening the side drawer changes/rebuilds the rest of the interface layout. It should behave like an overlay panel.

Required behavior:

- Drawer slides over the Gantt from the right.
- Opening drawer must not resize/reflow/recalculate the main Gantt layout.
- The Gantt underneath should keep its column widths, chart width, scroll position, selected row, and current viewport.
- Drawer should have fixed/responsive width, e.g. `360px–420px`, with max-width for small screens.
- Drawer should use overlay stacking, not flex layout that pushes/rebuilds Gantt.
- No global layout jump.
- Close button works.
- Escape closes drawer.
- Click outside can close drawer if consistent with app patterns.
- Respect `prefers-reduced-motion`.

Acceptance:

- Open drawer → Gantt table/chart do not change width or move.
- Close drawer → no scroll/layout jump.
- Drawer slide animation is visible unless reduced motion is enabled.

Visible UI Russian:

- “Свойства задачи”
- “Закрыть”
- “Открыть задачу”

---

## 3. Use the existing Storybook/app date picker, not a random input

Current problem:
Date picker was not implemented or does not use the app’s existing Storybook date picker component.

Required behavior:

- Find the existing date picker/calendar component or Storybook primitive in the project.
- Reuse it for Gantt date fields.
- Do not invent a visually inconsistent date input if the app already has a date picker.
- Date picker UI must be Russian.
- It must be usable in:
  - grid date cells;
  - right drawer date fields.

Date fields:

- “Начало”
- “Окончание”

Acceptance:

- Double-click/focus date cell opens date picker.
- Drawer date field opens same date picker.
- Selecting date updates local Gantt state.
- Invalid date shows Russian validation error.

---

## 4. Labor / work effort must be editable and linked to dates/duration

Current problem:
Labor/work effort is displayed but not part of the real editable planning model.

Required model:

Add explicit local frontend fields where needed:

```ts
type GanttRow = {
  durationDays: number;
  startDay: number;
  // existing fields...
  workHours?: number;
  hoursPerDay?: number;
};
```

Naming can differ if there is a better existing model, but internal names must be English.

Visible UI Russian:

- “Трудозатраты”
- “ч”
- “ч/день”
- “Длительность”
- “Начало”
- “Окончание”

Required behavior:

- Labor/work effort cell is editable.
- Labor/work effort field exists in the right drawer.
- Date/duration/labor fields are linked.
- Default relation:
  - `workHours = durationDays * hoursPerDay`
  - default `hoursPerDay = 8`
- If user sets duration to 1 day:
  - dates update consistently;
  - default labor becomes 8h unless custom labor/hoursPerDay was set.
- If user sets duration to 5 days:
  - default labor becomes 40h.
- User must be able to override ratio:
  - example: 5 days and 20h is valid → 4h/day.
- If user edits labor directly:
  - preserve start/finish/duration unless the UX explicitly asks to recalculate;
  - update `hoursPerDay`/derived ratio.
- If user edits finish date:
  - duration changes;
  - labor recalculates only if task is still in default effort mode;
  - if custom effort mode is active, preserve workHours and update hoursPerDay.

Recommended internal helper concepts:

```ts
type EffortMode = "auto" | "custom";
updateTaskDuration(...)
updateTaskStartDate(...)
updateTaskFinishDate(...)
updateTaskWorkHours(...)
deriveWorkHours(...)
deriveHoursPerDay(...)
```

Acceptance:

- Editing duration updates finish date and default labor.
- Editing start date keeps duration and labor logic consistent.
- Editing finish date updates duration and labor logic consistently.
- Editing labor allows custom non-8h/day planning.
- Grid and drawer stay in sync.
- Undo/redo works.

---

## 5. Planning errors, conflicts, and resource overloads must be highlighted

Current problem:
Planning problems are not clearly visible.

Required visual states:

- planning error;
- date conflict;
- dependency conflict;
- resource overload;
- invalid cell value;
- backend/scheduling pending state if relevant.

Visible UI Russian examples:

- “Ошибка планирования”
- “Конфликт сроков”
- “Перегруз ресурса”
- “Некорректное значение”
- “Проверка планирования недоступна без backend”

Required behavior:

- Cell-level errors are highlighted directly in cells.
- Row-level planning problems are highlighted in WBS row and chart row.
- Bar-level problems are visible on chart bar.
- Drawer shows related issue summary for selected task.
- Do not use only color; include icon/text/tooltip/title.
- Mock planning issues can be part of Storybook fixture/local state.

Acceptance:

- Storybook has visible examples of:
  - invalid date/duration;
  - dependency conflict;
  - resource overload;
  - warning state.
- UI copy is Russian.
- Internal issue types are English.

Suggested internal types:

```ts
type GanttPlanningIssueType =
  | "invalid_date"
  | "dependency_conflict"
  | "resource_overload"
  | "schedule_conflict"
  | "backend_pending";
```

---

## 6. Columns must support resize and reorder

Current problem:
Columns are fixed. MS Project-like grid needs configurable columns.

Required behavior:

- User can resize WBS/grid columns.
- User can reorder columns by drag/drop or equivalent UI.
- Column order/width is saved in hidden user settings on frontend.
- No backend required.
- Use localStorage or existing frontend user settings mechanism if available.
- Do not expose hidden settings UI unless already part of product design.
- Reset-to-default helper/action can exist in Storybook if useful.

Visible UI Russian:

- tooltip: “Изменить ширину столбца”
- tooltip: “Перетащить столбец”
- optional: “Сбросить настройки столбцов”

Internal naming English:

```ts
type GanttColumnConfig = {
  id: string;
  width: number;
  visible: boolean;
  order: number;
};

loadGanttColumnSettings(...)
saveGanttColumnSettings(...)
resetGanttColumnSettings(...)
```

Acceptance:

- Resize a column → width changes immediately.
- Refresh Storybook → width persists via local frontend settings.
- Reorder columns → order changes and persists.
- Chart alignment remains correct.
- No row height/layout breakage.

---

## 7. Visible UI must be Russian; fix English/mixed/slipped copy

Current problem:
Screenshot shows English/mixed copy and broken/slipped interface.

Required behavior:

- Audit all visible Gantt UI strings.
- Replace visible English with Russian.
- Keep only accepted abbreviations: WBS, KPI, SPI, CPI, FS, SS, FF, SF.
- Technical/internal code remains English.
- Fix any visibly slipped/broken layout in drawer and field groups.

Specific screenshot issue:

- “backend pending” is visible in English inside Russian UI.
- Replace with Russian, for example:
  - “Пересчёт сроков — только предпросмотр, backend ещё не подключён.”

Acceptance:

- No visible English in Gantt UI except accepted abbreviations.
- Drawer field layout no longer looks broken/slipped.

---

## 8. Right drawer must include “open full task screen” action

Requirement:

The side drawer must allow opening the selected task in the full task screen.

Target existing screen:

```txt
Views/Screens/03 Task Card
screen id: 03-task-card
```

Behavior:

- Add visible Russian action in drawer:
  - “Открыть карточку задачи”
- In Storybook/frontend-only context, this can:
  - emit callback `onOpenTaskCard(taskId)`;
  - navigate/update Storybook state if existing routing pattern supports it;
  - or show documented action event in Storybook.
- Do not implement backend.
- Do not make this a dead button.

Internal callback name:

```ts
onOpenTaskCard(taskId: string): void
```

Acceptance:

- Button is visible in drawer.
- Clicking it performs a frontend action/callback and is observable in Storybook.
- Button is not dead.

---

# Required Storybook stories / states

Add or update stories to prove the above:

```txt
Widgets/Gantt/DrawerOverlayNoReflow
Widgets/Gantt/DatePickerEditing
Widgets/Gantt/EffortDurationLinkedFields
Widgets/Gantt/PlanningIssuesAndOverloads
Widgets/Gantt/ColumnResizeAndReorder
Widgets/Gantt/OpenTaskCardAction
Widgets/Gantt/BarClickDoesNotOpenDrawer
```

Keep integrated story:

```txt
Views/Screens/12 Project Gantt
```

Stories must use real components and local controlled state, not screenshots.

---

# Manual verification checklist

Before final report, manually verify:

- Click Gantt bar once → selects bar/task only; drawer does not open.
- Open drawer explicitly → Gantt layout does not reflow/rebuild.
- Drawer slides in/out smoothly.
- Date fields use app/Storybook date picker.
- Labor/work effort is editable.
- Duration/date/labor fields recalculate correctly.
- Custom ratio works: 5 days + 20h = 4h/day, not forced to 40h.
- Planning errors/conflicts/overloads are highlighted in grid/chart/drawer.
- Columns resize.
- Columns reorder.
- Column settings persist in local hidden user settings.
- Visible UI is Russian.
- Drawer has working “Открыть карточку задачи” action.

---

# Tests

Run:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
```

Add tests where practical for:

- date/duration/labor recalculation;
- custom effort ratio;
- bar click vs drawer open behavior;
- column settings persistence helpers;
- planning issue classification/display helpers;
- Russian visible strings if there is existing Storybook contract/lint support.

---

# Final report format

Report:

1. Implemented corrections.
2. Remaining known issues.
3. Files changed.
4. Stories to review.
5. Tests/typecheck results.
6. Manual verification results.

Do not claim completion if any P0 item above is not actually implemented and manually verified.
