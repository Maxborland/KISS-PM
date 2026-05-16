# Role-Based Journeys

## 1. CRM User / PM: Opportunity To Active Project

Start state: qualified CRM opportunity exists. Intent: decide whether it can become a project. Screens visited: UX-P3-CRM-INTAKE, UX-P3-OPPORTUNITY-DETAIL, UX-P3-FEASIBILITY-PANEL, UX-P3-PROJECT-DRAFT, UX-P4-PROJECT-OVERVIEW. Decisions: readiness, feasibility, draft creation, activation. Actions: create project draft, resolve blockers, activate project. Audit points: opportunity intake, readiness decision, project creation, lifecycle transition. Success state: active project with canonical entities. Failure/recovery: missing feasibility data blocks draft and points to required fields. E2E: E2E-020, E2E-021, E2E-023, E2E-024, E2E-030.

## 2. PM: Planning Through Gantt And Tasks

Start state: active project exists. Intent: build a plan that drives execution. Screens visited: UX-P4-PROJECT-OVERVIEW, UX-P5-PROJECT-GANTT, UX-P5-GANTT-TASK-PANEL, UX-P5-BASELINE-PANEL, UX-P4-MY-TASKS, UX-P4-KANBAN. Decisions: WBS, dates, work, dependencies, baseline. Actions: create task, update dates, create dependency, capture baseline. Audit points: each schedule command and baseline capture. Success state: canonical tasks appear in Gantt, My Tasks, and Kanban after reload. Failure/recovery: validation issues explain schedule conflict. E2E: E2E-040, E2E-041, E2E-042, E2E-043, E2E-044.

## 3. Executor: Task Execution

Start state: canonical task is assigned. Intent: execute and update status. Screens visited: UX-P4-MY-TASKS, UX-P4-KANBAN, UX-P5-GANTT-TASK-PANEL. Decisions: start, progress, blocked, complete. Actions: change status, add comment, request review. Audit points: status change and participant action. Success state: task state is consistent across views. Failure/recovery: permission state explains unavailable schedule fields. E2E: E2E-033, E2E-034, E2E-041.

## 4. Resource Manager: Overload To Resolution

Start state: overload signal exists. Intent: restore feasible capacity. Screens visited: UX-P6-RESOURCE-LOAD, UX-P6-OVERLOAD-RESOLUTION, UX-P5-PROJECT-GANTT when the schedule project is available. Decisions: reassign, shift dates, create a separate capacity reservation when appropriate, escalate. Actions: run preview, execute resolution command, inspect refreshed load. Audit points: overload signal, preview, command result. Success state: overload reduced or accepted with traceable reason; a reservation that adds demand is not reported as overload resolution. Failure/recovery: command blocked by permissions or schedule constraints. E2E: E2E-050, E2E-051.

## 5. Executive/PM: KPI Deviation To Corrective Action

Start state: KPI deviation detected. Intent: convert signal into decision. Screens visited: UX-P7-KPI-DEVIATION, UX-P8-PORTFOLIO-CONTROL, UX-P8-CORRECTIVE-ACTION, UX-P8-ACCEPT-RISK, UX-P8-ACTION-AUDIT. Decisions: corrective action, escalation, accept risk. Actions: create corrective task or accept risk with reason. Audit points: signal, selected action, command result. Success state: refreshed control surface shows handled deviation. Failure/recovery: missing reason blocks accepted risk. E2E: E2E-070, E2E-080, E2E-081, E2E-082.

## 6. Tenant Admin: Configuration To Runtime Effect

Start state: tenant needs local terminology or fields. Intent: configure safely. Screens visited: UX-P10-TENANT-LABELS, UX-P10-TENANT-TAXONOMIES, UX-P10-CUSTOM-FIELDS, UX-P10-KPI-THRESHOLDS, UX-P10-SAVED-VIEWS. Decisions: label, role, field, threshold, view. Actions: preview impact, save version, inspect affected runtime surface. Audit points: configuration version and before/after. Success state: runtime screens use new tenant configuration after reload. Failure/recovery: invalid config shows affected surfaces. E2E: E2E-060, E2E-061, E2E-062.

## 7. Integration Admin: Import To Canonical Operation

Start state: external data is available. Intent: import without leaking adapter concepts into the core. Screens visited: UX-P11-INTEGRATION-IMPORT, UX-P11-EXTERNAL-MAPPING, UX-P3-PROJECT-DRAFT. Decisions: mapping, conflict strategy, import approval. Actions: preview import, fix mapping, execute import. Audit points: idempotency key, external mapping, canonical entity creation. Success state: canonical opportunity/project data can enter normal flow. Failure/recovery: conflict diagnostics guide mapping repair. E2E: E2E-110, E2E-111.

## 8. Operator/Admin: Release Readiness And Recovery

Start state: release candidate or incident exists. Intent: prove readiness or recover. Screens visited: UX-P12-RELEASE-READINESS, UX-P12-PERMISSION-SMOKE, UX-P12-TENANT-ISOLATION, UX-P12-RECOVERY-SMOKE. Decisions: pass, block, recover. Actions: run smoke, inspect evidence, execute recovery command. Audit points: operator action and recovery result. Success state: release gate has evidence or a concrete blocker. Failure/recovery: failed smoke links to recovery path and impacted scope. E2E: E2E-120, E2E-121, E2E-122.
