# Cursor Prompt — Gantt Layout + Dependency Handles Correction

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
- Product abbreviations may remain as-is: WBS, KPI, SPI, CPI, FS, SS, FF, SF.

## Current correction

The latest implementation still has visible layout problems:

1. Drawer layout is still visually broken/slipped.
2. There are ugly heavy outlines/borders around the side drawer and overload/problem cells.
3. Planning issue styling looks scary and visually dirty.
4. Task dependencies should be created by dragging small controls from task pill endpoints, not by a separate awkward UI.

This is a P0 correction pass. Do not add unrelated features. Do not claim done until every acceptance item is manually verified in Storybook.

---

# P0.1 — Fix drawer and problem-cell visual styling

## Problem

The side drawer and overload/problem cells have heavy, ugly outlines. The UI looks broken and scary.

## Required visual direction

Remove harsh outlines. Use a calmer KISS PM design-v3 style:

- no thick red/pink/black outlines around drawer;
- no aggressive full-cell red borders for overload/conflict cells;
- use soft background tint + left stripe/icon/chip + tooltip/title;
- keep enough contrast, but do not make the screen look broken;
- error/conflict/overload states should be readable, not alarming by default.

## Recommended visual system

Use severity styles:

```ts
type GanttIssueSeverity = "info" | "warning" | "danger";
```

Visible Russian labels/examples:

- “Ошибка планирования”
- “Конфликт сроков”
- “Перегруз ресурса”
- “Некорректное значение”

Styling guidance:

- Warning: soft amber background, amber left stripe or small chip.
- Danger: soft red background, red left stripe/icon, not full thick border.
- Info: soft blue background.
- Selected + issue state must not stack into visual chaos.

## Drawer styling requirements

- Drawer must look like a clean overlay panel, not a broken bordered block.
- Use subtle shadow and 1px neutral border or no border; avoid heavy outline.
- Field groups inside drawer must align cleanly.
- Dependency section in drawer must not look slipped/misaligned.
- Textarea/input fields must use app input styling and consistent spacing.
- Drawer should not reflow the main Gantt layout.

Acceptance:

- Screenshot no longer shows scary outlines around the drawer.
- Overload/conflict/problem cells are visible but calm.
- Selected row + issue styling remains readable.
- No visible English copy except WBS/KPI/SPI/CPI/FS/SS/FF/SF.

---

# P0.2 — Dependency creation via task pill endpoint handles

## Problem

Dependency creation should work like a desktop Gantt: small handles appear on both sides of a task pill. User drags from one handle to another task handle. The dependency type is determined by which endpoints are connected.

## Required UX

Each editable task/milestone bar should have endpoint connection handles:

- left handle = task start endpoint;
- right handle = task finish endpoint.

Handles should be:

- hidden by default;
- visible on bar hover;
- visible when the bar is selected;
- visible during link mode/active drag;
- small, clean, and not visually noisy.

Visible tooltips in Russian:

- left handle: “Связать от начала”
- right handle: “Связать от окончания”

Internal endpoint names in English:

```ts
type GanttDependencyEndpoint = "start" | "finish";
```

## Dependency type mapping

The dependency type is determined by source endpoint → target endpoint:

```txt
source finish -> target start  = FS  Finish-to-Start
source start  -> target start  = SS  Start-to-Start
source finish -> target finish = FF  Finish-to-Finish
source start  -> target finish = SF  Start-to-Finish
```

Internal type:

```ts
type GanttDependencyType = "FS" | "SS" | "FF" | "SF";
```

## Interaction requirements

- User presses and holds a left/right handle on source task pill.
- While dragging, show a preview dependency line following pointer.
- Potential target handles become visible/highlighted.
- Dropping on a target handle creates the dependency with correct type.
- Dropping elsewhere cancels.
- Escape cancels active link creation.
- During drag, show a small Russian readout if useful:
  - “Связь: FS”
  - “Связь: SS”
  - “Связь: FF”
  - “Связь: SF”
- Do not require opening drawer to create the initial dependency.
- Drawer can still edit dependency type/lag after creation.

## Visual requirements

- Handles should be small circles or dots attached to the pill endpoints.
- Handles must not shift bar layout.
- Handles must not be visible on every task all the time.
- Preview line should be readable but not overpower task bars.
- Existing dependency lines should remain readable.

Acceptance:

- Drag right handle of task A to left handle of task B creates FS.
- Drag left handle of task A to left handle of task B creates SS.
- Drag right handle of task A to right handle of task B creates FF.
- Drag left handle of task A to right handle of task B creates SF.
- Created dependency appears in predecessor cell and drawer.
- Dependency overlay renders the new dependency.

---

# P0.3 — Validate dependency creation

## Required validation

Dependency creation must validate before committing local state.

Block:

- self-dependency;
- duplicate exact dependency;
- cyclic dependencies;
- dependency to hidden/collapsed row if target is not visible;
- dependency between unsupported row types if any unsupported types exist.

At minimum:

- tasks and milestones are valid endpoints;
- summary rows should not be linkable unless explicitly supported safely.

Visible Russian validation messages:

- “Нельзя связать задачу саму с собой”
- “Такая связь уже существует”
- “Такая связь создаёт циклическую зависимость”
- “Нельзя связать скрытую задачу”
- “Для суммарных задач связь пока недоступна”

Internal helpers in English:

```ts
validateDependencyCreation(...)
createsDependencyCycle(...)
isDuplicateDependency(...)
canLinkRow(...)
```

Tests required:

- self dependency blocked;
- duplicate dependency blocked;
- cycle A→B→C→A blocked;
- FS/SS/FF/SF mapping from endpoint pairs;
- hidden row dependency blocked if collapsed.

Acceptance:

- Invalid dependency is not added to local state.
- User sees Russian validation feedback.
- No console errors.
- Valid dependency is added and undoable.

---

# P0.4 — Audit current drawer copy and layout

Current screenshot still contains awkward/mixed copy and layout issues in the dependency section.

Fix:

- Dependency section labels must align correctly.
- “Опережение/запаздывание” and input must not look detached/slipped.
- Replace any remaining English visible copy like “backend pending” with Russian.
- Use compact field grid inside drawer.
- Ensure drawer width is enough for labels; otherwise use vertical layout.

Suggested Russian copy:

```txt
Новые связи создаются перетаскиванием маркеров на концах полос задач.
Пересчёт сроков — только предпросмотр, backend ещё не подключён.
```

Accepted visible abbreviations:

```txt
FS, SS, FF, SF
```

---

# Storybook stories to add/update

Add or update focused stories:

```txt
Widgets/Gantt/DependencyEndpointHandles
Widgets/Gantt/DependencyCreationValidation
Widgets/Gantt/PlanningIssueStyling
Widgets/Gantt/DrawerVisualCorrection
```

Keep integrated story:

```txt
Views/Screens/12 Project Gantt
```

Stories must use real components and local controlled state, not screenshots.

---

# Manual verification checklist

Before final report, manually verify:

- Drawer opens as overlay and does not reflow the main Gantt.
- Drawer no longer has ugly/heavy outline.
- Problem/overload cells use calm issue styling, not scary borders.
- Task endpoint handles are hidden by default.
- Handles appear on hover/selected/link mode.
- Right→left creates FS.
- Left→left creates SS.
- Right→right creates FF.
- Left→right creates SF.
- Self dependency is blocked.
- Duplicate dependency is blocked.
- Cycle is blocked.
- Invalid dependency shows Russian validation message.
- Created dependency appears in predecessor cell and drawer.
- Visible UI is Russian.
- Internal contracts/types/actions are English.

---

# Tests

Run:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
```

Add/update tests for:

- endpoint pair → dependency type mapping;
- dependency creation validation;
- cycle detection;
- duplicate detection;
- hidden/collapsed row blocking;
- issue styling helper/class mapping if such helper exists.

---

# Final report format

Report:

1. Visual corrections implemented.
2. Dependency endpoint handle UX implemented.
3. Validation implemented.
4. Files changed.
5. Stories to review.
6. Tests/typecheck results.
7. Known remaining caveats.

Do not claim completion if endpoint-handle linking or cycle validation is missing.
