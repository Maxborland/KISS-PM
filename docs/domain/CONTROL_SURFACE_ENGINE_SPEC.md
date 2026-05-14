# Control Surface Engine Spec

## 1. Purpose

The control surface engine defines configurable management instruments. A control surface is not a passive report. It must expose operational state, decision points, allowed actions, and audit-backed management flow.

## 2. Core responsibilities

- Define management instruments as data.
- Resolve data sources into stable read DTOs.
- Apply tenant/user filters, scope, and saved views.
- Show control signals, severity, KPI cards, and operational context.
- Expose permitted actions from rows, cards, widgets, bulk selections, or global surface context.
- Delegate state changes to the action engine.
- Refresh read models after action completion.

## 3. Definition model

```txt
ControlSurfaceDefinition
- id
- tenantId
- systemKey
- label
- description
- entityType
- dataSourceKey
- defaultViewType
- availableViewTypes[]
- filters[]
- groupings[]
- visibleFields[]
- widgets[]
- severityRules[]
- actions[]
- drillDownTargets[]
- permissionRequirements[]
- auditPolicy
- savedViewPolicy
- active
- version
```

## 4. Supported view types

- table;
- board;
- calendar;
- timeline;
- Gantt entry;
- heatmap;
- cards;
- dashboard;
- hybrid.

Phase implementations may support view types incrementally, but definitions must not assume a static table-only future.

## 5. Initial control surfaces

| Surface | Main entity | Primary purpose |
|---|---|---|
| CRM Intake Control | Opportunity / ProjectIntake | Readiness, blockers, demand forecast, capacity fit, draft/reservation actions. |
| Portfolio Control | Project | Active project status, deadline/resource/KPI signals, Gantt/action entry. |
| Project Delivery Control | Project / Stage / Task | Stage state, artifacts, approvals, tasks, schedule, deviations. |
| Resource Load Control | ResourceLoadBucket / ResourceOverload | Capacity, overloads, affected work, dry-run resolution. |
| KPI Deviation Control | ControlSignal / Deviation | Traceable KPI/resource/schedule deviations and corrective actions. |
| My Work Control | Task / ApprovalRequest | User work by participant role, approvals, controlled tasks. |
| Closed Projects Retrospective | ProjectSnapshot / RetrospectiveInsight | Plan/fact trends, lessons, template-improvement actions. |

## 6. Data-source contract

Control surface data sources return read models, not mutable aggregates.

```txt
ControlSurfaceQuery
- tenantId
- actorId
- surfaceId
- viewId
- filters
- sort
- pagination
- scope

ControlSurfaceResult
- rows/cards/widgets
- availableActions
- visibleFields
- severitySummary
- pageInfo
- trace
```

Data-source implementations may use projections or optimized queries, but must preserve tenant isolation and permission scope.

## 7. Action exposure rules

An action can be shown only when all are true:

- the surface definition includes the action;
- the actor has the required permission/scope;
- the target entity state satisfies preconditions or can show a disabled reason;
- the action binding exists;
- the action is valid for the current tenant configuration version.

Hidden buttons are not authorization. The action engine must enforce the same or stronger checks at execution.

## 8. Audit behavior

Control surface reads do not normally create audit events. State-changing actions triggered from a control surface must record:

- source control surface;
- source view;
- source row/card/widget or bulk target;
- actor;
- command/action type;
- input summary;
- before/after summary where material;
- result;
- related control signal when applicable.

## 9. KISS PM simplicity rules

- Prefer one clear next action per signal over a wall of buttons.
- Use progressive disclosure for advanced filters and builder options.
- Explain severity and recommended action in operational language.
- Use previews for risky bulk changes, schedule changes, resource changes, and accepted-risk decisions.
- Keep builder/admin concepts away from ordinary user workflows.

## 10. Acceptance rules

- No control surface may mutate business state directly.
- Every row/card action with business impact must route through `ActionDefinition` and `ActionExecution`.
- Every management action must be permission-checked and auditable.
- Control surfaces must use canonical domain models and projections, not duplicate task/project/resource/KPI entities.

