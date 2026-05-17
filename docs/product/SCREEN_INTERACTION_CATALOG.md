# Screen Interaction Catalog P3-P12

Each card uses this contract: Screen ID, Phase, Route/surface, Primary role, Primary object, User goal, Primary next action, Main layout, Data shown, Primary actions, Secondary actions, Bulk actions, Modals/sheets/popovers, Empty/loading/error states, Permission states, Audit/result feedback, Reload/refetch behavior, E2E scenarios, Design notes.

## UX-P3-CRM-INTAKE

Phase: P3. Route/surface: `/crm/intake`. Primary role: ProjectManager. Primary object: opportunity queue. User goal: find opportunities ready for project control. Primary next action: open readiness review. Main layout: ControlSurfaceShell with filters, signal rows, ManagementActionBar. Data shown: client, opportunity value, readiness, missing data, owner. Primary actions: open detail, create draft when ready. Secondary actions: request data, assign owner. Bulk actions: assign owner. Modals/sheets/popovers: readiness filter popover, request data dialog. Empty/loading/error states: setup guidance, skeleton rows, retry with diagnostics. Permission states: crm.read required, project.create guarded. Audit/result feedback: intake decision and draft command. Reload/refetch behavior: queue reflects created draft. E2E scenarios: E2E-020, E2E-021. Design notes: no passive queue; show decision point.

## UX-P3-OPPORTUNITY-DETAIL

Phase: P3. Route/surface: `/crm/opportunities/:id`. Primary role: ProjectManager. Primary object: opportunity. User goal: inspect business and delivery readiness. Primary next action: run feasibility/readiness panel. Main layout: object header, facts, readiness side panel, action bar. Data shown: client, scope, budget, dates, constraints, external mapping. Primary actions: run readiness, create project draft. Secondary actions: edit intake data, request clarification. Bulk actions: none. Modals/sheets/popovers: missing data sheet. Empty/loading/error states: missing opportunity, skeleton, retry. Permission states: crm.read, crm.write, project.create. Audit/result feedback: readiness and draft creation. Reload/refetch behavior: readiness and draft link persist. E2E scenarios: E2E-020, E2E-021, E2E-023.

## UX-P3-FEASIBILITY-PANEL

Phase: P3. Route/surface: opportunity side panel. Primary role: ProjectManager. Primary object: feasibility assessment. User goal: understand whether project creation is safe. Primary next action: resolve blocker or approve draft creation. Main layout: signals, blockers, recommended action. Data shown: required artifacts, capacity hints, deadline risks. Primary actions: mark ready, request missing info. Secondary actions: add assumption. Bulk actions: none. Modals/sheets/popovers: blocker resolution dialog. Empty/loading/error states: no assessment, calculating, calculation error. Permission states: feasibility.read/write. Audit/result feedback: readiness decision. Reload/refetch behavior: panel shows current readiness version. E2E scenarios: E2E-021, E2E-022.

## UX-P3-PROJECT-DRAFT

Phase: P3. Route/surface: `/projects/drafts/:id`. Primary role: ProjectManager. Primary object: project draft. User goal: review canonical project before activation. Primary next action: activate project. Main layout: draft summary, template preview, action bar. Data shown: stages, task templates, participants, source opportunity. Primary actions: activate, return to opportunity. Secondary actions: adjust template selection. Bulk actions: none. Modals/sheets/popovers: activation preview dialog. Empty/loading/error states: draft missing, skeleton, validation errors. Permission states: project.create, lifecycle.write. Audit/result feedback: project creation and activation. Reload/refetch behavior: active project link persists. E2E scenarios: E2E-023, E2E-024.

## UX-P4-PROJECT-OVERVIEW

Phase: P4. Route/surface: `/projects/:id`. Primary role: ProjectManager. Primary object: project. User goal: see lifecycle, work, risks, and next action. Primary next action: open current stage gate or Gantt. Main layout: header, lifecycle strip, management signals, related surfaces. Data shown: status, stage, blockers, task health, latest actions. Primary actions: open gate, open Gantt, create task. Secondary actions: open Kanban/My Tasks/resources/KPI. Bulk actions: none. Modals/sheets/popovers: task create sheet. Empty/loading/error states: no project, skeleton, retry. Permission states: project.read, lifecycle.write, task.write. Audit/result feedback: lifecycle/action summary. Reload/refetch behavior: related surfaces refresh. E2E scenarios: E2E-030, E2E-031, E2E-032.

## UX-P4-STAGE-GATE

Phase: P4. Route/surface: `/projects/:id/stage-gate`. Primary role: Controller. Primary object: stage gate. User goal: approve or block lifecycle transition. Primary next action: approve or reject with reason. Main layout: evidence list, blocker signals, decision panel. Data shown: artifacts, approvals, blocking conditions, audit history. Primary actions: approve, reject. Secondary actions: request artifact. Bulk actions: none. Modals/sheets/popovers: approval dialog, rejection dialog. Empty/loading/error states: no gate, loading evidence, failed evidence readback. Permission states: lifecycle.approve. Audit/result feedback: transition decision. Reload/refetch behavior: project stage changes or blocker remains. E2E scenarios: E2E-031, E2E-032.

## UX-P4-MY-TASKS

Phase: P4. Route/surface: `/work/my-tasks`. Primary role: Executor. Primary object: canonical tasks. User goal: execute assigned work. Primary next action: update task status. Main layout: task list, filters, detail sheet. Data shown: status, due date, role, project, blockers. Primary actions: start, complete, request review. Secondary actions: comment, open project/Gantt. Bulk actions: update selected status when allowed. Modals/sheets/popovers: task detail sheet. Empty/loading/error states: no tasks, skeleton, retry. Permission states: task.read, task.status.write. Audit/result feedback: status change. Reload/refetch behavior: status persists and Kanban updates. E2E scenarios: E2E-033, E2E-041.

## UX-P4-KANBAN

Phase: P4. Route/surface: `/projects/:id/kanban`. Primary role: Executor. Primary object: canonical task board. User goal: move work through execution states. Primary next action: move task to next allowed state. Main layout: board columns, task cards, side panel. Data shown: task name, participant roles, due date, severity. Primary actions: move card, open details. Secondary actions: filter, assign participant. Bulk actions: none. Modals/sheets/popovers: card detail sheet. Empty/loading/error states: no tasks, skeleton columns, retry. Permission states: task.read/write by role. Audit/result feedback: movement audit. Reload/refetch behavior: My Tasks and board align. E2E scenarios: E2E-034, E2E-041.

## UX-P5-PROJECT-GANTT

Phase: P5. Route/surface: `/projects/:id/gantt`. Primary role: ProjectManager. Primary object: canonical task schedule projection. User goal: plan project work using WBS, timeline, dependencies, and baseline. Primary next action: create or adjust planned task. Main layout: custom split pane with toolbar, WBS/grid, timeline, details side panel. Data shown: hierarchy, task name, planned start/end, duration, work, progress, participants, status, warnings, dependencies, baseline bars, today marker, non-working days. Primary actions: create task, edit dates, create dependency, save baseline. Secondary actions: indent/outdent, zoom, today, filters, view settings, open linked My Tasks/Kanban/resource/KPI. Bulk actions: adjust selected tasks where permitted. Modals/sheets/popovers: Gantt task detail panel, baseline panel, dependency popover, permission inline, command result feedback. Empty/loading/error states: no WBS tasks, skeleton grid/timeline, retry with diagnostics. Permission states: project.read, task.write, audit.read; denied users get read-only plan. Audit/result feedback: actor, command, before/after, source surface, result. Reload/refetch behavior: API readback is required; related views refresh; baseline values do not silently change. E2E scenarios: E2E-040, E2E-041, E2E-042, E2E-043, E2E-044. Design notes: Project Gantt is a custom KISS PM planning surface using TanStack Table/headless grid where useful and shadcn/Radix primitives for controls; not an embedded packaged Gantt widget.

## UX-P5-GANTT-TASK-PANEL

Phase: P5. Route/surface: Gantt side panel. Primary role: ProjectManager. Primary object: canonical task. User goal: edit task and schedule fields with audit visibility. Primary next action: save schedule change. Main layout: Sheet with task fields, schedule fields, participants, dependencies, audit summary. Data shown: canonical task, dates, work, progress, roles, linked views. Primary actions: save, open task in My Tasks/Kanban. Secondary actions: add dependency, inspect audit. Bulk actions: none. Empty/loading/error states: no selection, loading task, validation error. Permission states: task.write guarded. Audit/result feedback: schedule update. Reload/refetch behavior: row and timeline refresh. E2E scenarios: E2E-041, E2E-042.

## UX-P5-BASELINE-PANEL

Phase: P5. Route/surface: Gantt baseline panel. Primary role: ProjectManager. Primary object: baseline snapshot. User goal: capture and compare baseline against live plan. Primary next action: capture baseline. Main layout: baseline summary, diff list, confirmation. Data shown: task planned values, current values, deltas. Primary actions: capture baseline, toggle overlay. Secondary actions: inspect changed tasks. Bulk actions: none. Empty/loading/error states: no baseline, loading comparison, capture error. Permission states: schedule.baseline.write. Audit/result feedback: baseline capture. Reload/refetch behavior: overlay persists and live date edits do not mutate baseline. E2E scenarios: E2E-044.

## UX-P6-RESOURCE-LOAD

Phase: P6. Route/surface: `/resources/load`. Primary role: ResourceManager. Primary object: resource capacity. User goal: detect overloads. Primary next action: open overload resolution. Main layout: ResourceLoadHeatmap, signal list, action bar. Data shown: capacity, assignments, reservations, overload buckets. Primary actions: open resolution, reserve capacity. Secondary actions: filter by team/project. Bulk actions: resolve selected overloads. Empty/loading/error states: no load data, skeleton heatmap, retry. Permission states: resource.read/write. Audit/result feedback: reservation/action summary. Reload/refetch behavior: load recalculates after commands. E2E scenarios: E2E-050.

## UX-P6-OVERLOAD-RESOLUTION

Phase: P6. Route/surface: resource resolution flow. Primary role: ResourceManager. Primary object: overload signal. User goal: reduce or govern overload. Primary next action: apply previewed resolution. Main layout: signal, options, PreviewBeforeApplyPanel, result. Data shown: affected assignments, dates, workload, impacted projects. Primary actions: reassign, shift, escalate, accept overload; reserve capacity remains a Resource Load reservation action and is not shown as resolved overload when it adds demand. Secondary actions: open Gantt/project only when the schedule project is available. Bulk actions: apply same resolution to selected buckets. Empty/loading/error states: no overload, calculating preview, command error. Permission states: resource.write and task.write by action. Audit/result feedback: before/after capacity and command result. Reload/refetch behavior: heatmap refreshes. E2E scenarios: E2E-051.

## UX-P7-KPI-DEFINITION

Phase: P7. Route/surface: `/admin/kpi-definitions`. Primary role: TenantAdmin. Primary object: KPI definition. User goal: configure traceable KPI formulas and thresholds. Primary next action: publish definition version. Main layout: definition list, editor sheet, preview. Data shown: formula, source data, thresholds, version. Primary actions: create, validate, publish. Secondary actions: duplicate, retire. Bulk actions: retire selected. Empty/loading/error states: no definitions, skeleton, validation errors. Permission states: kpi.config.write. Audit/result feedback: definition version audit. Reload/refetch behavior: runtime KPI surfaces use published version. E2E scenarios: E2E-070.

## UX-P7-KPI-DEVIATION

Phase: P7. Route/surface: `/kpi/deviations`. Primary role: Executive. Primary object: KPI signal. User goal: handle deviations. Primary next action: create corrective action or accept risk. Main layout: KpiSignalCard list, severity filters, action bar. Data shown: KPI, period, threshold, severity, source data, owner. Primary actions: open control action, assign owner. Secondary actions: drill into project. Bulk actions: assign owner. Empty/loading/error states: no deviations, loading signals, failed evaluation. Permission states: kpi.read, control.action.write. Audit/result feedback: signal handling audit. Reload/refetch behavior: handled status persists. E2E scenarios: E2E-070, E2E-080.

## UX-P8-PORTFOLIO-CONTROL

Phase: P8. Route/surface: `/control/portfolio`. Primary role: Executive. Primary object: portfolio control surface. User goal: govern project deviations. Primary next action: execute recommended management action. Main layout: ControlSurfaceShell with signals, cards, table, ManagementActionBar. Data shown: schedule/resource/KPI deviations, severity, owner, recommended action. Primary actions: corrective action, accept risk, escalate. Secondary actions: drilldown. Bulk actions: assign owners. Empty/loading/error states: no signals, skeleton, source error. Permission states: control.read/write. Audit/result feedback: action result. Reload/refetch behavior: signals refresh after action. E2E scenarios: E2E-080.

## UX-P8-CORRECTIVE-ACTION

Phase: P8. Route/surface: corrective action dialog. Primary role: ProjectManager. Primary object: management action. User goal: create traceable corrective task/action. Primary next action: confirm corrective action. Main layout: AlertDialog with context, owner, due date, preview. Data shown: source signal, target entity, expected result. Primary actions: create corrective action. Secondary actions: cancel, open source. Bulk actions: none. Empty/loading/error states: missing signal, pending, command error. Permission states: control.action.write. Audit/result feedback: created action and audit id. Reload/refetch behavior: source signal shows action link. E2E scenarios: E2E-081.

## UX-P8-ACCEPT-RISK

Phase: P8. Route/surface: accept risk dialog. Primary role: Executive. Primary object: risk/deviation. User goal: explicitly accept risk with reason. Primary next action: accept risk. Main layout: AlertDialog with consequence, required reason, expiry. Data shown: signal, severity, impact, recovery note. Primary actions: accept risk. Secondary actions: create corrective action instead. Bulk actions: none. Empty/loading/error states: missing reason, pending, command error. Permission states: risk.accept. Audit/result feedback: accepted risk audit. Reload/refetch behavior: signal marked accepted with reason. E2E scenarios: E2E-082.

## UX-P8-ACTION-AUDIT

Phase: P8. Route/surface: action audit side panel. Primary role: Controller. Primary object: action execution. User goal: verify traceability. Primary next action: inspect command result and source. Main layout: AuditTrailPreview. Data shown: actor, command, source, target, before/after, result, timestamp. Primary actions: open source/target. Secondary actions: copy audit id. Bulk actions: none. Empty/loading/error states: no audit, loading, retry. Permission states: audit.read. Audit/result feedback: self-describing audit record. Reload/refetch behavior: latest audit shown. E2E scenarios: E2E-080, E2E-081, E2E-082.

## UX-P9-CLOSED-PORTFOLIO

Phase: P9. Route/surface: `/retrospectives/closed-portfolio`. Primary role: Executive. Primary object: closed project snapshots. User goal: inspect immutable closure outcomes. Primary next action: open trend analysis. Main layout: portfolio snapshot table, filters, signal summary. Data shown: closed projects, baselines, actuals, deviations, lessons. Primary actions: open retrospective trends. Secondary actions: open project snapshot. Bulk actions: tag selected lessons. Empty/loading/error states: no closed projects, loading, snapshot error. Permission states: retrospective.read. Audit/result feedback: snapshot access and improvement actions. Reload/refetch behavior: snapshots remain stable. E2E scenarios: E2E-090.

## UX-P9-RETROSPECTIVE-TRENDS

Phase: P9. Route/surface: `/retrospectives/trends`. Primary role: Executive. Primary object: trend. User goal: convert closure trends into template improvement. Primary next action: create improvement action. Main layout: trend chart, signal cards, action bar. Data shown: recurring delays, overloads, KPI drift, template impact. Primary actions: create template improvement. Secondary actions: drill into snapshots. Bulk actions: group related trends. Empty/loading/error states: no trends, loading calculation, calculation error. Permission states: retrospective.read/write. Audit/result feedback: improvement action audit. Reload/refetch behavior: trend marked handled. E2E scenarios: E2E-091.

## UX-P9-TEMPLATE-IMPROVEMENT

Phase: P9. Route/surface: template improvement flow. Primary role: TenantAdmin. Primary object: process/task template. User goal: improve future delivery based on retrospective evidence. Primary next action: apply template change preview. Main layout: evidence, proposed change, preview, confirmation. Data shown: affected templates, expected effect, source trends. Primary actions: apply improvement. Secondary actions: send for review. Bulk actions: none. Empty/loading/error states: no proposal, preview loading, validation error. Permission states: tenant.config.write. Audit/result feedback: template version audit. Reload/refetch behavior: future drafts use new version. E2E scenarios: E2E-092.

## UX-P10-TENANT-LABELS

Phase: P10. Route/surface: `/admin/tenant/labels`. Primary role: TenantAdmin. Primary object: tenant labels. User goal: adapt terminology safely. Primary next action: preview and save label set. Main layout: label table, runtime preview, action bar. Data shown: system key, current label, affected surfaces. Primary actions: save labels. Secondary actions: reset to template. Bulk actions: import label set. Empty/loading/error states: no labels, loading, validation error. Permission states: tenant.config.write. Audit/result feedback: config version audit. Reload/refetch behavior: screens show saved labels. E2E scenarios: E2E-060.

## UX-P10-TENANT-TAXONOMIES

Phase: P10. Route/surface: `/admin/tenant/taxonomies`. Primary role: TenantAdmin. Primary object: taxonomy. User goal: define operational classifications. Primary next action: publish taxonomy version. Main layout: taxonomy tree, preview, validation. Data shown: values, status, affected fields. Primary actions: publish. Secondary actions: archive value. Bulk actions: reorder. Empty/loading/error states: no taxonomy, loading, validation error. Permission states: tenant.config.write. Audit/result feedback: taxonomy version audit. Reload/refetch behavior: new values available in forms. E2E scenarios: E2E-060.

## UX-P10-CUSTOM-FIELDS

Phase: P10. Route/surface: `/admin/tenant/custom-fields`. Primary role: TenantAdmin. Primary object: custom field definition. User goal: add tenant data without code. Primary next action: create field with preview. Main layout: definitions table, field editor sheet, runtime preview. Data shown: field type, target entity, validation, visibility. Primary actions: create/update field. Secondary actions: disable field. Bulk actions: reorder fields. Empty/loading/error states: no fields, loading, validation error. Permission states: tenant.config.write. Audit/result feedback: field definition audit. Reload/refetch behavior: target forms include field. E2E scenarios: E2E-061.

## UX-P10-KPI-THRESHOLDS

Phase: P10. Route/surface: `/admin/tenant/kpi-thresholds`. Primary role: TenantAdmin. Primary object: threshold rule. User goal: tune KPI signals safely. Primary next action: preview threshold impact and publish. Main layout: rule editor, impact preview, action bar. Data shown: thresholds, severity, sample evaluations. Primary actions: publish threshold. Secondary actions: duplicate rule. Bulk actions: none. Empty/loading/error states: no thresholds, calculating preview, validation error. Permission states: kpi.config.write. Audit/result feedback: threshold version audit. Reload/refetch behavior: KPI deviation surface uses new rules. E2E scenarios: E2E-062.

## UX-P10-SAVED-VIEWS

Phase: P10. Route/surface: `/admin/tenant/saved-views`. Primary role: TenantAdmin. Primary object: view definition. User goal: configure repeatable management surfaces. Primary next action: publish saved view. Main layout: view list, layout builder, permission preview. Data shown: fields, filters, sort, actions, roles. Primary actions: save/publish view. Secondary actions: duplicate. Bulk actions: archive selected. Empty/loading/error states: no views, loading, invalid layout. Permission states: view.config.write. Audit/result feedback: view version audit. Reload/refetch behavior: surface loads new view. E2E scenarios: E2E-062.

## UX-P11-INTEGRATION-IMPORT

Phase: P11. Route/surface: `/admin/integrations/import`. Primary role: IntegrationAdmin. Primary object: import batch. User goal: bring external data into canonical operation. Primary next action: run import preview. Main layout: connector selector, import preview, conflict list. Data shown: source records, mappings, conflicts, idempotency key. Primary actions: preview, execute import. Secondary actions: save mapping. Bulk actions: accept non-conflicting records. Empty/loading/error states: no connector, loading preview, import error. Permission states: integration.write. Audit/result feedback: import batch audit. Reload/refetch behavior: canonical entities appear. E2E scenarios: E2E-110.

## UX-P11-EXTERNAL-MAPPING

Phase: P11. Route/surface: `/admin/integrations/mapping`. Primary role: IntegrationAdmin. Primary object: external mapping. User goal: diagnose mapping health. Primary next action: fix broken mapping. Main layout: mapping table, diagnostics panel, action bar. Data shown: external id, canonical id, sync direction, conflict strategy. Primary actions: repair mapping. Secondary actions: open canonical entity. Bulk actions: retry selected. Empty/loading/error states: no mappings, loading, diagnostic error. Permission states: integration.write. Audit/result feedback: mapping repair audit. Reload/refetch behavior: import diagnostics clear. E2E scenarios: E2E-111.

## UX-P12-RELEASE-READINESS

Phase: P12. Route/surface: `/ops/release-readiness`. Primary role: OperatorAdmin. Primary object: release gate. User goal: prove release readiness. Primary next action: run readiness check. Main layout: checklist, evidence links, failures. Data shown: test commands, matrix status, open blockers, artifacts. Primary actions: run check, mark blocker. Secondary actions: open evidence. Bulk actions: rerun selected checks. Empty/loading/error states: no run, running, failed command. Permission states: ops.execute. Audit/result feedback: run evidence. Reload/refetch behavior: latest run persists. E2E scenarios: E2E-113, E2E-115.

## UX-P12-PERMISSION-SMOKE

Phase: P12. Route/surface: `/ops/permission-smoke`. Primary role: OperatorAdmin. Primary object: permission smoke. User goal: prove UI and backend permission alignment. Primary next action: run permission smoke. Main layout: smoke table, expected/actual, evidence. Data shown: role, action, UI state, API result. Primary actions: run smoke. Secondary actions: open failing surface. Bulk actions: rerun failures. Empty/loading/error states: no smoke, running, failure. Permission states: ops.execute. Audit/result feedback: smoke run record. Reload/refetch behavior: evidence remains linked. E2E scenarios: E2E-111.

## UX-P12-TENANT-ISOLATION

Phase: P12. Route/surface: `/ops/tenant-isolation`. Primary role: OperatorAdmin. Primary object: tenant isolation proof. User goal: prove data boundaries. Primary next action: run isolation smoke. Main layout: scenarios, result table, evidence. Data shown: tenant, actor, query, expected denial. Primary actions: run isolation smoke. Secondary actions: open failing request. Bulk actions: rerun selected. Empty/loading/error states: no run, running, failed run. Permission states: ops.execute. Audit/result feedback: smoke run evidence. Reload/refetch behavior: latest proof visible. E2E scenarios: E2E-112.

## UX-P12-RECOVERY-SMOKE

Phase: P12. Route/surface: `/ops/recovery-smoke`. Primary role: OperatorAdmin. Primary object: recovery path. User goal: prove recovery is understandable and controlled. Primary next action: run recovery smoke. Main layout: recovery scenarios, action log, result panel. Data shown: failure mode, recovery command, result, audit id. Primary actions: run recovery. Secondary actions: inspect logs. Bulk actions: none. Empty/loading/error states: no scenario, running, command failure. Permission states: ops.execute. Audit/result feedback: recovery command audit. Reload/refetch behavior: recovery state persists. E2E scenarios: E2E-114.
