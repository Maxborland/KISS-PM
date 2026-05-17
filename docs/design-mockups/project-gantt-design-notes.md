# Project Gantt Planner v6 Design Notes

## Decision

The accepted mock direction is a dense professional planning workspace, not a dashboard. The screen uses an MS Project-like dual pane as the primary working plane:

```txt
Excel-like task grid + Gantt timeline
-> risk/resource signal
-> recommended governed action
-> dry-run preview
-> apply command
-> audit/readback
-> refreshed projection
```

## What Changed From The Rejected Mock

- v6 uses BR2/Gun Gantt as a read-only interaction reference. The extracted patterns are: virtualized/task-grid mindset, column sizing, command search, select editors, resource autocomplete, constraint/predecessor helper copy, timeline drag-preview/update, and resource conflict preview-before-apply.
- The mock now includes dropdown editors for controlled fields (`Режим`, `Тип задачи`, `Ограничение`), datalist autocomplete for resources, predecessors, task names, and dates, plus a command/search palette for tasks and actions.
- Active-cell hints and tooltips explain the current field, including predecessor syntax and the `Труд = длит. x загрузка` recalculation behavior.
- The left pane is now the main interaction surface: active cell, cell address, formula/input bar, F2 edit, typing over a cell, Enter/Escape behavior, arrows/Tab navigation, undo/redo, bottom-row task creation, Insert/Delete, column resize, and column hide/show.
- The Gantt pane is synchronized with table state: task selection, baseline mode, status date, dependency lines, summary bar, milestone diamond, critical bars, splitter, hide/show Gantt, and bar-drag handler.
- The resource conflict mode is a real workspace, not a passive card: conflict list, heatmap, selected signal, recommendation, dry-run, apply, audit id, readback, and return-to-Gantt projection update.
- The right management panel is a sliding assistant surface. It reacts to selected task/conflict and keeps normal table edits separate from governed actions.
- Visual language is restrained: neutral grid, blue primary actions, teal success/readback, amber warning, red critical. No decorative hero, no card-heavy dashboard layout.

## MS Project Reference Coverage

- Gantt Chart as grid + timeline.
- Tracking Gantt as current bars + baseline bars.
- Excel-like keyboard/editing behaviors: F2, typing, Enter, Tab, arrows, blank row, Insert, Delete, undo/redo.
- Task fields: mode, WBS, duration, start, finish, predecessors, resources, work, units, percent done, task type, constraint.
- Task types: `Фикс. единицы`, `Фикс. труд`, `Фикс. срок`.
- Planning formula: `Труд = длит. x загрузка`.
- Predecessor labels: `Оконч.-Нач.`, `Нач.-Нач.`, `Оконч.-Оконч.`, `Нач.-Оконч.`.
- Baseline, milestone diamond, critical path, status date, and resource overallocation concept.

## Known Mock Limits

- This is still a prototype, not the production scheduling engine.
- Calendar math is simplified to indexed working-day labels.
- BR2/Gun Gantt packages were not vendored into KISS PM; v6 is a standalone mock extraction to validate UX before production architecture.
- Drag verification uses the mock drag handler in browser automation; the interactive browser check also confirms the bar moves.
- Production implementation must replace mock-local state with canonical task/scheduling/resource APIs, permission checks, audit contracts, and E2E.

## Evidence

- Mock artifact: `.superpowers/brainstorm/visual-r2-20260517121053/content/project-gantt-planner-v6.html`
- Verification script: `.superpowers/brainstorm/visual-r2-20260517121053/verify-project-gantt-v6-mock.mjs`
- Acceptance matrix: `docs/design-mockups/project-gantt-v6-acceptance-matrix.json`
- Browser report: `docs/design-mockups/artifacts/project-gantt-v6/browser-verification-report.json`
- Screenshots:
  - `docs/design-mockups/artifacts/project-gantt-v6/desktop-initial.png`
  - `docs/design-mockups/artifacts/project-gantt-v6/desktop-after-apply.png`
  - `docs/design-mockups/artifacts/project-gantt-v6/narrow-1024.png`
