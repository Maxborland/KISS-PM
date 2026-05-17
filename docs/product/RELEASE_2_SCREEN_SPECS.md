# Release 2 Screen Specs

Updated: 2026-05-17

## Product-app reset blocker

Release 2 control-surface components are merged, but app-level SaaS readiness is not accepted. Before further Release 2 implementation, KISS PM must complete `RELEASE_2_APP_FOUNDATION_RESET` and pass product-owner smoke E2E.

Screen specs remain valid as component/control-surface foundation. They are not sufficient acceptance for a runnable SaaS app until login/dev-auth, real routes/pages/deep links, app shell, profile/account, tenant admin settings, demo seed/readback, and route-level permission guards are implemented.

## 1. Purpose

This document turns `docs/02_UNIVERSAL_PROJECT_BP.md` into a Release 2 screen contract.

Release 2 screens are not passive reports. A report-like page is accepted only when it behaves as an interactive management plane:

```txt
operational data or report projection
  -> control signal
  -> recommended governed action
  -> preview or dry-run when risk is material
  -> result and audit evidence
  -> refreshed projection
  -> reload persistence
```

The word "report" may appear in user-facing Russian labels where it is natural for users, but domain and implementation language must treat the surface as `ControlSurface`, `ManagementInstrument`, `ControlSignal`, and `ManagementAction`.

## 2. Screen Contract

Every Release 2 user-facing screen spec must define:

- BP stage or cross-cutting process from `02_UNIVERSAL_PROJECT_BP.md`;
- route or app surface;
- primary role and secondary roles;
- primary managed object;
- operational data shown;
- control signals and severity;
- one primary next action for the current state;
- secondary and drill-down actions;
- preview/dry-run behavior for risky changes;
- result/audit evidence;
- permission and read-only behavior;
- loading, empty, ready, denied, error, stale-preview, mutation-pending, and success states;
- API/domain readback;
- projection refresh and reload persistence;
- cleanup/reset expectations for executable tests.

## 3. S0 CRM Opportunity / Intake

### R2-S0-CRM-INTAKE-CONTROL

- Route/surface: `/crm/intake`.
- Primary role: Business Development / Sales with Project Manager.
- Managed object: Opportunity and Project Intake.
- User goal: understand which opportunities can safely enter project control.
- Main layout: ControlSurfaceShell with intake queue, readiness signal band, missing-data column, feasibility badge, and right detail sheet.
- Signals: missing required intake fields, unrealistic requested dates, absent project type, capacity feasibility warning, duplicate opportunity.
- Primary next action: open readiness review for the highest-risk ready-to-decide opportunity.
- Governed actions: request missing data, run demand estimate, run capacity check, reserve capacity, create project draft, defer, reject, accept intake risk with reason.
- Preview/result: create-draft and reserve-capacity actions require preview with affected stages, role demand, expected dates, and capacity impact; result area shows linked draft/reservation/audit id.
- Permission behavior: read-only users see intake state and blockers but cannot run estimates, reserve capacity, or create drafts; backend denial must match UI state.
- Reload/readback: opportunity decision, draft link, feasibility version, reservation, and audit evidence must survive reload.

### R2-S0-CAPACITY-FEASIBILITY-CONTROL

- Route/surface: opportunity side sheet or `/crm/opportunities/:id/feasibility`.
- Primary role: Resource Manager.
- Managed object: demand projection and capacity feasibility result.
- User goal: decide whether promised dates are feasible before project authorization.
- Main layout: demand-by-stage table, resource-role capacity strip, conflict explanations, recommendation panel.
- Signals: role shortage, overload period, missing demand estimate, accepted-risk expiry.
- Primary next action: preview capacity reservation or request schedule change.
- Governed actions: reserve capacity, adjust demand assumptions, request missing scope, accept feasibility risk.
- Preview/result: reservation preview must show before/after load buckets and opportunity/project draft impact; apply writes audit and refreshes resource load.
- Permission behavior: Sales can read feasibility summary; Resource Manager can reserve/accept risk; out-of-tenant users get no entity details.
- Reload/readback: feasibility decision, risk acceptance, and reservation read back from API after reload.

## 4. S1 Contract / Project Authorization

### R2-S1-CONTRACT-AUTHORIZATION-CONTROL

- Route/surface: `/projects/authorization`.
- Primary role: Project Manager with Project Principal.
- Managed object: authorized project commitment.
- User goal: convert a qualified opportunity into an accountable project without losing capacity and risk context.
- Main layout: authorization queue, opportunity/contract facts, role assignment panel, startup impact preview.
- Signals: missing contract artifact, missing Project Principal, expired feasibility, commercial/delivery risk, blocked role assignment.
- Primary next action: preview active-project creation.
- Governed actions: create active project, assign key roles, link authorization artifact, create startup tasks, re-run feasibility, flag risk.
- Preview/result: activation preview shows template version, initial stages, generated tasks, role assignments, linked opportunity, capacity assumptions, and audit policy.
- Permission behavior: only authorized lifecycle users activate; read-only users can inspect readiness and reasons.
- Reload/readback: project status, owner/principal, startup tasks, linked opportunity, and audit event persist.

## 5. S2 Project Startup And Preparation

### R2-S2-PROJECT-STARTUP-CONTROL

- Route/surface: `/projects/:id/startup`.
- Primary role: Project Principal with Project Manager.
- Managed object: project startup checklist, WBS seed, baseline draft, initial KPI targets.
- User goal: prepare a project for controlled execution.
- Main layout: project context header, startup checklist, template-generated task preview, resource/KPI/schedule signal band, action rail.
- Signals: missing input data, missing key roles, infeasible initial dates, resource overload, KPI target missing, baseline not ready.
- Primary next action: generate or refresh startup plan from selected template.
- Governed actions: generate stage tasks, assign or reserve resources, adjust dates, create risk/corrective task, approve baseline draft, request missing input.
- Preview/result: plan generation and baseline approval require before/after preview; result shows generated canonical tasks, schedule projection, audit id, and related-surface refresh.
- Permission behavior: Project Principal/PM can prepare plan; read-only roles see readiness and drill-downs.
- Reload/readback: startup checklist, generated tasks, resource reservations, KPI targets, and baseline draft persist.

### R2-S2-PROJECT-GANTT-PLANNER

- Route/surface: `/projects/:id/gantt`.
- Primary role: Project Manager / Project Principal.
- Managed object: canonical task schedule projection.
- User goal: plan and replan the project with MS Project-like ergonomics in a web control surface.
- Main layout: custom split WBS grid and timeline, planner toolbar, warning lane, task detail sheet, audit/result footer.
- Signals: dependency loop, date conflict, critical path slip, baseline drift, resource overload, missing participant, stage-gate blocker.
- Primary next action: resolve the currently selected schedule warning or create the next planned task.
- Governed actions: create task, edit dates/duration/work/progress, indent/outdent, create dependency, save baseline, open related resource/KPI/stage control.
- Preview/result: dependency creation, baseline capture, broad date shifts, and conflict resolution require preview; result comes from API readback and refreshes My Tasks, Kanban, Resource Load, KPI signals, and Portfolio where relevant.
- Permission behavior: read-only users keep full planner visibility but see disabled commands with reasons; backend denies direct schedule mutations.
- Reload/readback: WBS order, task dates, dependencies, baseline, warnings, and audit events persist.

## 6. S3 Discovery / Briefing

### R2-S3-BRIEFING-READINESS-CONTROL

- Route/surface: `/projects/:id/briefing`.
- Primary role: Project Manager with Client Representative and Project Principal.
- Managed object: briefing inputs, source data, decisions, approval gate.
- User goal: move from vague input to approved brief without losing unresolved assumptions.
- Main layout: source-data register, decision log, readiness checklist, stage-gate panel, action/result footer.
- Signals: missing source data, unresolved requirement, expired client decision, blocked approval.
- Primary next action: request or assign the most critical missing input.
- Governed actions: request source data, create follow-up task, create approval request, assign unresolved requirement owner, mark blocker, approve stage gate.
- Preview/result: approval and blocker actions show consequence and affected next stage before apply; result shows gate status and audit id.
- Permission behavior: client-facing roles can respond to requests where configured; internal approvals remain permission-checked.
- Reload/readback: source-data state, decision log, approval status, tasks, and audit events persist.

## 7. S4 Concept / Preliminary Design

### R2-S4-CONCEPT-STAGE-CONTROL

- Route/surface: `/projects/:id/stages/concept`.
- Primary role: Stage Lead with Project Principal.
- Managed object: concept-stage tasks, artifacts, reviews, KPI/resource signals.
- User goal: produce and approve the concept package with controlled rework.
- Main layout: stage progress strip, artifact review area, task board excerpt, quality/KPI signal cards, recommended action panel.
- Signals: late concept package, artifact rejected, quality conflict, rework overdue, resource overload.
- Primary next action: approve artifact or create governed rework action based on the active signal.
- Governed actions: create rework task, approve/reject artifact, escalate quality conflict, open Gantt, adjust plan, request client decision.
- Preview/result: artifact rejection and plan adjustment require preview with affected tasks/stage gate; result links corrective action/audit.
- Permission behavior: Stage Lead can propose/execute stage actions; Project Principal can approve/escalate; read-only users see trace.
- Reload/readback: artifact status, rework tasks, stage gate state, and signal handling persist.

## 8. S5 Design Development / Visualization / Estimate

### R2-S5-DEVELOPMENT-ESTIMATE-CONTROL

- Route/surface: `/projects/:id/stages/design-development`.
- Primary role: Stage Lead with Estimator / Analyst.
- Managed object: detailed design tasks, visualization tasks, estimate/cost model, package approval.
- User goal: drive developed design and estimate work to an approved package.
- Main layout: package readiness summary, task/resource grid, estimate panel, artifact/approval panel, signal/action rail.
- Signals: estimate missing, visualization blocker, resource overload, package approval blocked, cost/margin deviation.
- Primary next action: create estimate/review task or resolve the blocking deviation.
- Governed actions: reassign overloaded specialist, split/shift work, create estimate task, create review task, approve/reject deliverable, escalate blocker.
- Preview/result: reassign/split/shift and approval decisions require preview; result refreshes Gantt, Resource Load, KPI Deviation, and artifact status.
- Permission behavior: estimators can update estimate inputs where allowed; approvals remain governed by stage/quality roles.
- Reload/readback: estimate state, package approval, workload changes, and audit result persist.

## 9. S6 Detailed Production / Working Documentation

### R2-S6-PRODUCTION-DELIVERY-CONTROL

- Route/surface: `/projects/:id/production`.
- Primary role: Stage Lead / Discipline Lead.
- Managed object: production task packages, documentation deliverables, quality checklist.
- User goal: keep production work moving through tasks, reviews, quality checks, and approvals.
- Main layout: package/workstream overview, Kanban/WBS slice, quality checklist, blocker list, action/result panel.
- Signals: overdue production task, failed quality checklist, missing approval, blocked dependency, final estimate missing.
- Primary next action: resolve the blocking task or request approval.
- Governed actions: create/reassign production task, mark task for rework, open Gantt and adjust dependencies, resolve overload, request approval, escalate quality issue.
- Preview/result: dependency adjustment, reassign, and rework creation require preview; result refreshes My Work, Kanban, Gantt, and quality status.
- Permission behavior: specialists update their work; Stage Lead/Quality Lead govern reviews and rework.
- Reload/readback: task status, quality checklist, approval state, and audit event persist.

### R2-S6-MY-WORK-CONTROL

- Route/surface: `/work/my-tasks`.
- Primary role: Specialist.
- Managed object: canonical task assignments.
- User goal: execute assigned work with clear status, blockers, and review path.
- Main layout: personal work queue, task detail sheet, status/action bar, related project context.
- Signals: overdue task, blocked task, review requested, missing input, dependency conflict.
- Primary next action: update the selected task to the next allowed status or raise blocker.
- Governed actions: start task, complete task, request review, add blocker, comment, open linked Gantt/project.
- Preview/result: status changes with downstream consequences show affected projection before apply where material; result refreshes Kanban/Gantt/project overview.
- Permission behavior: participants mutate only allowed task fields; read-only observers see context.
- Reload/readback: status, comments, blocker, and audit trail persist.

## 10. S7 Parallel Discipline Packages

### R2-S7-PARALLEL-PACKAGE-CONTROL

- Route/surface: `/projects/:id/parallel-packages`.
- Primary role: Discipline Lead with Project Principal.
- Managed object: parallel package tasks, dependencies, integration checklist.
- User goal: coordinate discipline packages without breaking the main project plan.
- Main layout: package board, dependency map, integration checklist, resource/schedule signals, action panel.
- Signals: package dependency conflict, missing discipline lead, integration blocker, quality/review issue, resource overload.
- Primary next action: assign package owner or preview dependency adjustment.
- Governed actions: create package tasks, adjust dependencies, assign/reassign discipline lead, approve/reject package, escalate integration blocker.
- Preview/result: dependency and package-owner changes require preview with affected main-stage tasks; result refreshes Gantt and project delivery controls.
- Permission behavior: Discipline Lead manages package scope; Project Principal governs integration and escalation.
- Reload/readback: package state, dependencies, approvals, and audit event persist.

## 11. S8 Delivery, Closure, And Retrospective

### R2-S8-CLOSURE-CONTROL

- Route/surface: `/projects/:id/closure`.
- Primary role: Project Manager with Project Principal.
- Managed object: closure checklist, final artifacts, final KPI values, snapshot.
- User goal: close the project only when delivery, approvals, and final metrics are traceable.
- Main layout: closure readiness checklist, final artifact/approval panel, final KPI panel, snapshot preview, action/result area.
- Signals: open critical task, missing final approval, unpaid/admin blocker, final KPI missing, snapshot warning.
- Primary next action: preview project closure or resolve the top closure blocker.
- Governed actions: create final rework task, capture final KPI, close project, archive project, accept closure risk.
- Preview/result: closure requires snapshot preview with immutable facts and open risks; result shows closed snapshot id, audit id, and closed portfolio link.
- Permission behavior: only authorized roles close; read-only users see blockers and snapshot preview when allowed.
- Reload/readback: closure status, snapshot, final KPI, and audit evidence persist.

### R2-S8-CLOSED-PORTFOLIO-RETROSPECTIVE

- Route/surface: `/retrospectives/closed-portfolio`.
- Primary role: Executive / Tenant leadership.
- Managed object: immutable closed-project snapshots and trend signals.
- User goal: turn closed-project evidence into process and template improvement.
- Main layout: closed portfolio grid, trend cards, insight panel, source snapshot drill-down, improvement action preview/result.
- Signals: recurring delay, recurring overload, quality/rework trend, KPI drift, template weakness.
- Primary next action: preview a template/process improvement from the selected insight.
- Governed actions: create retrospective action, apply template improvement, send improvement for review, mark insight handled.
- Preview/result: improvement preview shows affected future templates and confirms active history is not silently rewritten; result writes audit and refreshes tenant config projection.
- Permission behavior: executives read trends; Tenant Admin applies template changes; backend denies direct mutation without permission.
- Reload/readback: snapshots remain immutable; handled insight and future template version persist.

## 12. Cross-Cutting Control Surfaces

### R2-X-RESOURCE-LOAD-CONTROL

- Route/surface: `/resources/load`.
- Primary role: Resource Manager.
- BP coverage: S0, S2, S5, S6, S7.
- Managed object: capacity calendars, assignments, reservations, load buckets, overload signals.
- Management loop: load projection -> overload signal -> resolution action -> dry-run -> apply -> audit -> refreshed load.
- Primary next action: preview recommended overload resolution.
- Governed actions: shift work, split work, reassign work, reserve capacity, accept overload with reason.
- Required readback: before/after load buckets, affected assignments/reservations, audit/action evidence, reload persistence.

### R2-X-KPI-DEVIATION-CONTROL

- Route/surface: `/kpi/deviations`.
- Primary role: Executive / Project Principal.
- BP coverage: S2 through S8.
- Managed object: KPI evaluations, threshold breaches, control signals.
- Management loop: KPI evaluation -> deviation signal -> corrective/risk action -> preview -> execution result -> audit -> refreshed signal.
- Primary next action: create corrective action or accept risk with reason.
- Governed actions: create corrective task, request explanation, escalate, accept deviation, update future KPI recommendation.
- Required readback: source formula/version, threshold rule, signal trace, action execution, audit evidence.

### R2-X-PORTFOLIO-CONTROL

- Route/surface: `/control/portfolio`.
- Primary role: Executive / PMO.
- BP coverage: S1 through S8.
- Managed object: active portfolio with schedule/resource/KPI/lifecycle signals.
- Management loop: portfolio projection -> prioritized control signals -> recommended portfolio action -> preview -> execution -> audit -> refreshed portfolio.
- Primary next action: execute the highest-severity recommended management action or accept risk explicitly.
- Governed actions: create corrective action, open Gantt, resolve resource overload, escalate, accept risk, request explanation.
- Required readback: signal handling state, action execution result, related project/schedule/resource refresh.

### R2-X-ACTION-AUDIT-CONTROL

- Route/surface: action/audit side panel available from every management plane.
- Primary role: Controller / authorized manager.
- BP coverage: all stages and cross-cutting process.
- Managed object: management action execution and audit trail.
- Management loop: action result -> trace source signal/entity -> inspect before/after -> confirm projection refresh.
- Primary next action: open source surface or copied evidence link.
- Governed actions: no business mutation; only inspect, export/copy permitted evidence where authorized.
- Required readback: actor, permission decision, command type, source surface, source signal, before/after, result, timestamp.

### R2-X-TENANT-CONFIGURATION-CONTROL

- Route/surface: `/admin/tenant/configuration`.
- Primary role: Tenant Admin.
- BP coverage: process-template rules and all stage templates.
- Managed object: role templates, stage templates, artifact templates, KPI thresholds, action definitions, saved views.
- Management loop: draft configuration -> validation signal -> impact preview -> publish governed version -> audit -> runtime readback.
- Primary next action: validate and preview draft impact.
- Governed actions: publish labels, process templates, fields, KPI thresholds, saved views, action availability, import/export config.
- Required readback: version id, affected runtime surfaces, immutable active-project history policy, audit evidence.

### R2-X-INTEGRATION-IMPORT-CONTROL

- Route/surface: `/admin/integrations/import`.
- Primary role: Integration Admin.
- BP coverage: S0 and canonical-project continuity after import.
- Managed object: adapter connection, external mapping, canonical import batch.
- Management loop: external payload -> validation/conflict signal -> import preview -> apply -> mapping/audit -> canonical readback.
- Primary next action: run import preview.
- Governed actions: preview import, apply import, repair mapping, retry safe failure, inspect diagnostics.
- Required readback: idempotency key, external mapping, canonical opportunity/project/task readback, safe failure audit.

## 13. Release 2 Acceptance For UI Specs

Release 2 UI implementation may start only when:

- every BP stage S0-S8 has at least one specified management plane;
- every cross-cutting dimension has a specified management plane;
- every report-like surface has signal, action, preview, result, audit, readback, and reload rules;
- modal/drawer/panel specs exist for risky actions;
- the screen matrix verifier passes;
- future implementation tasks point to exact screen ids and owned interaction flows.
