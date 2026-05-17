# Release 2 Control Surface Action Specs

Updated: 2026-05-17

## 1. Control Surface Rule

Every report-like screen is a control surface when it participates in management:

```txt
projection -> signal -> governed action -> preview -> result -> audit -> refreshed projection
```

The surface may be visually presented as a table, board, timeline, Gantt, heatmap, checklist, card grid, or closed-portfolio analysis view. The behavior contract is the same.

## 2. Required Action Definition Fields

Every Release 2 action definition must specify:

- stable action key;
- user-facing Russian label;
- source surface id;
- source signal type;
- target entity type;
- required permission;
- preconditions;
- input schema;
- preview behavior;
- execution command binding;
- audit policy;
- projection refresh targets;
- denial behavior;
- stale-preview behavior;
- cleanup/reset expectation for tests.

## 3. Action Families

### Intake And Authorization Actions

- `intake.request_missing_data`: creates a traceable request from opportunity readiness.
- `intake.run_demand_estimate`: calculates non-mutating demand projection.
- `resource.reserve_capacity`: reserves capacity from opportunity/project source after preview.
- `project.create_draft_from_opportunity`: creates canonical draft after feasibility preview.
- `project.activate_from_authorization`: creates/activates project, roles, startup tasks, and audit.

### Planning And Schedule Actions

- `project.generate_stage_tasks`: creates canonical task set from process template.
- `schedule.create_task`: creates canonical task visible in Gantt/My Work/Kanban.
- `schedule.update_task_dates`: updates schedule fields after validation/preview.
- `schedule.create_dependency`: creates dependency after loop/conflict preview.
- `schedule.capture_baseline`: captures immutable baseline snapshot.
- `schedule.adjust_dependencies`: used by Gantt and Parallel Package Control.

### Stage, Artifact, And Quality Actions

- `stage.request_source_data`: creates request/task for missing briefing data.
- `stage.approve_gate`: advances or unlocks stage after evidence check.
- `stage.reject_gate`: blocks stage with reason and next action.
- `artifact.approve`: accepts deliverable/artifact.
- `artifact.reject_with_rework`: rejects artifact and creates rework task.
- `quality.escalate_issue`: escalates unresolved quality conflict.

### Resource Actions

- `resource.shift_work`: shifts work to reduce overload.
- `resource.split_work`: splits work across periods/resources.
- `resource.reassign_work`: changes assignment after permission/precondition check.
- `resource.accept_overload`: records accepted overload/risk with reason and review date.

### KPI, Portfolio, And Risk Actions

- `control.create_corrective_action`: creates corrective action/task from signal.
- `control.request_explanation`: requests owner explanation for deviation.
- `control.escalate`: escalates severe signal to accountable role.
- `risk.accept`: accepts risk/deviation with reason.
- `portfolio.open_gantt`: drill-down action, not mutation.

### Closure And Retrospective Actions

- `closure.capture_final_kpi`: writes final KPI values through governed command.
- `closure.close_project`: creates immutable closed-project snapshot.
- `retrospective.create_improvement_action`: creates action from trend/insight.
- `tenant_config.apply_template_improvement`: publishes future template version without rewriting active history.

### Tenant Configuration Actions

- `tenant_config.validate_draft`: non-mutating validation.
- `tenant_config.preview_impact`: non-mutating affected-object preview.
- `tenant_config.publish_version`: publishes active configuration version.
- `tenant_config.import_package`: previews and applies import through governed command.
- `tenant_config.disable_action`: changes action availability through versioned config.

### Integration Actions

- `integration.preview_import`: non-mutating import preview.
- `integration.apply_import`: idempotent canonical import apply.
- `integration.repair_mapping`: fixes mapping with audit.
- `integration.retry_failure`: retries safe adapter failure path.

## 4. Projection Refresh Requirements

Action execution must declare the projections to refresh. Examples:

- Project activation refreshes CRM intake, project overview, startup control, resource load, audit.
- Gantt date change refreshes Gantt, My Work, Kanban, Resource Load, KPI/Portfolio signals.
- Resource overload resolution refreshes Resource Load, Gantt, Portfolio Control, audit.
- KPI corrective action refreshes KPI Deviation, Portfolio Control, My Work, action audit.
- Closure refreshes Project Overview, Closure Control, Closed Portfolio, Retrospective Trends, audit.
- Tenant config publish refreshes affected runtime screens and admin configuration readback.

## 5. Denial And Failure Requirements

Denied or failed actions must:

- not partially mutate business state;
- return typed denial/validation result;
- keep out-of-tenant details hidden;
- leave auditable denial where the action family requires it;
- keep preview id unusable after stale/failed precondition;
- expose retry/refetch path in UI.

## 6. Acceptance

An action family is Release 2-ready only when implementation tasks prove:

- backend permission guard;
- UI permission state;
- direct API denial;
- preview-before-apply where required;
- API/domain readback;
- action/audit evidence;
- projection refresh;
- reload persistence;
- cleanup/reset readback.
