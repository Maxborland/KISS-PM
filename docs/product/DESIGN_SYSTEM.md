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

## Release 2 Implementation-Ready Component Contracts

Every Release 2 implementation ticket must treat these as behavior contracts, not visual naming only. All components use dense, calm, operational presentation; stable dimensions; visible focus; explicit permission state; and durable result/readback evidence for mutations.

| Component | Purpose | Visual density | Interaction states | Permission state | Loading / error / empty | Mutation / audit / readback | Keyboard / accessibility | Anti-patterns |
|---|---|---|---|---|---|---|---|---|
| `OperationalSurfaceShell` | Frame a management instrument with context, signal, main view, detail, action, result, and freshness regions. | Compact header, grouped toolbar, stable action/result band. | ready, fetching, stale, readonly, permission_denied, applied, apply_failed. | Shows role/scope and disabled reasons near commands. | Shape-preserving skeleton; error keeps safe prior data when available; empty explains setup or filter reset. | Hosts preview/result/audit regions; exposes refresh/readback timestamp. | Landmark regions, toolbar roving focus, clear heading hierarchy. | Decorative hero, chart-only dashboard, hiding result evidence behind toast. |
| `OperationalDataGrid` | Scan and act on many operational objects. | Dense rows, grouped headers, sticky identity/action columns. | ready, fetching, filtered_empty, stale, row_selected, bulk_selected, readonly. | Row actions and bulk actions show disabled reason; backend denial still required. | Skeleton columns; retry with source diagnostic; reset filters for filtered empty. | Row actions route to action layer; result refreshes row and related summary. | Focusable rows/headers/actions; Enter opens drilldown; Escape closes sheet. | Spreadsheet clone, direct cell mutation, layout stored only in local cache. |
| `ConfigurableColumnLayout` | Configure saved column layout safely. | Compact side panel or settings sheet with grouped fields. | ready, dirty, validation_error, preview_ready, applying, applied, apply_failed. | Publish controls disabled with reason when scope is missing. | Loading current/default layout; invalid layout explains affected group. | Preview affected runtime surface; publish writes config version and audit. | Drag alternatives via buttons/menus; reset is keyboard reachable. | Full unbounded builder, hidden publish impact, irreversible reset. |
| `KPIStrip` | Summarize decision metrics and signal severity. | 4-6 primary metrics; compact deltas and help icons. | ready, stale, no_previous, drilldown_open, readonly. | Actionable metric controls expose required permission. | Skeleton metric widths; empty says why metric is unavailable. | Metric actions open source/action context; no direct mutation. | Cards/buttons have names, descriptions, and focus order. | Decorative KPI tiles, color without source trace, too many equal-weight numbers. |
| `SignalSummaryBar` | Show requires-action summary and highest-risk next step. | One compact band above the main view. | no_signal, signal_present, filtered, stale, readonly. | Recommended action can be disabled with reason. | Loading preserves band height; error shows signal source issue. | Links to action preview/result; readback updates count/status. | Alert-like semantics only for urgent states; not noisy for neutral states. | Alarm wall, vague "attention" labels, no next action. |
| `CapacityMatrix` | Show resource/capacity/schedule load by hierarchy and period. | Dense matrix with sticky identity and time headers. | ready, cell_hover, cell_selected, stale, readonly, preview_ready. | Context actions show disabled reason in cell/detail sheet. | Virtualized skeleton rows; empty distinguishes no data from no capacity window. | Cell actions open preview; applied resolution recalculates buckets and shows audit/readback. | Arrow navigation across cells, row/column headers announced, crosshair not focus-only. | Heatmap decoration, direct cell mutation, hidden source tasks. |
| `GanttPlanningSurface` | Plan canonical tasks through synchronized WBS/grid and timeline. | Desktop-like split pane with compact toolbar and stable row heights. | ready, cell_active, dirty, validation_error, pending_save, applied, stale, readonly. | Toolbar and context menu preserve disabled commands with reasons. | Skeleton grid/timeline; empty WBS offers permitted task creation or readonly reason. | Saves go through API/action layer; result shows audit and refreshed projection. | Cell navigation, Enter/Escape edit, expand/collapse, command menu, visible focus. | Packaged Gantt widget as architecture, duplicated Gantt task entity, visual-only bars. |
| `GanttTrackingOverlay` | Compare baseline and live plan without mutating baseline silently. | Thin baseline/live bars and readable variance markers. | no_baseline, tracking_on, variance_selected, stale, readonly. | Baseline capture/edit controls disabled by schedule permission. | Loading comparison; no baseline gives capture action if allowed. | Capture/update writes audit; live edits show readback and baseline stability. | Toggle and variance details keyboard reachable. | Baseline hidden in legend only, live edits rewriting baseline. |
| `ResourceConflictResolutionPanel` | Guide overload resolution from source refs to preview/apply. | Split before/after impact plus concise options. | option_selected, preview_ready, blocker, applying, applied, apply_failed, readonly. | Denied options remain visible with reason. | Loading affected work; error keeps source refs and retry. | Preview is dry-run; apply shows ActionExecution, AuditEvent, recalculation timestamp. | Options are radio/segmented controls; confirmation is focus-managed. | One-click resolution, optimistic success without readback, vague capacity numbers. |
| `PreviewBeforeApplyPanel` | Show dry-run impact before risky mutation. | Compact before/after, blockers, warnings, confirmation area. | preview_ready, blocker, confirming, applying, applied, apply_failed. | Permission trace visible before confirm. | Preview loading/error does not mutate; blockers disable confirm. | Result shows changed/skipped/failed objects, audit ids, and refresh timestamp. | Confirm/cancel order predictable; blockers announced. | Toast-only result, mixing warnings and blockers, hidden affected objects. |
| `ActionAuditPreview` | Provide durable evidence for executed action. | Inline panel or footer, not a modal trap. | succeeded, failed, denied, partial, stale_readback. | Shows permission/precondition trace on denial. | Loading readback state; error explains recovery. | Displays ActionExecution id, AuditEvent id, actor, target, before/after, readback. | Copy ids/details keyboard accessible; links named. | Treating toast as audit, hiding failure details. |
| `PermissionDeniedInline` | Explain disabled/denied state without making UI look broken. | Small inline callout or disabled reason line. | readonly, denied, out_of_scope, stale_permission. | Gives required permission/scope and available read-only path. | Not applicable beyond loading policy trace when needed. | Denial result can link to action audit/trace when attempted. | Associated with disabled control via accessible description. | Hiding controls entirely when the user needs context, generic "forbidden". |
| `RuntimeConfigPreview` | Show tenant config impact before publish. | Side-by-side draft/runtime preview with affected surfaces. | dirty, validation_error, preview_ready, applying, applied, apply_failed, readonly. | Publish disabled by config permission/scope with reason. | Loading affected surfaces; invalid config highlights exact rule. | Publish writes versioned config, audit, and runtime readback after reload. | Form fields named; preview region announced after recalculation. | Blind save, arbitrary code/formula execution, no affected-surface preview. |

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
