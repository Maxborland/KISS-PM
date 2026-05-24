# BR2 Gantt File-Level Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** перенести кастомный BR2 Gantt renderer в KISS PM как управляемый UI package для Phase 7 planning workspace, не перенося BR2 scheduling/resource authority.

**Architecture:** BR2 `packages/gantt-react` используется как исходный UI asset. KISS PM создает собственный `packages/planning-gantt-ui` с normalized view model и UI intents; backend Phase 5/6 planning engine остается единственным source of truth. BR2 `gantt-core/scheduling`, `gantt-core/planning` и `gantt-bitrix-preset` остаются в quarantine и не импортируются runtime-кодом KISS PM.

**Tech Stack:** React 19, Next.js 16, pnpm workspaces, TypeScript, CSS modules or KISS PM CSS tokens, `@dnd-kit/core`, `@tanstack/react-table`, `@tanstack/react-virtual`, KISS PM/Radix/shadcn controls, Vitest, Playwright smoke.

---

## Product Intent

- Problem: Phase 7 UI needs a real MS Project-like Gantt/WBS workspace, and BR2 already has a custom Gantt renderer that should not be recreated from zero.
- User / role: project manager, resource manager, delivery lead.
- Customer need: create and inspect a reliable project schedule with dependencies, baseline, critical path and resource conflict context without divergence from backend planning engine.
- Business value: faster Phase 7 delivery while avoiding the old BR2 coupling to Bitrix routes, roles and local scheduling authority.
- Promised path: open project planning workspace -> see read model -> interact with WBS/Gantt -> preview command -> apply command -> reload authoritative read model -> audit.
- Non-goals: import/export; copying BR2 Bitrix preset; using BR2 scheduling/resource planning as authority; implementing collaboration in v1; replacing Phase 5/6 backend engine.

## Compact Spec

### Scope

Create a file-level extraction and implementation path for:

- Gantt timeline renderer;
- bars, summary bars, milestones and baseline overlay;
- dependency arrows for FS/SS/FF/SF;
- split WBS/timeline layout;
- WBS grid based on TanStack Table + TanStack Virtual;
- KISS PM planning read-model adapter;
- command-intent bridge to `PlanningCommand`;
- package guard tests that prevent quarantined BR2 modules from leaking in.

### Acceptance Criteria

1. Plan identifies every relevant file under `E:\BitrixReports2.0\packages\gantt-react\src` and assigns it to `copy/adapt`, `rewrite`, `host-app`, `quarantine`, or `drop`.
2. Plan explicitly blocks runtime imports from BR2 `gantt-core/scheduling`, `gantt-core/planning` and `gantt-bitrix-preset`.
3. Plan defines target KISS PM files and package boundaries before code extraction.
4. Plan maps Gantt/WBS interactions to `PlanningCommand` preview/apply.
5. Plan includes verification commands and expected outputs.
6. Plan includes rollback and review checkpoints.

### Edge / Failure Behavior

- If BR2 UI helper depends on `@gungantt/core/scheduling` or `@gungantt/core/planning`, copy is rejected until the dependency is removed or downgraded to a local pure display helper.
- If a copied component applies state directly instead of emitting a command intent, the component remains in quarantine.
- If Ant Design dependency appears in `packages/planning-gantt-ui`, the extraction fails; replace with KISS PM/Radix/shadcn controls or host-provided renderers.
- If WBS order conflicts with backend `wbsCode`/`task.move_wbs`, backend order wins after preview/apply reload.

## Source Inventory

### BR2 source root

```txt
E:\BitrixReports2.0\packages\gantt-react\src
```

### Target KISS PM root

```txt
packages/planning-gantt-ui
apps/web/src/planning
```

### File-Level Extraction Matrix

| BR2 source file | Target | Action | Notes |
|---|---|---|---|
| `components/GanttBar.tsx` | `packages/planning-gantt-ui/src/components/timeline/GanttBar.tsx` | copy/adapt | Keep SVG bar rendering, milestone, summary and baseline overlay. Replace `GanttTask` with `PlanningGanttTaskRow`. Use KISS PM theme tokens. |
| `components/GanttDependencyArrows.tsx` | `packages/planning-gantt-ui/src/components/timeline/GanttDependencyArrows.tsx` | copy/adapt | Keep FS/SS/FF/SF path rendering. Add lag/lead label hook through required props in the same extraction task. |
| `components/GanttTimelineHeader.tsx` | `packages/planning-gantt-ui/src/components/timeline/GanttTimelineHeader.tsx` | copy/adapt | Keep two-tier header. Replace date helpers with local display helpers copied from safe `ganttDateUtils` subset. |
| `components/GanttTimeline.tsx` | `packages/planning-gantt-ui/src/components/timeline/GanttTimeline.tsx` | rewrite/adapt | Remove `@gungantt/core` imports and `useCollabSession`. Replace `updateTask` with `onIntent({ type: "task.schedule.drag" })`. Keep scroll, visible rows, bars, arrows, today line and weekend/non-working shading. |
| `components/GanttLegend.tsx` | `packages/planning-gantt-ui/src/components/GanttLegend.tsx` | copy/adapt | Keep labels, but drive visibility from KISS PM features. |
| `components/SplitView.tsx` | `packages/planning-gantt-ui/src/components/SplitView.tsx` | copy/adapt | Keep resizable split. Replace title text with accessible `aria-label`. |
| `components/gantt.module.css` | `packages/planning-gantt-ui/src/components/planning-gantt.module.css` | copy/adapt | Rename classes only if needed. Replace raw BR2 colors with CSS variables from KISS PM tokens. |
| `theme/defaultTheme.ts` | `packages/planning-gantt-ui/src/theme/defaultTheme.ts` | rewrite/adapt | Keep token names if useful. Values should point to KISS PM CSS variables or neutral fallbacks. |
| `components/TaskGrid.tsx` | `packages/planning-gantt-ui/src/components/wbs/WbsGrid.tsx` | rewrite with reference | Use TanStack Table + TanStack Virtual + dnd-kit. Do not copy BR2 store shape, role permissions, collaboration locks or context menu semantics. |
| `components/GanttGrid.tsx` | `packages/planning-gantt-ui/src/components/wbs/index.ts` | drop/replace | BR2 alias only. Export KISS PM `WbsGrid`. |
| `components/GanttToolbar.tsx` | `apps/web/src/planning/PlanningToolbar.tsx` | host-app rewrite | Toolbar is product workflow. Use lucide icons/Radix menus, KISS PM permission reasons and preview/apply states. |
| `components/GanttEditor.tsx` | `packages/planning-gantt-ui/src/components/PlanningGanttSurface.tsx` | rewrite | BR2 file is placeholder shell. Create real controlled surface composing `SplitView`, `WbsGrid`, `GanttTimeline`. |
| `components/editors/EditableCell.tsx` | `packages/planning-gantt-ui/src/components/wbs/EditableCell.tsx` | copy/adapt | Keep controlled edit lifecycle, remove AntD assumptions. |
| `components/editors/GanttEditorsHostContext.tsx` | `packages/planning-gantt-ui/src/components/wbs/editorHost.tsx` | copy/adapt | Keep host-provided editor registry pattern if it remains simple. |
| `components/editors/TextEditor.tsx` | `apps/web/src/planning/editors/TextEditor.tsx` | host-app rewrite | Use KISS PM input primitive. |
| `components/editors/DateEditor.tsx` | `apps/web/src/planning/editors/DateEditor.tsx` | host-app rewrite | Replace AntD DatePicker with KISS PM date field or `react-day-picker` wrapper. |
| `components/editors/DurationEditor.tsx` | `apps/web/src/planning/editors/DurationEditor.tsx` | host-app rewrite | Keep duration parsing behavior only if backed by backend preview. |
| `components/editors/NumberEditor.tsx` | `apps/web/src/planning/editors/NumberEditor.tsx` | host-app rewrite | Use numeric input with min/max validation matching command parser. |
| `components/editors/ModeToggle.tsx` | `apps/web/src/planning/editors/ModeToggle.tsx` | host-app rewrite | Replace AntD Segmented with KISS PM segmented control. |
| `components/editors/PredecessorEditor.tsx` | `apps/web/src/planning/editors/PredecessorEditor.tsx` | host-app rewrite | Keep Russian labels ОН/НН/ОО/НО, emit `dependency.upsert/delete` intents. |
| `components/editors/ResourceEditor.tsx` | `apps/web/src/planning/editors/ResourceEditor.tsx` | host-app rewrite | Use KISS PM resource list from read model, emit `assignment.upsert/delete`. |
| `components/editors/ConstraintEditor.tsx` | `apps/web/src/planning/editors/ConstraintEditor.tsx` | host-app rewrite | Map to KISS PM constraint ids: `as_soon_as_possible`, `start_no_earlier_than`, `finish_no_later_than`, `must_start_on`, `must_finish_on`. |
| `components/editors/index.ts` | `apps/web/src/planning/editors/index.ts` | rewrite | Export only KISS PM editors. |
| `components/CommandPalette.tsx` | `apps/web/src/planning/PlanningCommandPalette.tsx` | optional host-app | Defer unless Phase 7 UI-A includes command palette. |
| `components/ConflictCenterPanel.tsx` | `apps/web/src/planning/PlanningValidationPanel.tsx` | host-app rewrite | Use backend `validationIssues`, not BR2 conflict state. |
| `components/ResourceConflictBadge.tsx` | `apps/web/src/planning/resources/ResourceConflictBadge.tsx` | host-app rewrite | Use backend `resourceLoad.overloads`. |
| `components/ResourceConflictPanel.tsx` | `apps/web/src/planning/resources/ResourceConflictPanel.tsx` | host-app rewrite | Use backend overload reasons and scenario target. |
| `components/ResourceConflictPopover.tsx` | `apps/web/src/planning/resources/ResourceConflictPopover.tsx` | host-app rewrite | Use Radix popover. |
| `components/ScenarioSwitcher.tsx` | `apps/web/src/planning/scenarios/ScenarioSwitcher.tsx` | host-app rewrite | Use backend `ScenarioProposal`. |
| `components/RiskHeatmapLegend.tsx` | `apps/web/src/planning/scenarios/RiskHeatmapLegend.tsx` | optional host-app | Keep concept, rewrite labels/tokens. |
| `components/PresenceLayer.tsx` | none for v1 | quarantine | Collaboration is out of first extraction. |
| `hooks/useCollabSession.ts` | none for v1 | quarantine | Keep for future collaboration review only. |
| `hooks/useConflictCenter.ts` | none for v1 | quarantine | Backend validation panel replaces it. |
| `hooks/useResourceConflicts.ts` | none for v1 | quarantine | Backend `resourceLoad` replaces it. |
| `hooks/index.ts` | `packages/planning-gantt-ui/src/index.ts` | rewrite | Export only allowed hooks/components. |
| `slots/types.ts` | `packages/planning-gantt-ui/src/slots/types.ts` | copy/adapt | Keep slot pattern for toolbar/editor overrides. |
| `types/permissions.ts` | `packages/planning-gantt-ui/src/types/capabilities.ts` | rewrite | Replace BR2 role permissions with KISS PM planning capabilities. |
| `types/css-modules.d.ts` | `packages/planning-gantt-ui/src/types/css-modules.d.ts` | copy | Keep if CSS modules are used. |
| `index.ts` | `packages/planning-gantt-ui/src/index.ts` | rewrite | Export only KISS PM-safe public API. |
| `*.test.tsx` | `packages/planning-gantt-ui/src/**/*.test.tsx` or `apps/web/src/planning/**/*.test.tsx` | adapt selectively | Keep tests for bars, arrows, timeline, split, WBS grid. Rewrite assertions around KISS PM intents. |

## Safe BR2 Core Subset

Allowed to copy/adapt from `E:\BitrixReports2.0\packages\gantt-core\src`:

| BR2 source file | Target | Action | Notes |
|---|---|---|---|
| `utils/ganttDateUtils.ts` | `packages/planning-gantt-ui/src/lib/timelineScale.ts` | copy/adapt | Keep `getDayWidth`, `dateToX`, `xToDate`, `getProjectDateRange`, `generateTimelineTiers`, `getTimelineWidth`. Remove global `dayjs.locale` side effect if possible. |
| `utils/ganttUtils.ts` | `packages/planning-gantt-ui/src/lib/displayFormat.ts` and `packages/planning-gantt-ui/src/lib/treeRows.ts` | partial copy/adapt | Keep display parse/format helpers and flattening. Do not compute authoritative WBS if backend WBS is present; local WBS is display fallback only. |
| `config/features.ts` | `packages/planning-gantt-ui/src/types/features.ts` | copy/adapt | Keep feature/capability split. Rename `autoscheduling` to command preview language if needed. |
| `types.ts` | `packages/planning-gantt-ui/src/types/viewModel.ts` | partial rewrite | Use as reference only. KISS PM types must match Phase 5/6 read model and commands. |

Quarantined from runtime imports:

```txt
E:\BitrixReports2.0\packages\gantt-core\src\scheduling\*
E:\BitrixReports2.0\packages\gantt-core\src\planning\*
E:\BitrixReports2.0\packages\gantt-bitrix-preset\*
```

## Target File Structure

Create:

```txt
packages/planning-gantt-ui/package.json
packages/planning-gantt-ui/tsconfig.json
packages/planning-gantt-ui/src/index.ts
packages/planning-gantt-ui/src/types/viewModel.ts
packages/planning-gantt-ui/src/types/intents.ts
packages/planning-gantt-ui/src/types/features.ts
packages/planning-gantt-ui/src/types/capabilities.ts
packages/planning-gantt-ui/src/lib/timelineScale.ts
packages/planning-gantt-ui/src/lib/displayFormat.ts
packages/planning-gantt-ui/src/lib/treeRows.ts
packages/planning-gantt-ui/src/components/PlanningGanttSurface.tsx
packages/planning-gantt-ui/src/components/SplitView.tsx
packages/planning-gantt-ui/src/components/GanttLegend.tsx
packages/planning-gantt-ui/src/components/planning-gantt.module.css
packages/planning-gantt-ui/src/components/timeline/GanttTimeline.tsx
packages/planning-gantt-ui/src/components/timeline/GanttTimelineHeader.tsx
packages/planning-gantt-ui/src/components/timeline/GanttBar.tsx
packages/planning-gantt-ui/src/components/timeline/GanttDependencyArrows.tsx
packages/planning-gantt-ui/src/components/wbs/WbsGrid.tsx
packages/planning-gantt-ui/src/components/wbs/EditableCell.tsx
packages/planning-gantt-ui/src/components/wbs/editorHost.tsx
packages/planning-gantt-ui/src/slots/types.ts
packages/planning-gantt-ui/src/**/*.test.tsx
apps/web/src/planning/planningReadModelMapper.ts
apps/web/src/planning/planningCommandIntentMapper.ts
apps/web/src/planning/PlanningToolbar.tsx
apps/web/src/planning/PlanningValidationPanel.tsx
apps/web/src/planning/editors/*.tsx
```

Modify:

```txt
package.json
pnpm-workspace.yaml
apps/web/package.json
apps/web/next.config.ts
tsconfig.json or tsconfig references if needed
docs/31_PHASE_7_PLANNING_WORKSPACE_UI_CONTRACT.md
```

## Domain Mapping

### View Model

`PlanningGanttTaskRow` should be derived from KISS PM `planning/read-model`:

```ts
export type PlanningGanttTaskRow = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  title: string;
  statusId: string;
  schedulingMode: "auto" | "manual";
  taskType: "fixed_units" | "fixed_work" | "fixed_duration";
  effortDriven: boolean;
  plannedStart: string | null;
  plannedFinish: string | null;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  baselineStart: string | null;
  baselineFinish: string | null;
  isSummary: boolean;
  isCritical: boolean;
  slackMinutes: number | null;
  validationIssueIds: string[];
};
```

### Intent Model

All user interactions emit intents:

```ts
export type PlanningGanttIntent =
  | { type: "task.create"; parentTaskId: string | null; insertAfterTaskId: string | null }
  | { type: "task.rename"; taskId: string; title: string }
  | { type: "task.schedule.drag"; taskId: string; plannedStart: string | null; plannedFinish: string | null }
  | { type: "task.work_model.edit"; taskId: string; durationMinutes: number | null; workMinutes: number; taskType: "fixed_units" | "fixed_work" | "fixed_duration"; effortDriven: boolean }
  | { type: "task.move_wbs"; taskId: string; parentTaskId: string | null; sortOrder: number }
  | { type: "dependency.upsert"; id: string; predecessorTaskId: string; successorTaskId: string; dependencyType: "FS" | "SS" | "FF" | "SF"; lagMinutes: number }
  | { type: "dependency.delete"; dependencyId: string }
  | { type: "assignment.upsert"; id: string; taskId: string; resourceId: string; unitsPermille: number; workMinutes: number | null }
  | { type: "baseline.capture"; label: string };
```

`apps/web/src/planning/planningCommandIntentMapper.ts` maps these intents to Phase 5/6 `PlanningCommand`.

## Implementation Tasks

### Task 1: Package Scaffold And Dependency Boundary

**Files:**

- Create: `packages/planning-gantt-ui/package.json`
- Create: `packages/planning-gantt-ui/tsconfig.json`
- Create: `packages/planning-gantt-ui/src/index.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add workspace package scaffold**

Create `packages/planning-gantt-ui/package.json` with package name `@kiss-pm/planning-gantt-ui`, peer deps `react` and `react-dom`, dependencies `@dnd-kit/core`, `@tanstack/react-table`, `@tanstack/react-virtual`, `dayjs` only if `date-fns` is not enough. Do not add `antd`.

- [ ] **Step 2: Wire workspace**

Add package to `pnpm-workspace.yaml` if packages are not already covered by `packages/*`. Add `@kiss-pm/planning-gantt-ui: workspace:*` to `apps/web/package.json`.

- [ ] **Step 3: Configure Next transpilation**

If Next does not already transpile workspace packages, set `transpilePackages: ["@kiss-pm/planning-gantt-ui"]` in `apps/web/next.config.ts`.

- [ ] **Step 4: Add quarantine guard test**

Create a test that scans `packages/planning-gantt-ui/src` and fails on these strings:

```txt
@gungantt/core
gantt-core/src/scheduling
gantt-core/src/planning
gantt-bitrix-preset
antd
```

Expected command:

```bash
pnpm vitest run packages/planning-gantt-ui/src/packageBoundary.test.ts
```

Expected output: test passes and reports zero forbidden imports.

### Task 2: Types, Features, Capabilities And View Model

**Files:**

- Create: `packages/planning-gantt-ui/src/types/viewModel.ts`
- Create: `packages/planning-gantt-ui/src/types/intents.ts`
- Create: `packages/planning-gantt-ui/src/types/features.ts`
- Create: `packages/planning-gantt-ui/src/types/capabilities.ts`
- Modify: `packages/planning-gantt-ui/src/index.ts`

- [ ] **Step 1: Define KISS PM-native view types**

Implement `PlanningGanttTaskRow`, `PlanningGanttDependencyRow`, `PlanningGanttBaselineRow`, `PlanningGanttValidationIssue`, `PlanningGanttViewModel`.

- [ ] **Step 2: Define intents**

Implement `PlanningGanttIntent` exactly around Phase 5/6 commands. Do not include save/batch endpoints from BR2.

- [ ] **Step 3: Define feature and capability flags**

Use `features` for visual subsystems and `capabilities` for permissions. Keep names close to Phase 5/6 permission model:

```ts
canReadPlan
canManagePlan
canManageBaseline
canReadResources
canManageResources
canPreviewScenarios
canApplyScenarios
```

- [ ] **Step 4: Export public types**

`src/index.ts` exports only KISS PM types and allowed components.

### Task 3: Timeline Utilities From Safe Core Subset

**Files:**

- Create: `packages/planning-gantt-ui/src/lib/timelineScale.ts`
- Create: `packages/planning-gantt-ui/src/lib/displayFormat.ts`
- Create: `packages/planning-gantt-ui/src/lib/treeRows.ts`
- Test: `packages/planning-gantt-ui/src/lib/timelineScale.test.ts`
- Test: `packages/planning-gantt-ui/src/lib/displayFormat.test.ts`
- Test: `packages/planning-gantt-ui/src/lib/treeRows.test.ts`

- [ ] **Step 1: Copy/adapt `ganttDateUtils` display helpers**

Port `getDayWidth`, `dateToX`, `xToDate`, `getProjectDateRange`, `generateTimelineTiers`, `getTimelineWidth`. Preserve behavior, remove global locale side effect if possible.

- [ ] **Step 2: Port predecessor display helpers**

Port Russian dependency label parsing/formatting: ОН->FS, НН->SS, ОО->FF, НО->SF. Convert lag to minutes at mapper boundary.

- [ ] **Step 3: Port tree flattening**

Port `flattenTree` and row map helpers against `PlanningGanttTaskRow`. Display WBS from backend `wbsCode`; local compute is fallback only for draft rows before preview returns.

- [ ] **Step 4: Verify utility tests**

Run:

```bash
pnpm vitest run packages/planning-gantt-ui/src/lib
```

Expected: all utility tests pass.

### Task 4: Timeline Renderer Extraction

**Files:**

- Create/adapt: `packages/planning-gantt-ui/src/components/timeline/GanttBar.tsx`
- Create/adapt: `packages/planning-gantt-ui/src/components/timeline/GanttDependencyArrows.tsx`
- Create/adapt: `packages/planning-gantt-ui/src/components/timeline/GanttTimelineHeader.tsx`
- Create/adapt: `packages/planning-gantt-ui/src/components/timeline/GanttTimeline.tsx`
- Create/adapt: `packages/planning-gantt-ui/src/components/planning-gantt.module.css`
- Test: `packages/planning-gantt-ui/src/components/timeline/*.test.tsx`

- [ ] **Step 1: Port `GanttBar`**

Keep BR2 SVG shapes for normal task, summary task, milestone and baseline. Replace `GanttTask` props with `PlanningGanttTaskRow`.

- [ ] **Step 2: Port `GanttDependencyArrows`**

Keep path calculation for FS/SS/FF/SF. Use string task ids. Critical coloring comes from `isCritical`.

- [ ] **Step 3: Port `GanttTimelineHeader`**

Use `generateTimelineTiers`. Keep month/day/week/month labels in Russian.

- [ ] **Step 4: Rewrite `GanttTimeline`**

Remove BR2 store dependency and accept controlled props:

```ts
rows: PlanningGanttTaskRow[];
dependencies: PlanningGanttDependencyRow[];
features: PlanningGanttFeatures;
capabilities: PlanningGanttCapabilities;
onIntent: (intent: PlanningGanttIntent) => void;
```

Dragging/resizing emits intent and does not update canonical state locally.

- [ ] **Step 5: Verify timeline tests**

Run:

```bash
pnpm vitest run packages/planning-gantt-ui/src/components/timeline
```

Expected: bars render, dependency paths render, drag emits intent, no direct schedule mutation.

### Task 5: WBS Grid Extraction

**Files:**

- Create: `packages/planning-gantt-ui/src/components/wbs/WbsGrid.tsx`
- Create/adapt: `packages/planning-gantt-ui/src/components/wbs/EditableCell.tsx`
- Create/adapt: `packages/planning-gantt-ui/src/components/wbs/editorHost.tsx`
- Test: `packages/planning-gantt-ui/src/components/wbs/WbsGrid.test.tsx`

- [ ] **Step 1: Rebuild `TaskGrid` as `WbsGrid`**

Use BR2 `TaskGrid.tsx` as reference, but implement KISS PM props:

```ts
rows: PlanningGanttTaskRow[];
columns: WbsColumnDefinition[];
selectedTaskIds: Set<string>;
collapsedTaskIds: Set<string>;
onIntent: (intent: PlanningGanttIntent) => void;
```

- [ ] **Step 2: Keep TanStack Table + Virtual**

Use `@tanstack/react-table` for columns/sizing and `@tanstack/react-virtual` for rows. Keep `@dnd-kit/core` only for row reorder intent.

- [ ] **Step 3: Remove BR2 permission/store assumptions**

No `RolePermissions`, no `currentUserId`, no BR2 collaboration locks, no BR2 context actions. Disabled state comes from KISS PM capabilities and host-provided reasons.

- [ ] **Step 4: Verify WBS tests**

Run:

```bash
pnpm vitest run packages/planning-gantt-ui/src/components/wbs
```

Expected: visible rows virtualize, columns resize, row reorder emits `task.move_wbs`, inline edit emits intent, no direct apply.

### Task 6: Host Planning Adapters

**Files:**

- Create: `apps/web/src/planning/planningReadModelMapper.ts`
- Create: `apps/web/src/planning/planningCommandIntentMapper.ts`
- Test: `apps/web/src/planning/planningReadModelMapper.test.ts`
- Test: `apps/web/src/planning/planningCommandIntentMapper.test.ts`

- [ ] **Step 1: Map read model to view model**

Use `project`, `authored`, `calculatedPlan`, `baselineComparison`, `resourceLoad`, `validationIssues`, `planVersion`, `engineVersion`.

- [ ] **Step 2: Map intents to commands**

Map every `PlanningGanttIntent` to Phase 5/6 `PlanningCommand`. Include `planVersion` at apply boundary.

- [ ] **Step 3: Preserve backend authority**

Mapper must not call local scheduling/resource functions. It only transforms shapes.

- [ ] **Step 4: Verify mapper tests**

Run:

```bash
pnpm vitest run apps/web/src/planning/planningReadModelMapper.test.ts apps/web/src/planning/planningCommandIntentMapper.test.ts
```

Expected: all mappings match Phase 5/6 command names and payload keys.

### Task 7: Host Editors And Toolbar

**Files:**

- Create: `apps/web/src/planning/PlanningToolbar.tsx`
- Create: `apps/web/src/planning/editors/TextEditor.tsx`
- Create: `apps/web/src/planning/editors/DateEditor.tsx`
- Create: `apps/web/src/planning/editors/DurationEditor.tsx`
- Create: `apps/web/src/planning/editors/NumberEditor.tsx`
- Create: `apps/web/src/planning/editors/ModeToggle.tsx`
- Create: `apps/web/src/planning/editors/PredecessorEditor.tsx`
- Create: `apps/web/src/planning/editors/ResourceEditor.tsx`
- Create: `apps/web/src/planning/editors/ConstraintEditor.tsx`
- Test: `apps/web/src/planning/editors/*.test.tsx`

- [ ] **Step 1: Replace AntD editors**

Use existing KISS PM/Radix/shadcn controls. No `antd` imports.

- [ ] **Step 2: Toolbar emits product actions**

Toolbar buttons emit preview/apply-ready actions or open host panels. Buttons are disabled with reasons when capability is missing.

- [ ] **Step 3: Verify editor tests**

Run:

```bash
pnpm vitest run apps/web/src/planning/editors
```

Expected: editors emit intents and show validation/disabled state.

### Task 8: Planning Surface Integration

**Files:**

- Create: `apps/web/src/planning/PlanningWorkspaceRoute.tsx` or integrate with existing project route.
- Create: `apps/web/src/planning/PlanningValidationPanel.tsx`
- Create: `apps/web/src/planning/PlanningPreviewApplyBar.tsx`
- Modify: route registration file used by `apps/web`.
- Test: `apps/web/src/planning/PlanningWorkspaceRoute.test.tsx`

- [ ] **Step 1: Load backend read model**

Use existing query pattern to call:

```txt
GET /api/workspace/projects/:projectId/planning/read-model
```

- [ ] **Step 2: Render controlled Gantt surface**

Pass mapped view model into `PlanningGanttSurface`.

- [ ] **Step 3: Preview/apply loop**

On intent, call preview endpoint; show before/after/validation; apply only through apply endpoint.

- [ ] **Step 4: Verify route test**

Run:

```bash
pnpm vitest run apps/web/src/planning/PlanningWorkspaceRoute.test.tsx
```

Expected: intent triggers preview request, apply reloads read model, stale plan version shows conflict state.

### Task 9: Browser Smoke And Guards

**Files:**

- Create: `playwright/planning-gantt-smoke.spec.ts` or existing E2E location.
- Create: `packages/planning-gantt-ui/src/packageBoundary.test.ts`
- Modify: relevant npm/pnpm scripts if needed.

- [ ] **Step 1: Add smoke scenario**

Seed project with at least 12 tasks, hierarchy, FS/SS/FF/SF dependencies, baseline, assignments and one overload.

- [ ] **Step 2: Verify row sync**

Browser smoke must assert WBS row, Gantt bar and validation marker refer to the same task id after scroll/collapse.

- [ ] **Step 3: Verify command preview**

Drag one bar, assert preview request is made and UI does not mutate canonical row until backend response.

- [ ] **Step 4: Run full checks**

Run:

```bash
pnpm typecheck
pnpm vitest run packages/planning-gantt-ui apps/web/src/planning
pnpm test:e2e:smoke
```

Expected: typecheck exit 0, unit tests exit 0, smoke exit 0.

## Review Checkpoints

1. After Task 1-3: architecture review for package boundary and quarantine.
2. After Task 4-5: UI/UX review for timeline/WBS behavior, no fake controls.
3. After Task 6-8: product-owner review for preview/apply path and acceptance criteria.
4. After Task 9: bug-hunt and requesting-code-review before merge.

## Rollback Strategy

- If package extraction destabilizes web build, remove `@kiss-pm/planning-gantt-ui` from `apps/web/package.json` and route imports; the backend planning engine remains untouched.
- If WBS grid implementation is too slow, keep `PlanningGanttSurface` timeline-only behind feature flag and continue WBS grid in a separate slice.
- If BR2 component import graph pulls quarantined modules, stop extraction and copy only SVG/timeline rendering functions into fresh KISS PM files.

## Self-Review

- Spec coverage: every source file category under `packages/gantt-react/src` has a target action.
- Placeholder scan: no `TBD`, `TODO`, or unspecified "handle later" steps.
- Type consistency: all interactions go through `PlanningGanttIntent` and Phase 5/6 `PlanningCommand`.
- Architecture risk: BR2 scheduling/planning authority is explicitly quarantined.
- Product risk: UI path remains preview/apply/reload/audit, not local mutation.
