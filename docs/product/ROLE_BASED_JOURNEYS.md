# Role-Based Journeys

## 1. CRM User / PM: Opportunity To Active Project

Start state: qualified CRM opportunity exists. Intent: decide whether it can become a project. Screens visited: UX-P3-CRM-INTAKE, UX-P3-OPPORTUNITY-DETAIL, UX-P3-FEASIBILITY-PANEL, UX-P6-FREE-CAPACITY-CALENDAR when available, UX-P3-PROJECT-DRAFT, UX-P4-PROJECT-OVERVIEW. Decisions: readiness, capacity feasibility, draft creation, activation. Actions: run feasibility, inspect recommended free-capacity windows, reserve capacity through preview when authorized, create project draft, resolve blockers, activate project. Audit points: opportunity intake, feasibility decision, capacity reservation, project creation, lifecycle transition. Success state: active project with canonical entities and capacity decision evidence. Failure/recovery: missing feasibility data or capacity blocker prevents draft and points to required fields. E2E: E2E-020, E2E-021, E2E-022, E2E-023, E2E-024, E2E-030.

## 2. PM: Planning Through Gantt And Tasks

Start state: active project exists. Intent: build a plan that drives execution. Screens visited: UX-P4-PROJECT-OVERVIEW, UX-P5-PROJECT-GANTT, UX-P5-GANTT-TASK-PANEL, UX-P5-BASELINE-PANEL, UX-P4-MY-TASKS, UX-P4-KANBAN, UX-P6-RESOURCE-LOAD when conflicts appear. Decisions: WBS, dates, work, dependencies, baseline, resource conflict handling. Actions: create task, edit active grid cell, update dates, create dependency, capture baseline, preview conflict resolution, inspect refreshed readback. Audit points: each schedule command, baseline capture, resource action, and disabled permission state. Success state: canonical tasks appear in Gantt, My Tasks, Kanban, resource load, and audit after reload. Failure/recovery: validation and preview blockers explain schedule/resource conflict. E2E: E2E-040, E2E-041, E2E-042, E2E-043, E2E-044, E2E-052, E2E-053, E2E-054.

## 3. Executor: Task Execution

Start state: canonical task is assigned. Intent: execute and update status. Screens visited: UX-P4-MY-TASKS, UX-P4-KANBAN, UX-P5-GANTT-TASK-PANEL. Decisions: start, progress, blocked, complete. Actions: change status, add comment, request review. Audit points: status change and participant action. Success state: task state is consistent across views. Failure/recovery: permission state explains unavailable schedule fields. E2E: E2E-033, E2E-034, E2E-041.

## 4. Resource Manager: Overload To Resolution

Start state: overload signal exists. Intent: restore feasible capacity. Screens visited: UX-P6-RESOURCE-LOAD, UX-P6-OVERLOAD-RESOLUTION, UX-P6-FREE-CAPACITY-CALENDAR when planned, UX-P5-PROJECT-GANTT when the schedule project is available. Decisions: reassign, shift dates, split work, reserve capacity, accept risk, escalate. Actions: inspect CapacityMatrix cell drilldown, run preview, execute resolution command, inspect refreshed load/readback. Audit points: overload signal, preview, ActionExecution, AuditEvent, recalculated ResourceLoadBucket. Success state: overload reduced, reserved, or accepted with traceable reason; a reservation that adds demand is not reported as overload resolution. Failure/recovery: command blocked by permissions, schedule constraints, missing capacity, or preview blocker. E2E: E2E-050, E2E-051, E2E-052, E2E-053, E2E-054, E2E-055.

## 5. Executive/PM: KPI Deviation To Corrective Action

Start state: KPI deviation detected. Intent: convert signal into decision. Screens visited: UX-P7-KPI-DEVIATION, UX-P8-PORTFOLIO-CONTROL, UX-P8-CORRECTIVE-ACTION, UX-P8-ACCEPT-RISK, UX-P8-ACTION-AUDIT. Decisions: corrective action, escalation, accept risk, request explanation. Actions: inspect KPI source trace/formula/version, create corrective task or accept risk with reason, verify audit/readback. Audit points: KpiEvaluation, ControlSignal, selected action, ActionExecution, AuditEvent. Success state: refreshed control surface shows handled deviation and related rows reflect action state. Failure/recovery: missing reason, missing permission, or stale signal blocks command. E2E: E2E-061, E2E-062, E2E-063, E2E-071, E2E-073, E2E-075.

## 6. Tenant Admin: Configuration To Runtime Effect

Start state: tenant needs local terminology, fields, thresholds, or repeatable layouts. Intent: configure safely. Screens visited: UX-P10-TENANT-LABELS, UX-P10-TENANT-TAXONOMIES, UX-P10-CUSTOM-FIELDS, UX-P10-KPI-THRESHOLDS, UX-P10-SAVED-VIEWS. Decisions: label, role, field, threshold, saved view, column layout. Actions: preview impact, publish version, inspect affected runtime surface, reset or restore safe default. Audit points: configuration version, before/after, affected surface, runtime readback. Success state: runtime screens use new tenant configuration after reload, and read-only users cannot mutate configuration. Failure/recovery: invalid config shows affected surfaces and no partial mutation. E2E: E2E-090, E2E-091, E2E-092, E2E-093, E2E-094, E2E-095.

## 9. Executive/Retrospective User: Closed Snapshot To Template Improvement

Start state: closed project snapshots exist. Intent: learn from plan/fact and improve future delivery. Screens visited: UX-P9-CLOSED-PORTFOLIO, UX-P9-RETROSPECTIVE-TRENDS, UX-P9-TEMPLATE-IMPROVEMENT, UX-P8-ACTION-AUDIT. Decisions: trend grouping, lesson handling, template-improvement action. Actions: compare current vs previous closed period, inspect snapshot/source trace, create improvement proposal, verify future-template readback. Audit points: closure snapshot, trend source, template-improvement command, ActionExecution, AuditEvent. Success state: snapshot remains immutable and future templates carry the improvement version. Failure/recovery: missing retrospective permission or stale preview blocks mutation. E2E: E2E-080, E2E-081, E2E-082, E2E-083.

## 7. Integration Admin: Import To Canonical Operation

Start state: external data is available. Intent: import without leaking adapter concepts into the core. Screens visited: UX-P11-INTEGRATION-IMPORT, UX-P11-EXTERNAL-MAPPING, UX-P3-PROJECT-DRAFT. Decisions: mapping, conflict strategy, import approval. Actions: preview import, fix mapping, execute import. Audit points: idempotency key, external mapping, canonical entity creation. Success state: canonical opportunity/project data can enter normal flow. Failure/recovery: conflict diagnostics guide mapping repair. E2E: E2E-110, E2E-111.

## 8. Operator/Admin: Release Readiness And Recovery

Start state: release candidate or incident exists. Intent: prove readiness or recover. Screens visited: UX-P12-RELEASE-READINESS, UX-P12-PERMISSION-SMOKE, UX-P12-TENANT-ISOLATION, UX-P12-RECOVERY-SMOKE. Decisions: pass, block, recover. Actions: run smoke, inspect evidence, execute recovery command. Audit points: operator action and recovery result. Success state: release gate has evidence or a concrete blocker. Failure/recovery: failed smoke links to recovery path and impacted scope. E2E: E2E-111, E2E-112, E2E-113, E2E-114, E2E-115.
