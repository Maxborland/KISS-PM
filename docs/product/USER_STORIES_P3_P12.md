# User Stories P3-P12

## Tenant Admin

As a Tenant Admin, I want to configure labels, roles, taxonomies, custom fields, KPI thresholds, and saved views, so that KISS PM fits the tenant operating model without code changes.
Acceptance: changes require tenant admin permission; preview shows runtime impact; saved configuration is visible after reload; audit records actor, before/after, and affected template.
E2E: E2E-060, E2E-061, E2E-062. Screens: UX-P10-TENANT-LABELS, UX-P10-TENANT-TAXONOMIES, UX-P10-CUSTOM-FIELDS, UX-P10-KPI-THRESHOLDS, UX-P10-SAVED-VIEWS. Permissions: tenant.config.write. Audit: required.

## Project Manager / Project Principal

As a Project Manager, I want to turn a qualified CRM opportunity into a project draft, so that delivery planning starts from governed intake data.
Acceptance: opportunity readiness is visible; blockers are explained; project draft creation uses canonical project/task models; result survives reload; audit links opportunity and project.
E2E: E2E-020, E2E-021, E2E-023, E2E-024. Screens: UX-P3-CRM-INTAKE, UX-P3-OPPORTUNITY-DETAIL, UX-P3-FEASIBILITY-PANEL, UX-P3-PROJECT-DRAFT. Permissions: crm.read, project.create. Audit: required.

As a Project Manager, I want to plan work in Project Gantt using canonical tasks, dependencies, and baselines, so that the schedule drives tasks, Kanban, resources, and KPI signals.
Acceptance: WBS/grid and timeline remain synchronized; mutations require task.write; baseline does not drift with live dates; API readback confirms result; audit records source surface.
E2E: E2E-040, E2E-041, E2E-042, E2E-043, E2E-044. Screens: UX-P5-PROJECT-GANTT, UX-P5-GANTT-TASK-PANEL, UX-P5-BASELINE-PANEL. Permissions: project.read, task.write, audit.read. Audit: required.

## Resource Manager

As a Resource Manager, I want to detect overloads and apply governed resolution, so that project plans remain feasible against capacity.
Acceptance: overload signal explains source; resolution preview shows affected assignments and dates; command updates projections after reload; audit records before/after.
E2E: E2E-050, E2E-051. Screens: UX-P6-RESOURCE-LOAD, UX-P6-OVERLOAD-RESOLUTION. Permissions: resource.read, resource.write. Audit: required.

## Executor

As an Executor, I want My Tasks and Kanban to show the same canonical task work, so that I can execute without reconciling duplicate task models.
Acceptance: task status changes update Kanban and My Tasks; unauthorized fields are read-only; reload keeps result; audit records status transitions.
E2E: E2E-033, E2E-034, E2E-041. Screens: UX-P4-MY-TASKS, UX-P4-KANBAN. Permissions: task.read, task.status.write. Audit: required.

## Controller / Approver

As a Controller, I want stage gates to show evidence, blockers, and approve/reject actions, so that lifecycle movement is governed.
Acceptance: gate cannot pass with blocking evidence gaps; approval creates audit; rejection explains recovery; project overview refreshes.
E2E: E2E-030, E2E-031, E2E-032. Screens: UX-P4-PROJECT-OVERVIEW, UX-P4-STAGE-GATE. Permissions: lifecycle.approve. Audit: required.

## Executive / Portfolio Owner

As an Executive, I want KPI and portfolio control surfaces to turn deviations into corrective action or accepted risk, so that management attention leads to traceable decisions.
Acceptance: severity is visible; recommended governed action is primary; risky decisions require reason; audit and refreshed projection are visible.
E2E: E2E-070, E2E-080, E2E-081, E2E-082. Screens: UX-P7-KPI-DEVIATION, UX-P8-PORTFOLIO-CONTROL, UX-P8-CORRECTIVE-ACTION, UX-P8-ACCEPT-RISK, UX-P8-ACTION-AUDIT. Permissions: kpi.read, control.action.write. Audit: required.

## Integration Admin

As an Integration Admin, I want imports and external mappings to be validated before they affect canonical operation, so that external systems remain adapters and not the domain core.
Acceptance: import preview shows conflicts; mapping diagnostics explain recovery; accepted import creates canonical entities; audit records mapping and idempotency key.
E2E: E2E-110, E2E-111. Screens: UX-P11-INTEGRATION-IMPORT, UX-P11-EXTERNAL-MAPPING. Permissions: integration.write. Audit: required.

## Read-only Observer

As a Read-only Observer, I want to inspect project state and control signals without mutation controls, so that stakeholders can understand status without accidental changes.
Acceptance: unavailable actions show permission explanation; backend still denies mutation; reload does not expose write controls.
E2E: E2E-012, E2E-111, E2E-112. Screens: UX-P12-PERMISSION-SMOKE, UX-P12-TENANT-ISOLATION. Permissions: read scopes only. Audit: mutation audit not created.

## Operator/Admin

As an Operator/Admin, I want release readiness, permission, tenant isolation, and recovery smoke surfaces, so that the release gate proves operational readiness.
Acceptance: checks have explicit pass/fail states; failures show recovery; evidence is linked to commands and artifacts.
E2E: E2E-111, E2E-112, E2E-113, E2E-114, E2E-115. Screens: UX-P12-RELEASE-READINESS, UX-P12-PERMISSION-SMOKE, UX-P12-TENANT-ISOLATION, UX-P12-RECOVERY-SMOKE. Permissions: ops.read, ops.execute. Audit: required for recovery commands.
