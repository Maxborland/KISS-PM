# KISS PM Design System

## Design Direction

KISS PM UI must feel like a mature project-control instrument: dense, calm, confident, operational, and readable. It must avoid decorative marketing composition inside the application. shadcn/ui and Radix primitives are the base interaction layer, but default visual output is not accepted without KISS PM product adaptation.

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
- ManagementActionBar: guarded action row with primary command, secondary commands, permission messages, and pending state.
- SignalSeverityBadge: severity token for KPI, resource, schedule, and lifecycle signals.
- AuditTrailPreview: inline audit/result feedback with actor, command, before/after, and timestamp.
- PermissionDeniedInline: compact explanation of missing permission and available read-only path.
- PreviewBeforeApplyPanel: dry-run result for risky mutations.
- GanttGrid: custom WBS grid based on canonical tasks and schedule projections.
- GanttTimeline: custom timeline with task bars, dependencies, baseline overlay, today marker, and non-working days.
- WbsTreeTable: hierarchical task/stage grid using TanStack Table where useful.
- ResourceLoadHeatmap: capacity and overload visualization with governed resolution entry point.
- KpiSignalCard: KPI deviation summary with next action.
- TenantConfigPreview: shows runtime impact before saving tenant configuration.

## Project Gantt Component Contract

Project Gantt is a custom KISS PM planning surface. The top toolbar includes create task, indent/outdent, dependency mode, baseline toggle, today, zoom, filters, and view settings. The left WBS/grid area includes hierarchy, task name, planned start/end, duration, work, progress, responsible participants, status, and warning/severity markers. The right timeline includes task bars, dependencies, baseline bars, today marker, non-working days, selected row sync, hover state, and selection state. The details side panel includes canonical task fields, schedule fields, participants, dependencies, audit summary, and links to My Tasks, Kanban, resource, and KPI views.

Mutation flows: create task, edit dates, create dependency, save baseline, open task details, and permission denied state. Persistence: API state changes, reload keeps result, and related My Tasks/Kanban/control surfaces refresh. Audit: actor, command, before/after, source surface, and result.

## Russian Copy Rules

Copy must be concise operational Russian. Avoid vague marketing text inside app. Action labels must be verbs. Destructive/risky action copy must state consequence and recovery or irreversibility.
