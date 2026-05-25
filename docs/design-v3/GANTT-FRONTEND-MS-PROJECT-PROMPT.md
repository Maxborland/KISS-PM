# Prompt: KISS PM Gantt Frontend Interaction Contract (MS Project-style, no backend)

Use this prompt in Cursor/Codex for the frontend-only Gantt implementation.

---

You are working in the KISS PM repo, current worktree:

```txt
E:\KISS-PM\.worktrees\design-v3-vh-split-pane
```

## Goal

Implement a real interactive frontend Gantt UI contract inspired by Microsoft Project Desktop, but scoped to KISS PM and Storybook-first development.

This is **frontend only**:

- Do **not** implement backend endpoints.
- Do **not** modify API/server packages unless strictly required for frontend type compatibility.
- Do **not** pretend that backend scheduling exists.
- Use real React components, real frontend state, real interactions, real Storybook stories, mock/fixture data, and callback adapters.
- Backend/domain scheduling will be implemented separately by another agent.

Storybook must become an executable UI spec: it should show how the real frontend behaves for editing, dragging, selecting, dependencies, preview/apply states, and errors.

## Current relevant files

Start from the existing design-v3 Gantt implementation:

```txt
apps/web/src/views/blocks/gantt-slice-block.tsx
apps/web/src/widgets/gantt/gantt.tsx
apps/web/src/widgets/gantt/types.ts
apps/web/src/widgets/gantt/mock-data.ts
apps/web/src/widgets/gantt/gantt-dependency-paths.ts
apps/web/src/widgets/gantt/gantt-dependency-paths.test.ts
apps/web/src/styles/widgets/gantt.css
apps/web/src/views/screens/screens.stories.tsx

docs/design-v3/DESIGN_CONTRACT.md
docs/design-v3/V-H-PLANNING-PARITY-GAPS.md
docs/design-v3/SPEC-PLANNING-MUTATION.md
docs/design-v3/DEV-STAND.md
```

Existing Gantt already has:

- WBS table + horizontally scrollable chart split pane.
- Zoom modes.
- Summary/task/milestone rendering.
- Progress bars.
- Critical / at-risk / overdue visual states.
- FS dependency overlay mock.
- Selected row readout.
- Mock data and small dependency-path tests.

Build on top of that; do not replace it with a generic library or a fake throwaway demo.

## Product framing

We are not cloning MS Project completely. We need the frontend interaction surface that users expect from a desktop planning tool:

1. spreadsheet-like task grid;
2. WBS hierarchy editing;
3. timeline bars and milestones;
4. drag/resize interactions;
5. dependencies;
6. selection and task details;
7. preview/apply/error states for future backend scheduling;
8. Storybook coverage for all important UI states.

The UI must remain visually consistent with design-v3 tokens and existing KISS PM shell.

## Required frontend capabilities

### 1. Task grid / WBS table

Implement real frontend behavior for:

- Row selection by click.
- Keyboard navigation: Arrow keys, Tab/Shift+Tab, Enter to edit, Escape to cancel.
- Cell focus ring and selected-cell state.
- Inline editing for at least:
  - task name;
  - duration;
  - progress percent;
  - start date;
  - finish date;
  - predecessors text;
  - assigned resource initials/name.
- Edit lifecycle:
  - view mode;
  - edit mode;
  - dirty value;
  - commit;
  - cancel;
  - validation error.
- Local validation UI:
  - duration must be >= 0;
  - progress must be 0..100%;
  - milestone duration must remain 0;
  - invalid date strings show error state, not silent failure.
- Add task above/below selected row.
- Delete selected task with confirmation-like inline pending state or Storybook-controlled action.
- Indent/outdent task to change WBS hierarchy locally.
- Move row up/down locally.
- Expand/collapse summary rows.
- Recompute/display WBS numbers locally for fixture state when hierarchy changes.

Do not persist anything to backend. Expose callbacks like `onTaskEdit`, `onRowsReorder`, `onIndent`, etc., and use Storybook-local controlled state.

### 2. Timeline / chart rendering

Implement or refine:

- Synchronized row heights between table and chart.
- Today/current-date vertical line.
- Weekend/non-working-day shading.
- Summary task bars.
- Task bars with progress overlay.
- Milestones as diamonds.
- Critical path visual style.
- At-risk/overdue visual styles.
- Baseline bars as an optional overlay.
- Selected task visual state across table and chart.
- Hover state with minimal tooltip/readout.
- Horizontal scroll in chart while WBS table remains usable.
- Optional split-pane width control if small enough to implement safely; otherwise leave CSS clamp but document follow-up.

### 3. Drag interactions in chart

Implement frontend-local drag behavior for:

- Move task bar horizontally to change start date/day index.
- Resize task duration from right edge.
- Optional resize from left edge if simple and robust.
- Drag progress handle to change completion percent.
- Drag milestone horizontally.

Interaction requirements:

- During drag, show a preview ghost/overlay before commit.
- Snap movement to day cells for day/week/month zoom.
- Show readout: new start, finish, duration, delta.
- On drop, commit only to local controlled state and call callback.
- Escape cancels active drag if feasible.
- Do not implement real scheduling propagation; if a dependent task would normally move, show visual "preview only / scheduling engine pending" state instead.

### 4. Dependencies

Implement frontend UI contract for dependencies:

- Render dependencies as SVG overlay, routed around rows where possible.
- Support dependency types in types/UI model:
  - FS (Finish-to-Start) required;
  - SS, FF, SF can be type-compatible and visually listed, but may render with simple fallback if routing is not ready.
- Show dependency hover/selected state.
- Create dependency interaction:
  - user starts from task connector handle;
  - drags to another task;
  - preview line follows pointer;
  - drop creates local dependency.
- Delete selected dependency via toolbar/context action.
- Edit predecessor text cell and reflect it in local dependency list if practical; otherwise show validation/state and keep as follow-up.
- Local validation UI:
  - no self-dependency;
  - duplicate dependency warning;
  - cycle detection can be a pure frontend helper or shown as "backend validation pending" if not implemented.

No backend validation.

### 5. Task inspector / details pane

Add a right-side or bottom inspector story/state for selected task, similar to MS Project task details but KISS PM-styled:

- Task name.
- Dates/duration/progress.
- Type: summary/task/milestone.
- Predecessors/dependencies.
- Resources.
- Notes/description placeholder.
- Status chips: on-track / at-risk / overdue / critical.
- Dirty/pending/error presentation.

The inspector should edit the same local controlled state as the grid where reasonable.

### 6. Toolbar actions

Wire existing toolbar buttons to real frontend state where possible:

- Add task.
- Delete task.
- Indent/outdent.
- Move up/down.
- Link/unlink tasks.
- Toggle critical path visibility.
- Toggle baseline visibility.
- Toggle dependency visibility.
- Zoom segmented control.
- Filter/search placeholder state if not implementing full filtering.

Buttons must not be dead if they look active. If a button is not implemented, render it disabled with tooltip/title or remove it from the active story.

### 7. Preview/apply frontend states for future backend

Model the future backend mutation flow without implementing backend:

- `idle`
- `editing-local`
- `preview-pending`
- `preview-ready`
- `applying`
- `applied`
- `error`
- `conflict`

Use Storybook controls or dedicated stories to demonstrate these states.

Important: clearly label mocked preview/apply states as frontend contract only. Do not create fake API calls hidden in production code.

### 8. Undo/redo local UX

Implement simple local undo/redo if safe:

- keep previous local Gantt states in memory for Storybook/demo;
- support Ctrl+Z / Ctrl+Y or toolbar buttons;
- do not mix this with backend compensating undo from `SPEC-PLANNING-MUTATION.md`.

If this becomes too large, create types and stories for disabled/pending undo-redo states and document follow-up.

### 9. Storybook stories required

Add focused stories, not only one giant screen:

```txt
Views/Screens/12 Project Gantt                    # existing full screen
Widgets/Gantt/ReadOnly
Widgets/Gantt/CellEditing
Widgets/Gantt/ValidationError
Widgets/Gantt/DragMoveTask
Widgets/Gantt/ResizeDuration
Widgets/Gantt/DependencyCreate
Widgets/Gantt/DependencySelected
Widgets/Gantt/InspectorOpen
Widgets/Gantt/PreviewPending
Widgets/Gantt/PreviewReady
Widgets/Gantt/ErrorState
Widgets/Gantt/ConflictState
Widgets/Gantt/BaselineAndCriticalPath
Widgets/Gantt/CollapsedSummaryRows
```

Stories must use the real component and controlled local state, not screenshots or static HTML.

### 10. Accessibility / keyboard

Minimum acceptance:

- Grid/table has meaningful roles where practical.
- Cells/buttons have accessible labels.
- Keyboard navigation does not trap focus.
- Editing has visible focus states.
- Drag interactions have non-drag alternatives through inline editing.
- `aria-live` is used only for concise status changes, not noisy updates.

### 11. Testing requirements

Add unit tests for pure logic:

- WBS numbering after indent/outdent/reorder.
- Date/day-index calculations.
- Duration/progress validation.
- Dependency parsing/validation.
- Dependency path generation or routing where practical.
- Local reducer/state transitions for edit/drag/commit/cancel.

Do not over-test DOM details. Prefer pure functions for Gantt logic.

### 12. Visual acceptance

After implementation, run Storybook and capture evidence for at least:

- full `views-screens--project-gantt` at 1440x900;
- cell editing story;
- drag/resize story;
- dependency story;
- preview/error state story.

No critical visual blockers:

- no broken layout;
- no row/chart desync;
- no unreadable clipped chart at 1440px;
- no toolbar buttons that look enabled but do nothing;
- no mixed RU/EN labels in visible UI unless intentionally documented.

## Suggested implementation structure

Prefer splitting logic out of `gantt.tsx`:

```txt
apps/web/src/widgets/gantt/
  gantt.tsx
  types.ts
  mock-data.ts
  gantt-state.ts              # reducer / controlled-state helpers
  gantt-validation.ts         # pure validation helpers
  gantt-wbs.ts                # WBS numbering, indent/outdent, reorder
  gantt-dates.ts              # day/date/duration helpers
  gantt-dependencies.ts       # dependency parse/validate helpers
  gantt-dependency-paths.ts   # SVG path routing
  gantt-interactions.ts       # pointer/keyboard helpers if useful
  gantt.stories.tsx           # focused widget stories
```

Keep components small if possible:

```txt
Gantt
GanttToolbar
GanttGrid
GanttChart
GanttRow
GanttCell
GanttBar
DependencyOverlay
TaskInspector
GanttApplyBar
```

Use controlled props where possible:

```ts
type GanttProps = {
  data: GanttData;
  zoom?: GanttZoom;
  selectedRowId?: string;
  interactionMode?: "readonly" | "interactive";
  previewState?: GanttPreviewState;
  showDependencies?: boolean;
  showBaseline?: boolean;
  showCriticalPath?: boolean;
  onChange?: (next: GanttData, event: GanttChangeEvent) => void;
  onPreviewCommand?: (command: GanttFrontendCommand) => void;
  onApply?: () => void;
  onCancelPreview?: () => void;
};
```

Do not lock this exact API if a cleaner one emerges, but preserve the principle: real component, controlled state, no backend side effects.

## Out of scope

Do not implement:

- backend planning API;
- database schema;
- real multi-user conflict resolution;
- real scheduling engine / CPM propagation;
- resource leveling algorithm;
- import/export MPP/XML;
- printing/exporting PDF;
- full virtualization for thousands of rows unless needed for current fixture size.

## Acceptance commands

From repo root:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
```

If visual evidence is updated, document screenshot paths in `docs/design-review/evidence/` or in the relevant design-v3 checkpoint.

## Delivery format

When finished, report:

1. implemented frontend capabilities;
2. explicit non-implemented/follow-up items;
3. files changed;
4. tests run and results;
5. Storybook URLs/stories to review;
6. screenshots/evidence paths if captured.

Do not claim backend scheduling, persistence, or real API behavior.
