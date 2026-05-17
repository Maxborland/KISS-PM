 # KISS PM Design System

## Design Direction

KISS PM UI must feel like a mature project-control instrument: dense, calm, confident, operational, and readable. It must avoid decorative marketing composition inside the application. shadcn/ui and Radix primitives are the base interaction layer, but default visual output is not accepted without KISS PM product adaptation.

Release 2 design direction: UI must help a manager make the right operational decision with the least routine friction. A screen is successful when it reduces ambiguity, exposes the next governed action, and makes the consequence of that action clear before mutation. Visual polish is subordinate to decision clarity, permission clarity, auditability, and reliable readback.

Implementation stack:

- Base UI kit: shadcn/ui components adapted to KISS PM density, Russian operational copy, permission states, and audit/readback patterns.
- Interaction primitives: Radix primitives through shadcn/ui or direct Radix use when shadcn does not expose the needed behavior.
- Product components: custom KISS PM components for management-control surfaces, Gantt planning, resource load, KPI signals, audit previews, permission-denied states, and preview-before-apply panels.
- Styling system: Tailwind CSS plus semantic CSS variables/tokens. Direct ad hoc colors are not accepted for product surfaces.
- Icons: Lucide or the existing icon system through stable icon buttons/tooltips; text-only toolbar buttons are allowed only when an icon would be ambiguous.

## Foundation

- Typography: concise Russian operational copy, compact headings, tabular numbers for schedules and KPIs.
- Spacing scale: 4, 8, 12, 16, 24, 32 px; management surfaces prefer 8-16 px rhythm.
- Density modes: compact for power users, standard for first release, spacious only for empty states.
- Color tokens: neutral surfaces, clear foreground hierarchy, semantic severity colors.
- Severity colors: critical red, warning amber, attention blue, success green, neutral gray.
- Surface hierarchy: app shell, surface band, working panel, row/card, inline feedback.
- Border radius: 6-8 px for controls and cards.
- Shadows: minimal; use borders and contrast for structure.
- Focus states: visible keyboard focus on every control.
- Disabled states: explain permission or pending reason near the control.
- Decision support: every management surface must show signal, consequence, recommended next action, preview/result state, and audit evidence where relevant.
- Routine minimization: default values, reusable presets, remembered view density, keyboard-friendly toolbars, inline validation, and drill-downs must reduce repetitive clicks.

## Primitive Policy

| Primitive | Base | KISS PM adaptation | Used for | Not used for |
| --- | --- | --- | --- | --- |
| Button | shadcn Button | Dense height, icon when command is recognizable, Russian verb label, pending and permission state | Primary and secondary commands | Passive labels |
| IconButton | shadcn Button | Tooltip required, fixed square size, visible focus | Toolbar tools | Ambiguous business actions |
| Toolbar | custom shell + shadcn Button | Grouped commands, separators, primary next action first | Gantt, control surfaces | Navigation replacement |
| DropdownMenu | shadcn/Radix | Short action groups, permission-disabled items with reason | Row actions, view actions | Complex forms |
| Command | shadcn Command | Tenant/project scoped, keyboard-first | Search/action launcher | Required MVP workflow path |
| Dialog | shadcn Dialog | Focused form, explicit result area | Low-risk forms | Risky irreversible actions |
| AlertDialog | shadcn AlertDialog | Consequence copy, confirmation phrase when needed | Risky mutations | Routine edits |
| Sheet | shadcn Sheet | Right side detail/edit panel, audit summary footer | Task detail, Gantt detail | Full-page workflows |
| Popover | shadcn Popover | Short contextual controls | Filters, date helpers | Critical decisions |
| Tooltip | shadcn Tooltip | Names icons and disabled reasons | Toolbar and compact controls | Required business explanation |
| Tabs | shadcn Tabs | Stable height, no hidden primary action | Object subviews | Cross-module navigation |
| Table | TanStack Table + shadcn styling | Headless state, fixed density, row actions, severity markers | Lists and WBS grid | Schedule timeline engine |
| Form | shadcn Form | Zod-backed errors, Russian labels, permission state | Config and command input | Pure display |
| Select | shadcn Select | Tenant labels, searchable when long | Option sets | Free text |
| Checkbox | shadcn Checkbox | Clear binary labels | Bulk selection and flags | Multi-step approval |
| Switch | shadcn Switch | Immediate preview of effect | Feature/config toggles | Destructive state |
| Badge | shadcn Badge | Severity and status tokens | Status, role, KPI state | Primary action |
| Toast / Sonner | Sonner | Only supplemental result; never sole proof of mutation | Short confirmation | Audit or persisted evidence |
| ScrollArea | shadcn ScrollArea | Stable dimensions, keyboard scroll | Panels and long tables | Main page scroll replacement |
| Resizable | shadcn/Radix | Split pane with persisted width | Gantt grid/timeline split | Decorative layout |
| Separator | shadcn Separator | Lightweight grouping | Toolbars and metadata | Section card borders |

Every primitive must define density, icon policy, Russian labels, permission state, loading state, destructive/risky state, and keyboard/accessibility behavior in implementation tickets.

## Product-Specific Components

- ControlSurfaceShell: shared shell for management instruments with title, signal area, primary next action, filters, and result feedback.
- OperationalDataGrid: dense control-surface table with persisted column widths/order, grouped headers, sticky identity/action columns, row drilldowns, permission-aware row actions, loading/empty/error/cached/refetch states, keyboard focus, and reset layout behavior through user/tenant saved views.
- CapacityMatrix: matrix-first resource and schedule instrument with hierarchy rows, sticky time headers, crosshair hover, utilization heatmap, absence/non-working/holiday states, overload/free-capacity states, cell drilldowns, context actions, virtualized rows, summary rows, and capacity strip.
- KPIStrip: compact decision summary with primary metrics, help/formula text, deltas, previous-period/baseline comparison, severity colors, source drilldown, and requires-action summary.
- DrilldownDetailSheet: right-side row/cell/card detail surface that preserves source context, shows source refs, allowed actions, disabled reasons, and audit/readback history.
- ManagementActionBar: guarded action row with primary command, secondary commands, permission messages, and pending state.
- SignalSeverityBadge: severity token for KPI, resource, schedule, and lifecycle signals.
- AuditTrailPreview: inline audit/result feedback with actor, command, before/after, and timestamp.
- PermissionDeniedInline: compact explanation of missing permission and available read-only path.
- PreviewBeforeApplyPanel: dry-run result for risky mutations.
- ActionAuditPreview: command result panel with ActionExecution id, AuditEvent id, actor, target, before/after summary, refresh/readback timestamp, and failed/skipped object counts.
- ConfigurableColumnLayout: saved-view editor for operational grids; supports restore system default, restore tenant default, save user layout, and shows validation before publish.
- FreeCapacityCalendar: feasibility surface for opportunity/project draft demand, recommended start windows, limiting role/team explanation, and reservation preview.
- GanttGrid: custom WBS grid based on canonical tasks and schedule projections.
- GanttTimeline: custom timeline with task bars, dependencies, baseline overlay, today marker, and non-working days.
- ProjectGantt: full planning workspace combining GanttGrid, GanttTimeline, details sheet, toolbar groups, dirty/pending/save/readback states, resource conflict overlays, baseline/tracking modes, keyboard operations, and audit/result feedback.
- WbsTreeTable: hierarchical task/stage grid using TanStack Table where useful.
- ResourceLoadHeatmap: capacity and overload visualization with governed resolution entry point.
- KpiSignalCard: KPI deviation summary with next action.
- TenantConfigPreview: shows runtime impact before saving tenant configuration.

## Operational Surface Patterns

Operational surfaces are dense, calm, readable, and action-oriented. They use compact spacing, tabular numbers, stable row heights, sticky context columns, explicit permission states, and visible command results. They do not use decorative hero sections, marketing cards, nested cards, or chart-only dashboards for management workflows.

Reference contract: `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md`.

### OperationalDataGrid

Use for Portfolio Control, Closed Portfolio, KPI Deviation lists, saved-view administration, integration diagnostics, and any surface where a manager scans many operational objects. The first columns identify the object and severity; middle groups expose schedule/resource/KPI facts; the final group contains next action, disabled reason, and audit/readback state.

Every user-facing grid with management actions must support persisted column widths and order or explicitly document why the layout is fixed. Local storage is allowed as a convenience cache, but durable Release 2 layouts should be modeled as tenant/user saved views.

### CapacityMatrix

Use for Resource Load, free capacity, schedule feasibility, and Gantt resource overlays. Heatmap colors must encode utilization severity, absence, non-working time, overload, free capacity, or reservation state. A cell is an action target: click opens details, and permitted context actions lead to preview-before-apply.

### KPIStrip

Use a KPI strip only when the metrics help a decision. Each metric must offer source explanation, drilldown, comparison, or action context. Severity color without source trace is not sufficient for KPI or control-signal work.

### DrilldownDetailSheet

Use sheets for dense detail without losing the surface context. Detail sheets must preserve `sourceSurface`, `sourceRow`, or `sourceSignal`, and must never mutate state directly. Commands start from the sheet but execute through the action layer.

### PreviewBeforeApplyPanel

Preview panels are mandatory for schedule, resource, bulk, KPI threshold, accepted-risk, tenant configuration, and retrospective-template changes. They show before/after, warnings, blockers, permission, confirmation, command result, audit id, and readback status. Toasts are supplemental only.

### ActionAuditPreview

Any meaningful state-changing surface needs a durable result area. Show actor, command type, target, source surface, before/after summary, result, ActionExecution id, AuditEvent id, and refreshed projection timestamp.

### ConfigurableColumnLayout

Column layout controls belong in saved-view or view-settings panels, not random per-column menus. They should support restore default, save user layout, publish tenant view when authorized, validation, and read-only disabled reasons.

### FreeCapacityCalendar

Free capacity is a feasibility instrument. It recommends start windows and explains limiting roles/teams, but it must not present recommendations as production commitments. Capacity reservation uses PreviewBeforeApply and readback.

### ProjectGantt

Project Gantt is a custom KISS PM planning instrument, serious and desktop-like in workflow without copying proprietary UI. Left WBS/grid and right timeline share one state. Inline edits have active cell, Enter/Escape, validation, dirty marker, pending save, API readback, and audit result. Baseline/tracking, critical path, dependencies, resource conflicts, disabled reasons, and reload persistence are first-class.

## Project Gantt Component Contract

Project Gantt is a custom KISS PM planning surface. Functionally and tactically it should feel close to a serious desktop planning tool such as MS Project: WBS/grid and timeline stay synchronized, keyboard selection is predictable, date/work edits are fast, dependencies are visible, baseline comparison is first-class, and the user can read the plan as a management instrument rather than a decorative chart. KISS PM must not copy proprietary UI, but it should match the operational expectations of project planners who know MS Project.

The top toolbar includes create task, indent/outdent, dependency mode, baseline toggle, today, zoom, filters, critical/warning visibility, and view settings. The left WBS/grid area includes hierarchy, row number/WBS code, task name, planned start/end, duration, work, progress, responsible participants, status, and warning/severity markers. The right timeline includes task bars, summary bars, milestone markers, dependencies, baseline bars, today marker, non-working days, selected row sync, hover state, and selection state. The details side panel includes canonical task fields, schedule fields, participants, dependencies, audit summary, and links to My Tasks, Kanban, resource, and KPI views.

Interaction expectations:

- Grid selection, timeline selection, and side panel selection are one state.
- Inline edits must show validation before saving and API readback after saving.
- Dependency creation must preview invalid links before mutation.
- Baseline capture and compare must make live plan vs baseline differences obvious.
- Read-only users see the plan and reasons actions are unavailable, not a broken or empty toolbar.
- Overload, KPI, and lifecycle warnings are visible in context and link to their control surfaces.
- Keyboard use must support common planner operations: row navigation, open detail, save/cancel edit, zoom/today, and command launcher entry.

Mutation flows: create task, edit dates, create dependency, save baseline, open task details, and permission denied state. Persistence: API state changes, reload keeps result, and related My Tasks/Kanban/control surfaces refresh. Audit: actor, command, before/after, source surface, and result.

## Russian Copy Rules

Copy must be concise operational Russian. Avoid vague marketing text inside app. Action labels must be verbs. Destructive/risky action copy must state consequence and recovery or irreversibility.
