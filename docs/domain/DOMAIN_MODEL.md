# KISS PM Domain Model

## 1. Purpose

This document defines the canonical domain model for KISS PM. It is the shared vocabulary for implementation, tests, E2E scenarios, and future architecture decisions.

The model must support one closed loop:

```txt
CRM opportunity
  -> intake and feasibility
  -> project draft / active project
  -> tasks, Gantt, resources, KPI
  -> control signal
  -> governed management action
  -> audit
  -> closure and retrospective learning
```

## 2. Global invariants

- Every tenant-owned entity belongs to exactly one tenant.
- Display labels are configurable tenant data; stable system keys stay in code.
- External system identifiers are stored through explicit mapping objects, not as primary domain identity.
- A project can originate from a CRM opportunity but must continue to function without an external CRM connection.
- There is one canonical task model. Gantt, Kanban, My Tasks, control surfaces, corrective actions, and template-created work use projections of the same task entity.
- Task participation is role-based and may include executor, co-executor, requester, controller, approver, and observer.
- KPI evaluations are traceable to definition, formula version, threshold version, source data, period, and evaluation timestamp.
- Resource overloads are reproducible from assignments, reservations, capacity, calendars, and time buckets.
- Control signals are traceable to the condition that produced them.
- Management actions are permission-checked, auditable, and traceable to actor, source, command, before/after state, and result.
- Closed-project analytics use immutable snapshots where practical.

## 3. Shared primitives

| Entity / value object | Responsibility |
|---|---|
| `Tenant` | Customer organization boundary. |
| `TenantUser` | User membership inside a tenant. |
| `Workspace` | Optional tenant workspace or product area boundary. |
| `ActorContext` | Current user, tenant, access profile, and request metadata. |
| `TenantContext` | Active tenant scope for commands and queries. |
| `AuditEvent` | Append-only evidence for important actions and config changes. |
| `ExternalMapping` | Mapping between canonical entity and external system entity. |
| `DomainEvent` | Internal event emitted by domain/application operations. |

## 4. Tenant and configuration

| Entity | Notes |
|---|---|
| `TenantConfiguration` | Versioned root of tenant runtime configuration. |
| `RoleTemplate` | Stable role key plus tenant label and permissions hints. |
| `ProcessTemplate` | Project lifecycle template containing stage templates and defaults. |
| `StageTemplate` | Configurable stage definition with system key, label, criteria, artifacts, tasks, KPI defaults, and actions. |
| `ArtifactTemplate` | Required or optional deliverable template. |
| `TaskTemplate` | Template for generated canonical tasks. |
| `ApprovalTemplate` | Configurable approval requirement. |
| `CustomFieldDefinition` | Tenant-defined field schema and validation. |
| `FeatureFlag` | Tenant or environment feature switch. |

Configuration that affects runtime behavior must be versioned. Runtime entities store the template version used when they were created or changed.

## 5. Access control

| Entity | Notes |
|---|---|
| `AccessProfile` | Named permission profile for a tenant. |
| `Permission` | Stable action key such as `project.task.create`. |
| `ScopeRule` | Scope such as own, team, department, project, tenant, or all. |
| `PolicyEvaluation` | Result of permission evaluation. |
| `PolicyTrace` | Explanation used for admin diagnostics and tests. |

Access checks must run in application/API layers and action execution, not only by hiding UI controls.

## 6. CRM intake

| Entity | Notes |
|---|---|
| `ClientAccount` | Organization or person receiving delivery. |
| `ClientContact` | Contact linked to an account and opportunities. |
| `Opportunity` | Potential project before authorization. |
| `OpportunityStage` | Tenant-configurable CRM/intake stage. |
| `ProjectIntake` | Controlled intake process for an opportunity. |
| `DemandProjection` | Estimated demand by stage, role, period, and confidence. |
| `CapacityAssessment` | Feasibility result against resource capacity/reservations. |
| `IntakeBlocker` | Missing data, template, capacity, confidence, or risk condition. |
| `IntakeDecision` | Proceed, request data, reserve capacity, defer, reject, or accept risk. |

## 7. Project lifecycle and work

| Entity | Notes |
|---|---|
| `Project` | Delivery obligation owned by a tenant. |
| `ProjectStage` | Runtime stage instantiated from a stage template. |
| `ProjectArtifact` | Runtime deliverable or evidence item. |
| `ApprovalRequest` | Approval workflow item for stage/artifact/decision. |
| `ProjectBaseline` | Approved plan snapshot or baseline reference. |
| `Task` | Canonical work item for all views and sources. |
| `TaskParticipant` | User/resource participation with role and scope. |
| `TaskDependency` | Dependency between canonical tasks. |
| `TaskComment` | Discussion attached to task. |
| `TaskChecklistItem` | Task-level checklist item. |
| `TaskStatusHistory` | Auditable status/progress changes. |
| `CorrectiveAction` | Task/action pattern created to resolve a signal or deviation. |

Task source examples:

- manual;
- template-generated;
- CRM intake action;
- Gantt edit;
- Kanban/My Tasks;
- resource-resolution action;
- KPI deviation action;
- control-surface action.

## 8. Scheduling

| Entity | Notes |
|---|---|
| `SchedulePlan` | Project schedule projection over canonical tasks. |
| `WbsNode` | Hierarchical planning node backed by project stage or task. |
| `ScheduleDependency` | Dependency type, lag, and validation metadata. |
| `BaselineSnapshot` | Immutable or versioned schedule baseline values. |
| `ScheduleCalculationResult` | Deterministic output of schedule validation/calculation. |

MVP scheduling supports WBS, planned start/finish, duration, planned work, progress, basic Finish-to-Start dependency, and baseline fields. Advanced MS Project parity is future scope unless a phase document brings it in.

## 9. Resource planning

| Entity | Notes |
|---|---|
| `ResourceProfile` | Person, role, team, skill, or capacity unit. |
| `ResourceCalendar` | Working time, exceptions, and availability rules. |
| `ResourceCapacity` | Available capacity by resource and period. |
| `ResourceReservation` | Capacity held for opportunity/project/stage. |
| `ResourceAssignment` | Planned work allocation tied to canonical task or reservation. |
| `ResourceLoadBucket` | Calculated load for a period. |
| `ResourceOverload` | Detected overload or capacity shortage. |
| `ResolutionPreview` | Dry-run result for shift/split/reassign/reserve actions. |

## 10. KPI and control signals

| Entity | Notes |
|---|---|
| `KpiDefinition` | Metric definition, entity type, owner role, unit, and available actions. |
| `FormulaDefinition` | Safe constrained formula expression and source bindings. |
| `ThresholdRule` | Rule that maps evaluation values to severity. |
| `KpiEvaluation` | Versioned metric result with source trace. |
| `ControlSignal` | Detected condition that requires attention or action. |
| `Deviation` | Specialized control signal for KPI/resource/schedule variance. |
| `ManagementDecision` | Decision record such as accepted risk/deviation. |

## 11. Control surfaces

| Entity | Notes |
|---|---|
| `ControlSurfaceDefinition` | Configurable management instrument definition. |
| `ControlSurfaceView` | Table, board, Gantt, timeline, heatmap, cards, dashboard, or hybrid view. |
| `ControlSurfaceWidget` | KPI card, summary, filter, chart, or operational widget. |
| `ControlSurfaceFilter` | Saved or default filtering rule. |
| `ControlSurfaceAction` | Action exposed on row/card/widget/bulk/global target. |
| `SavedView` | User/team/tenant saved view state. |

Control surfaces compose operational data and action entrypoints. They delegate mutation to the action engine.

## 12. Action engine and audit

| Entity | Notes |
|---|---|
| `ActionDefinition` | Configured action metadata, required permission, schema, and binding. |
| `ActionPrecondition` | Required state before an action can run. |
| `ActionExecution` | Attempt to run an action. |
| `ActionExecutionLog` | Append-only result, before/after summary, and audit links. |
| `CommandBinding` | Mapping from action definition to application command. |

## 13. Retrospective analytics

| Entity | Notes |
|---|---|
| `ProjectSnapshot` | Closure snapshot of project, tasks, KPI, resource, and key metrics. |
| `RetrospectiveInsight` | Pattern or finding derived from closed projects. |
| `TemplateImprovementAction` | Governed action to improve future templates/KPI/processes. |

## 14. Entity lifecycle summary

```txt
Opportunity
  -> ProjectIntake
  -> DemandProjection / CapacityAssessment
  -> Project draft
  -> Active Project
  -> ProjectStage / Task / Schedule / ResourceAssignment
  -> KpiEvaluation / ControlSignal
  -> ActionExecution / AuditEvent
  -> ProjectSnapshot
  -> RetrospectiveInsight / TemplateImprovementAction
```

