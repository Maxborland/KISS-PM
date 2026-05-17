# Control Surface Interaction Patterns

Status: Release 2 clean-room product/design specification

Source: supplied `docs/bitrixreports_surfaces_kisspm_transfer_package.zip` used as sanitized product/design input. No BitrixReports2.0 source code, proprietary implementation snippets, credentials, customer data, or tenant-specific process logic are copied into this document.

This document turns strong report-like surface patterns into KISS PM control-surface contracts. The product language remains `ControlSurface`, `ManagementInstrument`, `ControlSignal`, `ManagementAction`, `ActionExecution`, `AuditEvent`, `SchedulePlan`, `ResourceLoadBucket`, `KpiEvaluation`, and `ProjectSnapshot`.

The supplied visual atlas was intentionally not committed into `docs/product/artifacts/` because it contains legacy-style sample labels. The transferable contract is captured below in generic KISS PM language.

## 1. Pattern Law

Release 2 surfaces are operational instruments, not passive reports.

```text
operational projection
  -> signal / risk / decision point
  -> permitted next action
  -> preview or explicit confirmation when risky
  -> ActionExecution
  -> AuditEvent
  -> refreshed read model
  -> reload/readback proof
```

A table, matrix, chart, or Gantt view is incomplete unless it either drives this loop or is explicitly read-only with a reason.

## 2. ControlSurfaceShell

`ControlSurfaceShell` is the shared workspace frame for dense operational surfaces.

Required regions:

- Header: title, tenant/workspace context, object/period context, role scope, freshness badge.
- Toolbar: period mode, filters, saved view, density, refresh, export when permitted, `requiresActionOnly` where relevant.
- Summary: compact KPI strip or capacity strip with drilldown/explanation.
- Signal band: current risks, blockers, recommended next action, disabled reasons.
- Main view: grid, matrix, Gantt, timeline, cards, dashboard, or hybrid.
- Detail panel: selected row/cell/card/task/source object.
- Action panel: preview, warnings, blockers, confirmation, result.
- Audit/readback area: `ActionExecution` id, `AuditEvent` id, actor, before/after summary, recalculation timestamp.

Toolbar controls must be compact and grouped by job: scope, time, filters, view, actions, system state. Decorative page-hero patterns are not used for operational surfaces.

## 3. OperationalDataGrid

`OperationalDataGrid` is the KISS PM version of a configurable report table. It is a management grid, not a spreadsheet clone.

Contract:

- Persisted column widths, visible columns, sort, filters, density, and column order.
- Column order may be constrained by semantic group; dragging across groups is allowed only when the saved view definition permits it.
- Grouped headers use semantic domain groups such as schedule, resource, KPI, owner, next action, and audit.
- Sticky/fixed columns for identity, severity, and primary next action.
- Pagination or virtualization is required when row count can exceed a comfortable desktop viewport.
- `loading` uses skeleton columns shaped like the eventual grid.
- `fetching` keeps prior data visible with subtle refresh state.
- `empty` distinguishes no data from filtered empty and offers reset filters where safe.
- `error` gives source diagnostics and retry without losing prior readback evidence.
- `cached` or `stale` shows freshness and recalculation timestamp.
- Row actions expose permission state, disabled reason, and source object.
- Drilldowns preserve back context with `sourceSurface`, `sourceRow`, or `sourceSignal`.
- Bulk selection is allowed only for actions with clear preview and no hidden cross-tenant effect.
- Reset layout restores tenant default saved view, then user default, then system default.
- Keyboard support includes row focus, column resize handles where implemented, sortable header focus, Enter to open primary drilldown, Escape to close detail panel, and visible focus rings.

Storage rule: local storage may be a fast user convenience, but Release 2 architecture must prefer tenant/user `SavedView` for durable layouts.

## 4. CapacityMatrix

`CapacityMatrix` is the matrix-first pattern for Resource Load, schedule feasibility, and Gantt resource overlays.

Contract:

- Hierarchy rows: portfolio/team, role, resource, placeholder demand, reservation, and summary rows.
- Sticky identity column and sticky day/week/month headers.
- Day columns support weekends, holidays, absence, non-working time, planned assignment, reservation, overload, and free capacity states.
- Crosshair hover highlights the active row and period column without changing layout.
- Heatmap colors represent utilization severity, not decoration.
- Cell value shows enough information to decide: assigned, reserved, free, overload, or unavailable.
- Cell drilldown opens `ResourceLoadDetailSheet` with source tasks, assignments, reservations, opportunity demand, calendars, and capacity rule.
- Context actions include reserve capacity, shift work, split work, reassign resource, accept risk with reason, escalate, or open related Gantt.
- Virtualized rows are required for large resource pools.
- Summary rows and capacity strip show total capacity, planned load, reservation load, free capacity, overload count, and requires-action count.
- Read-only users see all permitted context and explicit disabled reasons.

No capacity matrix may directly mutate state. Every mutation goes through the action/application layer.

## 5. KPIStrip

`KPIStrip` is the compact decision summary at the top of a management surface.

Contract:

- Primary metrics: 4-6 values needed for the next decision.
- Secondary metrics: optional 6-10 supporting values, hidden behind progressive disclosure on small screens.
- Help text explains formula, period, source version, and threshold version.
- Deltas compare current vs previous, live vs baseline, plan vs fact, or before vs after preview.
- Severity colors use the design system tokens for neutral, healthy, attention, critical, and blocked.
- Each metric has at least one of: drilldown, formula explanation, source trace, or action context.
- `requires action` summary is first-class and links to filtered rows or signals.

KPI cards are not decorative dashboard tiles. If a card cannot help a decision, it should be removed or moved to a secondary detail view.

## 6. Drilldown Detail

Drilldown is a standard contract for all rows, cells, cards, bars, and KPI metrics.

Contract:

- Click opens a detail sheet/modal or navigates to a canonical object surface.
- The detail shows source refs, current state, allowed actions, disabled reasons, related signals, and audit/readback history.
- Links may target project overview, Project Gantt, task detail, resource load, KPI deviation, action audit, or retrospective snapshot.
- Drilldowns preserve back context and source context.
- Detail sheets do not mutate business state directly; they trigger action commands or navigate to governed workflows.

Recommended context parameters:

```text
sourceSurface=<surface-id>
sourceRow=<row-id>
sourceSignal=<control-signal-id>
back=<encoded-return-route>
```

## 7. PreviewBeforeApply

`PreviewBeforeApplyPanel` is required when a command may affect schedule, resources, multiple tasks, KPI thresholds, accepted risk, project lifecycle, tenant configuration, or retrospective templates.

Contract:

- Preview is a dry-run and states `mutatesState=false`.
- Before/after summary includes affected objects and expected projection changes.
- Warnings and blockers are separated; blockers disable confirm.
- Risk/confidence is explainable, not opaque.
- Confirmation states the action type, target, actor, permission, audit policy, and refresh behavior.
- Applying shows pending state and prevents duplicate submit.
- Result shows `ActionExecution` id, `AuditEvent` id, changed objects, skipped objects, failed objects, and recalculation/readback timestamp.
- Reload must keep the applied state visible.
- Failed apply must not show optimistic success; recovery path remains visible.

Toast notifications are supplementary only. They are not durable evidence.

## 8. Free Capacity And CRM Feasibility

Free capacity is a decision-support surface between CRM intake and project planning.

Contract:

- Calendar or matrix shows free capacity by role/team/resource over time.
- Deal-fit overlay shows projected demand from an opportunity or project draft.
- The surface recommends two or three start windows with limiting roles, confidence, and risk explanation.
- Recommendations are feasibility guidance, not deterministic production commitments.
- Primary actions: create project draft, reserve capacity, request missing demand data, open resource load, or record assumption.
- Risky capacity reservation uses `PreviewBeforeApply`.
- Readback shows reservation or decision evidence and keeps the opportunity/project draft valid without a live CRM adapter.

This pattern may appear as `UX-P6-FREE-CAPACITY-CALENDAR` or as a future mode of Resource Load, depending on Release 2 implementation slicing.

## 9. Project Gantt Planning

Project Gantt is a custom KISS PM planning workspace over canonical tasks, schedule projections, and assignments. It should meet planner expectations from serious desktop planning tools without copying proprietary Microsoft UI and without making a packaged Gantt widget the product architecture.

Contract:

- Main layout: left WBS/grid and right timeline share one selection, focus, row order, and scroll context.
- WBS grid supports row number/WBS code, task name, planned start/end, duration, work, progress, participant roles, status, warnings, and source links.
- Excel-like editing includes active cell, inline edit, Enter commit, Escape cancel, validation, dirty marker, pending save, API readback, and audit/result feedback.
- Timeline shows task bars, summary bars, milestones, dependencies, baseline bars, tracking/live-vs-baseline deltas, today marker, non-working days, selected row sync, and warnings.
- Critical path is a view mode, not a decorative overlay.
- Dependencies support relationship type, lag/lead, invalid-link preview, and readable error recovery.
- Resource conflict overlays link to `ResourceLoadDetailSheet` or overload resolution.
- Conflict actions use `PreviewBeforeApply` and the action engine.
- Toolbar groups include create task, indent/outdent, link/unlink, baseline, tracking, critical path, zoom, today, filters, conflict visibility, undo/redo when supported, save, and readback state.
- Context menu actions are permission-aware and explain disabled reasons.
- Keyboard operations cover cell navigation, expand/collapse, inline edit, dependency popover entry, save, cancel, and detail panel close.
- Read-only users see the plan, baseline, warnings, and disabled reasons; the toolbar does not collapse into broken buttons.
- No separate Gantt task entity is introduced.

Dirty state must never be confused with saved state. A state-changing Gantt edit is accepted only after command result and refreshed projection readback.

## 10. Portfolio Control

Portfolio Control uses the OperationalDataGrid and KPIStrip patterns as a management surface.

Contract:

- Period/team/type filters, `requiresActionOnly`, refresh, saved view, export when permitted.
- KPI strip separates portfolio health, overdue/delay, resource conflict, KPI deviation, and corrective-action coverage.
- Grid groups project identity, schedule, resource, KPI, owner, next action, and audit.
- Row primary action opens the most relevant drilldown: Project Gantt, KPI deviation, resource conflict, corrective action, or action audit.
- Governed actions include create corrective action, accept risk/deviation with reason, request explanation, escalate, and open Gantt.
- Action result refreshes the source row and related control surfaces.

## 11. KPI Deviation

KPI Deviation Control turns `KpiEvaluation` and `ControlSignal` into traceable action.

Contract:

- Severity filters, owner filters, unhandled/handled mode, and requires-action count.
- KPI strip shows current severity distribution, deltas, breached threshold families, and corrective-action coverage.
- Detail shows formula version, threshold version, source refs, evaluation timestamp, and historical comparison.
- Actions include create corrective action, assign owner, accept deviation with reason, request explanation, and open source project/Gantt.
- Historical evaluations remain stable after threshold configuration changes.

## 12. Retrospective Surface

Retrospective surfaces use closed snapshots, not mutable live state.

Contract:

- Source is `ProjectSnapshot`, snapshot metrics, template version, KPI version, and closure audit.
- Summary compares current closed period with previous comparable period.
- Deltas show plan/fact, baseline/live, quality, customer satisfaction index where tenant-configured, and process-template drift.
- Detail grid links to snapshot, source project, trend, lesson, and template-improvement action.
- Primary action creates a template-improvement proposal or marks a lesson handled through governed command.
- Readback proves the snapshot was not rewritten and future templates changed only through a versioned action.

## 13. Standard State Families

Every Release 2 control surface should specify:

| State | Required behavior |
|---|---|
| loading | Shape-preserving skeleton, not blank spinner. |
| fetching | Keep previous data visible with refresh state. |
| empty | Explain whether data is absent or filters are too narrow. |
| ready | Full toolbar, summary, main view, drilldown, and actions. |
| cached/stale | Show freshness, source, calculation version, and refresh. |
| permission_denied | Explain missing read permission. |
| readonly | Show permitted data and disabled mutation reasons. |
| validation_error | Inline recovery with affected field/object. |
| preview_ready | Before/after summary, blockers, warnings, confirm availability. |
| applying | Pending state, duplicate-submit prevention. |
| applied | Result panel with action/audit ids and refreshed readback. |
| apply_failed | Error reason, retry/recovery, no optimistic success. |
| no_previous | Neutral comparison state when prior period does not exist. |

## 14. Clean-Room Exclusions

Do not copy or encode:

- Bitrix-specific routes, portal URLs, placement logic, field ids, side-panel mechanics, or adapter details into core KISS PM.
- Company-specific roles, stage names, formulas, department labels, IDs, or report layouts.
- Ant Design implementation details as KISS PM design architecture.
- Production/dev auth sandbox patterns, proxy details, credentials, live data, or screenshots containing closed data.
- A domain concept named primarily as `report`.

Allowed transferable ideas:

- Dense operational surfaces.
- Saved layout behavior.
- Grid/matrix/Gantt interaction models.
- KPI strip and delta semantics.
- Drilldown with source context.
- Preview-before-apply.
- Conflict-resolution strategies.
- Audit/readback feedback.
