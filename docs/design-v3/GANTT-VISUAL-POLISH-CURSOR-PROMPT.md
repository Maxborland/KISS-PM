# Cursor Prompt — Gantt Visual Polish / Interaction Affordance Pass

Context:

You are working in KISS PM design-v3 Storybook, current worktree:

```txt
E:\KISS-PM\.worktrees\design-v3-vh-split-pane
```

The Gantt has real frontend interaction work now, but the visual/UX layer is still not good enough. This pass is **not** about adding backend behavior and **not** about adding new features. It is a focused design stabilization pass for Storybook/product UI quality.

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

## Hard constraints

- Do not implement backend/API/persistence.
- Do not add new product features.
- Do not replace the current Gantt implementation with a third-party component.
- Do not break existing interactions: cell edit, row selection, drag/resize, dependency handles, inspector, undo/redo, zoom.
- Keep Storybook as executable frontend contract: controls may use local state/mock callbacks.
- Use existing design-v3 tokens where possible.
- Prioritize visual clarity, hierarchy, scanability, and interaction affordances.

## Current audit summary

The current Gantt is functional enough, but visually still has problems:

- toolbar is noisy and hard to parse;
- selected row/bar/inspector do not feel like one selection system;
- chart grid and overlays compete with task bars;
- dependency lines are hard to scan;
- table and timeline headers feel cramped/misaligned;
- bottom inspector feels detached and sparse;
- primary actions compete;
- view toggles/critical path/undo-redo states are not clear enough;
- left WBS table is dense and some columns are visually cramped.

## P0 — must fix before merge

### 1. Rework toolbar hierarchy

Problem:
The toolbar is visually noisy. Icon groups, toggles, undo/redo, filter, and zoom compete equally.

Fix:
- Group controls clearly:
  - Edit: add/delete/indent/outdent/move
  - Links: link/unlink
  - View: critical path/baseline/dependencies/filter
  - History: undo/redo
  - Scale: hour/day/week/month
- Use separators/labels or strong grouping containers.
- Reduce equal visual weight between unrelated controls.
- Icon-only controls need hover/focus states and `title`/aria-label.
- Disabled controls must look clearly disabled; enabled controls must not look disabled.

### 2. Remove competing primary actions

Problem:
Page-level `Save` and other actions compete visually; it is unclear what the primary action is.

Fix:
- Keep `Save` as the only contextual primary action.
- If there are no dirty local changes, Save should be neutral/disabled or clearly "mock/local".
- Keep create/add task in the Gantt toolbar as a local edit action, not as competing page primary.

### 3. Unify selected state

Problem:
Selected WBS row, selected chart bar, and inspector are visually disconnected.

Fix:
- Use one accent system for selected row + selected bar + inspector top border/header.
- Do not introduce unrelated yellow/blue/red selection colors.
- Selected row should be visible but not overpower chart bars.
- Selected chart bar should be clearly selected without looking like warning/error.
- Inspector should show the same selected accent and selected task name prominently.

### 4. Improve chart readability

Problem:
Grid lines, row backgrounds, selection fills, today line, dependency lines, and bars compete.

Fix:
- Make background grid lighter and more consistent.
- Make task bars more legible than grid/overlays.
- Today line should be subtle but visible; avoid heavy red dominance.
- Weekend/non-working days can be lightly shaded, but not noisy.
- Summary bars, task bars, milestones, critical path, baseline must have clear semantics.

### 5. Dependency lines must be readable

Problem:
Connectors are either too faint or visually messy.

Fix:
- Set dependency line stroke so it is readable against grid but still below bars.
- Use consistent arrowheads.
- Keep selected dependency visibly highlighted.
- Avoid dependency handles being visible all the time; show on hover/selected/link mode.
- Ensure dependency overlay z-index: above grid/background, below active/selected bars.

### 6. Align table and timeline headers

Problem:
Left table header and timeline header feel cramped and slightly detached.

Fix:
- Ensure header row heights match exactly between WBS and chart.
- Align typography baseline/vertical centering.
- Improve day header readability.
- Add weekly separators or subtle weekend cues if it improves scanning.

### 7. Redesign bottom inspector as a real selected-task panel

Problem:
Bottom panel feels detached and sparse.

Fix:
- Make inspector compact and clearly tied to current selected task.
- Use a stronger title row: task name + WBS + status chip.
- Use 2-3 column property grid depending on width.
- Reduce empty whitespace.
- Place local/mock warning/status in a less dominant location; it should not steal focus from task properties.
- Inspector should be visually connected to selected row/bar via accent border/background.

## P1 — high priority polish

### 8. Normalize typography

- Page title, toolbar labels, table headers, stat labels, inspector labels should follow a consistent scale.
- Avoid tiny/light text for important planning controls.
- Table headers should be readable, not compressed into noise.

### 9. Convert KPI strip into structured stat items

Problem:
`SPI / CPI / Progress / Tasks` reads like loose text.

Fix:
- Use compact stat chips/cards with label + value.
- Use spacing/dividers for scanability.
- Keep it visually quieter than the Gantt grid but stronger than incidental text.

### 10. Improve WBS grid density

- Short columns (`#`, mode, WBS, duration, progress) should be compact and aligned.
- Numeric/date columns should be right/center aligned consistently.
- Task name column should get enough width and visual priority.
- Repeated `AUTO` badges should be toned down; they currently create noise.

### 11. Define task bar color semantics

Create a stricter visual system:

- summary = dark/blue structural bar;
- normal task = green or neutral production color;
- critical = same task family + red accent/stripe, not a totally separate warning block;
- at-risk = amber accent but readable;
- overdue = red accent but not huge error block;
- milestone = diamond aligned with the same color semantics;
- baseline = thin muted line under/behind the main task;
- selected = consistent accent halo/border.

### 12. Make toggles legible

- Critical path / Baseline / Dependencies should read as toggles.
- Active state should be obvious.
- Zoom segmented selected value should be obvious.
- Undo/redo should clearly communicate enabled vs disabled.

## P2 — medium priority

- Strengthen tree affordances: chevrons, indentation guides, summary row weight.
- Reduce excessive borders; use spacing/background shifts instead.
- Add or improve hover/focus/active states for icon-only controls.
- Ensure chart scroll/overflow does not make right-edge bars look broken.
- Make left sidebar active state clearer if touched by global CSS, but do not spend much time there.

## Acceptance criteria

After the pass:

1. At 1440x900, `views-screens--project-gantt` should look like a coherent Gantt product screen, not a prototype assembled from separate blocks.
2. Selected row, selected bar, and inspector must visibly belong together.
3. Chart bars must be more visually prominent than grid/dependency/today overlays.
4. Dependency lines must be readable but not overpowering.
5. Toolbar must be understandable at a glance.
6. Bottom inspector must feel like a deliberate docked panel, not leftover whitespace.
7. No enabled-looking dead controls in the Gantt toolbar.
8. No backend/API changes.

## Verification

Run:

```bash
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
```

Capture/review screenshot:

```txt
http://localhost:6006/iframe.html?id=views-screens--project-gantt
viewport 1440x900
```

Report:

- What visual issues were fixed.
- Any remaining known polish issues.
- Tests/typecheck results.
- Screenshot path if captured.
