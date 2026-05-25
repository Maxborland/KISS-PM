# Cursor Prompt — Gantt Interaction Milestone 2

Context:

You are working in KISS PM design-v3 Storybook, current worktree:

```txt
E:\KISS-PM\.worktrees\design-v3-vh-split-pane
```

Target story:

```txt
views-screens--project-gantt
http://localhost:6006/iframe.html?id=views-screens--project-gantt
```

Relevant files:

```txt
apps/web/src/views/blocks/gantt-slice-block.tsx
apps/web/src/widgets/gantt/*
apps/web/src/styles/widgets/gantt.css
```

## Goal

Make the Gantt a real frontend-only interactive planning component, closer to MS Project Desktop behavior, but without backend implementation.

This is not a static mockup pass. Every enabled interaction must work on local controlled frontend state and/or emit a documented callback.

## Hard constraints

- Do not implement backend/API/database.
- Do not fake persistence.
- Do not replace the current Gantt with a third-party component.
- Preserve existing working interactions unless intentionally improved.
- Keep logic testable with pure helpers/reducer tests where practical.
- Storybook must demonstrate the behavior as executable UI contract.
- If something is not implemented in this milestone, disable the visible control or mark it as pending; do not leave enabled dead controls.

## Required milestone scope

### 1. Summary task collapse/expand must be real

Implement proper hiding/showing of child rows under summary tasks.

Requirements:

- Clicking the chevron on a summary row toggles `collapsed` state.
- Collapsed summary hides all descendant rows until the next sibling at same/higher level.
- Nested summary collapse must work.
- Chart rows must hide in perfect sync with WBS rows.
- Dependencies involving hidden rows should either:
  - be hidden, or
  - rerouted/aggregated only if simple and reliable.
  Prefer hiding hidden-row dependencies for this milestone.
- Summary rows must remain selectable.
- Collapse state must be local controlled frontend state.
- Add tests for visible-row calculation with nested hierarchy.

Acceptance:

- Collapse/expand visually changes row count in both table and chart.
- No row height desync.
- Dependency overlay does not draw arrows to invisible rows.

### 2. Replace bottom details panel with right slide-in task details drawer

Current bottom inspector is not enough. Implement a right-side slide-in drawer/panel for selected task details.

Requirements:

- Panel slides in from the right when a task is selected or when user opens details.
- Panel can be closed.
- It must not overlay the Gantt in a way that breaks usability; it should either:
  - dock/reserve width, or
  - overlay with clear backdrop-free panel and keep Gantt scrollable.
- Panel title: task name + WBS + status chip.
- Editable fields in the panel must update the same local Gantt state as grid cells.
- Fields:
  - name;
  - kind/type display: summary/task/milestone;
  - start date;
  - finish date;
  - duration;
  - progress;
  - predecessors/dependencies;
  - resources;
  - notes/description.
- Dirty state should be visible.
- Cancel/revert local panel edits if feasible; otherwise edits can commit on blur with undo support.
- Panel should share selection accent with selected row/bar.

Acceptance:

- Selecting row opens/updates details panel.
- Editing in panel updates grid/chart immediately.
- Closing panel leaves selection intact.
- No bottom inspector dead space remains unless intentionally used for status only.

### 3. Audit and upgrade all editable cells

Every editable cell must have the right editor, not just plain text.

Required cell editors:

#### Name
- Text input.
- Enter commits, Escape cancels.

#### Start / Finish dates
- Use date picker/popover if there is an existing date picker primitive in the project.
- If no mature date picker exists, implement a compact local date popover or native date input as temporary but styled consistently.
- Date edit updates start/duration/finish consistently on local state:
  - editing start keeps duration stable where possible;
  - editing finish changes duration;
  - milestone duration remains 0.
- Invalid dates show inline validation.

#### Duration
- Numeric input with days suffix.
- Must support `0d` only for milestones; tasks must be >= 1 day unless product model allows zero-duration tasks.

#### Progress
- Numeric input 0..100 or slider/spinbox.
- Progress bar updates immediately.

#### Resources
- Resource picker/popover/multi-select using mock resources.
- At minimum allow selecting one resource from fixture list.
- Show initials/name consistently in grid and details panel.

#### Predecessors / dependencies
- Use structured dependency editor, not only free text.
- Must support dependency type and lag/lead.

Acceptance:

- Double-click or Enter opens editor.
- Tab/Shift+Tab moves through editable cells where practical.
- Enter commits, Escape cancels.
- Invalid values do not silently mutate data.
- All editors are visible in Storybook.

### 4. Dependency model: all types + lead/lag

Expand frontend dependency support beyond simple FS.

Required dependency types:

- FS — Finish-to-Start
- SS — Start-to-Start
- FF — Finish-to-Finish
- SF — Start-to-Finish

Required lag/lead support:

- lag in days: `+2d`, `+1d`
- lead in days: `-2d`, `-1d`
- display examples:
  - `3FS+2d`
  - `4SS`
  - `8FF-1d`

Implementation requirements:

- Update `GanttDependency` type to include:
  - `type: "FS" | "SS" | "FF" | "SF"`
  - `lagDays?: number`
- Add parser/formatter helpers for predecessor strings.
- Add validation:
  - no self dependency;
  - no duplicate exact dependency;
  - unsupported text shows validation error;
  - cycle detection if already simple to implement; otherwise mark as future backend validation but prevent obvious self loops.
- Dependency overlay should render all four types reasonably:
  - FS: finish → start
  - SS: start → start
  - FF: finish → finish
  - SF: start → finish
- Lag/lead should visually offset target anchor by days if feasible; if not, it must at least display/parse/store correctly and mark visual lag rendering as follow-up.
- Link creation UI should allow selecting dependency type and lag/lead before/after drop, or default to FS and allow editing in details panel.

Acceptance:

- User can create/edit dependencies of all 4 types in frontend local state.
- Predecessor cell and details panel stay in sync.
- Existing FS overlay still works.
- Tests cover parse/format/validation for dependency strings.

### 5. Bars in the Gantt must be fully functional frontend-side

Task bars must not just look draggable; they must actually work.

Required bar interactions:

- Move task horizontally: changes start date, keeps duration.
- Resize from right edge: changes finish/duration.
- Resize from left edge: changes start and duration.
- Drag progress handle: changes progress percent.
- Move milestone horizontally: changes milestone date.
- Summary bars should not be directly edited unless explicitly supported; if not supported, handles must be hidden/disabled for summary rows.
- During drag/resize/progress, show clear preview/readout.
- Snap to day grid in day/week/month zoom.
- Escape cancels active operation if practical.
- Drop commits to local state and pushes undo snapshot.

Acceptance:

- Move/resize/progress operations are testable manually in Storybook.
- The chart and WBS cells update together.
- Undo/redo works after these operations.
- No handles are visible where operation is unsupported.

### 6. Stories to add/update

Add focused Storybook stories under `Widgets/Gantt` or equivalent:

```txt
Widgets/Gantt/CollapseSummaryRows
Widgets/Gantt/RightDetailsDrawer
Widgets/Gantt/DateCellEditing
Widgets/Gantt/ResourcePicker
Widgets/Gantt/DependencyTypesAndLag
Widgets/Gantt/BarMoveResizeProgress
Widgets/Gantt/InvalidCellValues
Widgets/Gantt/HiddenDependenciesOnCollapse
```

Also keep `Views/Screens/12 Project Gantt` as integrated full-screen demo.

Stories must use real components and local controlled state, not screenshots.

### 7. Tests

Add/update tests for pure logic:

- visible rows after nested collapse;
- date edit helpers;
- duration/progress validation;
- predecessor parse/format:
  - `3FS`
  - `3FS+2d`
  - `4SS-1d`
  - invalid strings;
- dependency validation:
  - self dependency;
  - duplicate dependency;
- bar move/resize reducer transitions;
- undo/redo after edit/drag if reducer-level support exists.

## Out of scope for this milestone

Do not implement:

- backend scheduling propagation;
- resource leveling;
- CPM recalculation;
- server conflicts;
- persistence/API integration;
- multi-user collaboration;
- import/export;
- full virtualization.

If a behavior depends on backend scheduling, show local frontend preview/status only and label it honestly.

## Visual quality requirements

- The right drawer must not make the Gantt feel cramped or broken at 1440x900.
- Editable cells must look editable on focus/hover, but not noisy at rest.
- Date/resource/dependency editors must feel like part of KISS PM design-v3.
- Dependency handles must not be visible all the time; show on hover/selected/link mode.
- Bar handles must be discoverable but not visually noisy.
- Collapse/expand chevrons and indentation must be readable.

## Verification

Run from repo root:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
```

Also manually verify in Storybook:

```txt
http://localhost:6006/iframe.html?id=views-screens--project-gantt
```

Manual checklist:

- Collapse a summary task: children disappear from WBS and chart.
- Re-expand: children return with row/chart alignment intact.
- Select a task: right details drawer opens.
- Edit name/date/duration/progress/resource in drawer: grid/chart updates.
- Edit same fields from grid: drawer updates.
- Create/edit dependencies FS/SS/FF/SF with lag/lead.
- Move task bar, resize right, resize left, change progress, move milestone.
- Undo/redo local changes.
- No dead enabled buttons in Gantt toolbar.

## Delivery report format

When done, report:

1. What was implemented.
2. What remains intentionally out of scope.
3. Files changed.
4. Tests/typecheck results.
5. Storybook stories to review.
6. Any known visual/UX caveats.
