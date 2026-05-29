# Cursor Prompt — Gantt MS Project Interaction Punch List

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
```

## Important language rule

- Visible UI text must be Russian.
- API contracts, TypeScript types, reducer actions, command/event names, internal code identifiers must be English.
- UI labels/tooltips/errors/context menu items must be Russian.
- Do not mix English into visible UI unless it is a product abbreviation like WBS, KPI, SPI, CPI, FS, SS, FF, SF.

## Goal

Finish the missing MS Project-like frontend interactions in the Gantt.

The previous implementation is still too row-oriented. We need spreadsheet-like cell interactions, right-click actions, row DnD, real date/resource pickers, and fully functional bars.

Do not implement backend/API/persistence. Everything must work on local controlled frontend state.

## Hard constraints

- Do not add fake/dead controls.
- Do not replace the current Gantt implementation.
- Do not remove existing working interactions.
- Do not leave “TODO UI” for required items.
- If a feature cannot be completed safely, disable the UI and document it explicitly.
- Do not answer with “done” unless every P0 item is actually implemented and manually verified.

---

# P0 scope — must implement

## 1. Slide animation for right task details drawer

Current problem:
The drawer opens/closes without a proper slide animation or feels abrupt.

Requirements:

- Add smooth right-side slide-in/out animation.
- Respect `prefers-reduced-motion`.
- Drawer must not break Gantt layout at 1440x900.
- Close button works.
- Selecting another task updates drawer content without closing.
- Visible UI copy is Russian.

Acceptance:

- Opening/closing drawer visibly slides.
- No layout jump except intended reserved width/overlay behavior.
- Reduced motion users get no/limited animation.

---

## 2. Right-click context menu

Add context menu for:

- WBS cells;
- task rows;
- chart bars;
- dependency lines if practical.

Context menu items in Russian:

- “Открыть свойства”
- “Добавить задачу выше”
- “Добавить задачу ниже”
- “Удалить задачу”
- “Копировать”
- “Вставить”
- “Очистить ячейку”
- “Сдвинуть вправо”
- “Сдвинуть влево”
- “Повысить уровень”
- “Понизить уровень”
- “Связать задачи”
- “Удалить связь”

Internal action names in English:

- `openTaskDetails`
- `insertTaskAbove`
- `insertTaskBelow`
- `deleteTask`
- `copyCells`
- `pasteCells`
- `clearCells`
- `shiftTaskRight`
- `shiftTaskLeft`
- `outdentTask`
- `indentTask`
- `linkTasks`
- `deleteDependency`

Requirements:

- Context menu position follows cursor.
- Menu closes on outside click, Escape, action.
- Disabled actions are visibly disabled.
- Actions apply to current selected cell/range/row/bar as appropriate.
- Add Storybook story: `Widgets/Gantt/ContextMenuActions`.

---

## 3. Cell-level selection, not only row selection

Current problem:
Interaction is row-oriented. Need spreadsheet-like cells similar to MS Project.

Requirements:

- Single cell selection.
- Range selection by Shift+click or drag across cells.
- Multi-cell selection must be visible with border/fill.
- Keyboard navigation:
  - Arrow keys move active cell.
  - Shift+Arrow extends range if feasible.
  - Enter starts editing.
  - Escape cancels editing/selection operation.
  - Delete clears selected editable cells.
  - Ctrl/Cmd+C copies selected cells to clipboard/plain TSV.
  - Ctrl/Cmd+V pastes TSV into selected range where fields are editable.
- Row header click selects row.
- Column header click may select column if easy; otherwise not required.
- Selected cells must be independent from selected task row, but row context should update selected task/details panel.

Acceptance:

- User can select a specific cell, not just a row.
- Copy/paste works for at least name, duration, progress, dates, resource, predecessors.
- Delete clears allowed cells or resets to safe empty/default values.
- Non-editable cells do not mutate silently.

---

## 4. Copy/delete/clear cells like MS Project

Requirements:

- Copy selected cell/range to clipboard as TSV.
- Paste TSV into grid starting at active cell.
- Delete key clears selected editable cells.
- Context menu has Copy/Paste/Clear.
- Validation applies on paste.
- Invalid paste values show Russian validation feedback and do not corrupt state.
- Undo/redo works after paste/delete/clear.

Acceptance:

- Copy a range from Gantt and paste back into another range.
- Delete selected duration/progress/resource/predecessor cells.
- Invalid pasted date/duration shows error.

---

## 5. Drag-and-drop rows

Add WBS row DnD.

Requirements:

- Drag row by dedicated handle/row header, not by random cell text.
- Reorder rows locally.
- Preserve hierarchy rules:
  - dragging summary row moves its visible subtree;
  - dragging child within summary keeps valid WBS structure;
  - invalid drops are blocked with visual cue.
- WBS numbers recompute after drop.
- Chart row order stays synced.
- Dependencies remain attached to task IDs.
- Undo/redo works after row DnD.
- Add story: `Widgets/Gantt/RowDragAndDrop`.

Visible UI:

- drag handle tooltip: “Перетащить строку”
- drop indicator must be visible.

---

## 6. Date picker for date cells

Current problem:
Date picker was not implemented.

Requirements:

- Start/finish date cells use a date picker or styled native date input if no app date picker exists.
- Date picker visible UI is Russian:
  - month/day labels;
  - “Сегодня” if present;
  - validation messages in Russian.
- Editing start date keeps duration stable.
- Editing finish date updates duration.
- Milestone date edit works.
- Keyboard editing still works.
- Drawer uses same date picker component.

Acceptance:

- Double-click date cell opens picker/input.
- Selecting date updates grid and bar.
- Invalid date is rejected with Russian error.

---

## 7. Resource picker for resource cells

Current problem:
Resource picker was not implemented.

Requirements:

- Use mock resources fixture.
- Resource cell opens popover picker.
- Search/filter by name or initials.
- Select one resource at minimum; multi-select optional if model supports it.
- Drawer uses same picker.
- UI copy Russian:
  - “Назначить ресурс”
  - “Найти ресурс”
  - “Без ресурса”

Internal type/action names English:

- `GanttResource`
- `ResourcePicker`
- `assignResource`

Acceptance:

- User can change resource from grid and drawer.
- Grid, drawer, and bar/readout stay in sync.

---

## 8. Dependency editor completeness

Current problem:
Need all dependency types and lead/lag, usable from UI.

Requirements:

- Structured dependency editor in predecessor cell and drawer.
- Supports:
  - FS
  - SS
  - FF
  - SF
  - lag/lead days: +2d, -1d
- Display format examples:
  - `3FS`
  - `3FS+2d`
  - `4SS-1d`

UI labels Russian:

- “Тип связи”
- “Опережение/запаздывание”
- “Предшественник”
- “Добавить связь”
- “Удалить связь”

Internal enum/type/helper names English:

- `GanttDependencyType`
- `lagDays`
- `parsePredecessorText`
- `formatPredecessorText`

Acceptance:

- User can edit dependency type and lag in drawer.
- Predecessor cell text and dependency overlay stay in sync.
- Self-dependency is blocked.
- Duplicate dependency is blocked.
- Invalid string shows Russian validation error.

---

## 9. Fully functional bars

Current problem:
Bars must be fully functional, not partially interactive.

Required:

- Move task bar horizontally.
- Resize right edge.
- Resize left edge.
- Change progress by dragging progress handle.
- Move milestone horizontally.
- Summary rows:
  - either implement summary bar behavior safely,
  - or hide unsupported handles and make summary bar non-editable.
- Bar operations update:
  - start/finish/duration cells;
  - drawer fields;
  - visual chart;
  - undo/redo stack.
- Add clear Russian drag readout:
  - “Начало”
  - “Окончание”
  - “Длительность”
  - “Прогресс”

Acceptance:

- Manual test in Storybook confirms every bar operation works.
- No visible handles for unsupported operations.
- Drop commits local state.
- Escape cancels if feasible.

---

## 10. Audit missing interactions before final report

Before final report, audit the Gantt yourself and list anything still missing.

Specifically check:

- slide drawer animation;
- context menu;
- cell selection/range;
- copy/paste/delete cells;
- row DnD;
- date picker;
- resource picker;
- dependency editor with FS/SS/FF/SF + lag/lead;
- bar move/resize/progress/milestone move;
- collapse/expand summary tasks;
- undo/redo after each mutation;
- Russian visible UI;
- English internal contracts.

---

# Storybook stories to add/update

Add/update:

```txt
Widgets/Gantt/ContextMenuActions
Widgets/Gantt/CellRangeSelection
Widgets/Gantt/CopyPasteCells
Widgets/Gantt/RowDragAndDrop
Widgets/Gantt/DatePickerEditing
Widgets/Gantt/ResourcePicker
Widgets/Gantt/DependencyTypesAndLag
Widgets/Gantt/BarMoveResizeProgress
Widgets/Gantt/RightDetailsDrawerAnimated
```

Also keep integrated story:

```txt
Views/Screens/12 Project Gantt
```

Stories must use real components and local controlled state, not screenshots.

---

# Tests

Run:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
```

Add pure tests where practical for:

- cell selection reducer;
- TSV copy/paste mapping;
- clear/delete behavior;
- row DnD hierarchy reorder;
- dependency parse/format/validation;
- date edit helpers;
- bar move/resize/progress reducer transitions.

---

# Final report format

Report:

1. Implemented items.
2. Items still missing or intentionally out of scope.
3. Files changed.
4. Storybook stories to review.
5. Tests/typecheck results.
6. Known visual/UX caveats.

Do not claim completion if any P0 item is not implemented and manually verified.
