# PRD — KISS PM SaaS Platform for Operational Project Control

## 1. Document status

This PRD defines the greenfield product direction for **KISS PM — Keep It Simple, "Sonny" Project Manager**, a market-ready SaaS platform for project-oriented organizations. It intentionally generalizes the current company-specific business processes and treats the existing BitrixReports prototype as inspiration, not as the architecture to copy.

The product must be built around a closed management-control loop rather than static reporting.

## 2. Global product statement

The product is **KISS PM** — a configurable SaaS platform for operational project control. It helps organizations convert incoming commercial opportunities into controlled projects, plan delivery capacity, manage project schedules and tasks, detect KPI/resource/schedule deviations, execute governed management actions directly from operational instruments, and learn from closed projects.

The system's key distinction is that “reports” are not passive dashboards. They are interactive management instruments that support decisions and controlled actions.


## 2.1 Product name and simplicity principle

**KISS PM** means **Keep It Simple, "Sonny" Project Manager**.

The name defines a product constraint: the system must support complex project-control work while keeping ordinary workflows simple.

This does not mean reducing the final product to a small MVP. It means that the product must move complexity into safe engines, templates, presets, previews, validations, and guided actions.

The target user experience:

```txt
I see what needs attention.
I understand the context.
I can choose an allowed action.
The system verifies and records the decision.
I can see whether the action solved the problem.
```

## 3. Product north star

Create a SaaS platform where a client can configure their project lifecycle, roles, KPI rules, control surfaces, and management actions without rewriting the system, while preserving strict auditability, tenant isolation, and a single canonical project/task/resource model.

The target end state:

```txt
A tenant can receive a CRM opportunity, estimate project demand, check capacity, create a project plan, control execution through Gantt/Kanban/resources/KPI, act on deviations from the same management surface, close the project, and feed retrospective insights back into templates — all without custom code for that tenant.
```

The release destination is finite and testable: the product reaches first market readiness only after Phase 12 of the master phase plan, when the full critical E2E journey from tenant configuration and CRM opportunity to project closure and retrospective template improvement passes.

## 4. Problem statement

Project-oriented companies often suffer from the same operational pattern:

- CRM/sales decisions are disconnected from delivery capacity.
- Projects start before resource feasibility is understood.
- Project plans, tasks, reports, and workload views use different data models.
- KPI dashboards show problems but do not help users act on them.
- Managers manually translate deviations into tasks, schedule changes, escalations, or resource decisions.
- Business processes are implemented as custom code, so each new client requires bespoke development.
- Retrospective analytics from closed projects rarely improve future templates and estimates.

The product must solve these problems by building one configurable control loop.

## 5. Target customers

Primary target customers:

- architecture and design studios;
- engineering/project production companies;
- construction design offices;
- consulting/project-delivery organizations;
- internal project offices with recurring project templates;
- service organizations where delivery capacity and project timing must be planned ahead.

The first market template may be architecture/design/project production, but the platform must not hardcode that industry into core logic.

## 6. Core personas

### Executive / Owner

Needs portfolio visibility, profitability/resource risk signals, closed-project trends, and management actions for escalation or strategic decisions.

### Operations / Resource Manager

Needs capacity planning, overload detection, resource reservations, conflict resolution, workload forecasts, and staffing decisions.

### Project Manager / Delivery Coordinator

Needs project intake, project plan, client commitments, stage progress, tasks, approvals, KPI deviations, and corrective actions.

### Project Principal / Project Lead

Owns project quality, stage readiness, team coordination, Gantt plan, acceptance, and escalation decisions.

### Stage Lead / Discipline Lead

Owns a project stage or discipline package, breaks down work, assigns specialists, checks deliverables, and resolves stage-level deviations.

### Specialist / Executor

Works through My Tasks/Kanban, sees responsibilities by role, updates status/progress, comments, time/work where applicable, and responds to rework or approval tasks.

### CRM / Sales User

Creates opportunities, maintains client data, estimates commercial scope, and uses capacity feasibility before committing start dates or delivery windows.

### Tenant Admin / Operations Admin

Configures roles, processes, KPI rules, custom fields, management instruments, access profiles, integrations, and templates.

## 7. Product principles

1. CRM is the project-control entry point.
2. A project is a delivery obligation, not merely a deal or task group.
3. Gantt, Kanban, portfolio, resource planning, and control surfaces must share one canonical task/assignment model.
4. KPI deviations must lead to governed actions, not just visual warnings.
5. All management actions must be auditable.
6. Process, KPI, and control-surface customization must be no-code/low-code and tenant-specific.
7. External integrations are adapters. Internal canonical domain models are the source of truth.
8. Closed projects must produce reusable retrospective signals for future estimation and process improvement.
9. The UI may use familiar labels such as “отчёт”, but the domain model must treat these screens as control surfaces.

## 8. Goals

### MVP goals

- Provide a configurable tenant workspace.
- Provide CRM intake for project opportunities.
- Convert qualified opportunities into project drafts and active projects.
- Support a universal project lifecycle template with configurable stages, roles, artifacts, and approvals.
- Provide a canonical task and assignment model.
- Provide a basic but useful Gantt: WBS, planned start/finish, duration, dependencies, participants, progress, baseline basics.
- Provide My Tasks/Kanban by task relationship: executor, co-executor, requester, controller, approver, observer.
- Provide resource capacity planning and overload detection by period.
- Provide KPI definitions, thresholds, evaluations, deviations/control signals.
- Provide management instruments/control surfaces for portfolio, resource load, KPI deviations, CRM intake, and closed-project retrospectives.
- Allow actions from control surfaces: create task, open Gantt, reassign, shift/split work, reserve capacity, escalate, accept risk/deviation, request explanation.
- Provide access profiles with permission and scope rules.
- Provide audit trail for management actions.
- Provide basic tenant customization: labels, roles, stages, custom fields, KPI thresholds, saved views, control-surface layouts.

### Long-term goals

- Advanced scheduling: calendars, Work/Duration/Units, critical path, resource leveling, constraints, baselines, MSPDI/XML import/export.
- Full process constructor.
- Full control-surface builder.
- Full KPI/formula builder with safe constrained formulas.
- Automation rules and notification rules.
- Integration marketplace.
- Template marketplace for industries.
- AI assistant for analysis, drafting, and guided configuration, without replacing governed actions and audit.


## 8.1 Delivery and acceptance model

KISS PM must be delivered according to `docs/04_MASTER_PHASE_PLAN.md`.

This PRD defines what the product must become. The master phase plan defines how the work reaches that state without collapsing into an endless MVP.

Rules:

- The project has a finite market-release destination.
- Each phase must be detailed immediately before implementation.
- Each phase must have a closed backlog, explicit out-of-scope list, acceptance criteria, and E2E matrix.
- A phase is not done when code exists; a phase is done when the relevant end-to-end management-control flows pass.
- New ideas discovered during a phase go to later planning unless they are required to pass the current phase gate.
- State-changing product behavior must be proven through E2E where practical.

E2E is a product requirement, not just a QA technique. For this system, the critical acceptance evidence is that a user can complete the operational loop from signal to governed action to audited, refreshed state.

## 9. Non-goals for MVP

- Build a generic CRM replacement comparable to Salesforce or Bitrix24.
- Build a full Microsoft Project clone in the first release.
- Allow arbitrary SQL, arbitrary JavaScript, or unsafe custom code in tenant formulas.
- Build a universal BI platform.
- Support every possible industry workflow from day one.
- Implement bespoke tenant-specific logic in code.
- Implement real-time multi-user Gantt collaboration before the core domain and action engine are stable.

## 10. Product modules and requirements

## 10.1 Tenant, workspace, and configuration

The product must support multiple tenants. Each tenant has its own configuration, users, access profiles, labels, custom fields, process templates, KPI definitions, control-surface definitions, and integration settings.

Functional requirements:

- Create and manage tenants/workspaces.
- Configure tenant display labels for roles, stages, statuses, fields, KPI names, and instruments.
- Configure custom fields for CRM opportunity, project, stage, task, resource, artifact, decision, and KPI value.
- Version major configuration objects where runtime behavior depends on them.
- Support safe defaults for the first industry template.

Acceptance criteria:

- A tenant can rename a role or stage without code changes.
- A tenant can add a custom field to a project and use it in a control surface.
- Tenant A cannot access tenant B data through API, UI, search, report/control surface, or integration mapping.

## 10.2 Access control

The system must support configurable access profiles and scopes.

Functional requirements:

- Define access profiles.
- Define boolean permissions and scope permissions.
- Support scope levels such as own, team/subordinates, department/workshop, all.
- Support user overrides.
- Support role/template-based permissions for project and stage contexts.
- Enforce permissions on API and application services, not only in UI.

Acceptance criteria:

- A user without permission cannot execute a control-surface action even if they manually call the API.
- A user with read-only access can open a management instrument but cannot mutate project state.
- Permission evaluation is testable and returns a trace/reason for admin diagnostics.

## 10.3 CRM intake

CRM intake is the first stage of the project-control lifecycle.

Functional requirements:

- Manage clients/accounts and contacts.
- Manage opportunities with pipeline stage, expected value, probability, planned start, desired finish, typology/category, scope hints, and custom fields.
- Match opportunities to project/process templates.
- Estimate projected demand by stage/role using template, historical, or manual parameters.
- Run capacity feasibility analysis for p50/p75-style demand scenarios.
- Show blockers: missing data, missing template, low confidence, insufficient role capacity, conflicting reservations, unrealistic date window.
- Reserve capacity or create a project draft when authorized.
- Convert a won/approved opportunity into an active project.

Acceptance criteria:

- A user can see whether an opportunity is ready for analysis.
- A user can run demand/capacity analysis before creating a project.
- A user can create a project draft from a qualified opportunity.
- The resulting project references the opportunity but does not depend on an external CRM system to function.

## 10.4 Project lifecycle

Projects follow configurable process templates.

Functional requirements:

- Define process templates with stages, roles, required artifacts, task templates, approval flows, entry criteria, exit criteria, and KPI defaults.
- Instantiate a project from a process template.
- Track lifecycle status and current stage(s).
- Allow stages to be sequential, parallel, optional, or conditional.
- Support stage gates and approvals.
- Support artifacts/deliverables and their acceptance state.
- Generate tasks from templates.

Acceptance criteria:

- A project can be created from a tenant process template.
- Stage names and role labels are tenant configurable.
- A stage cannot be completed if required artifacts or approvals are missing unless an authorized override with reason is recorded.

## 10.5 Work management and Kanban

The system must support one canonical task model and multiple views.

Functional requirements:

- Create, update, archive/delete tasks according to permissions.
- Support task hierarchy and relation to project/stage.
- Support participant roles: executor, co-executor, requester, controller, approver, observer.
- Support status, priority, progress, planned dates, actual dates, planned work, actual work, comments, checklists, attachments, and activity history.
- Provide My Tasks view with filters by participant role and status.
- Provide Kanban by status and participant relationship.
- Support tasks created manually, from templates, from control-surface actions, from KPI deviations, and from schedule/resource actions.

Acceptance criteria:

- The same task can appear in Gantt, Kanban, My Tasks, and a control-surface drill-down.
- A user can filter My Tasks by “executor”, “co-executor”, “requester”, and “controller/approver”.
- Task creation source is tracked.

## 10.6 Scheduling and Gantt

The MVP must include a practical Gantt, while advanced MS Project parity is phased.

MVP functional requirements:

- WBS/task hierarchy.
- Planned start and finish.
- Duration.
- Planned work.
- Progress.
- Task participants/assignments.
- Basic Finish-to-Start dependencies.
- Basic baseline fields.
- Open project Gantt from portfolio, project page, CRM/project draft, or control surface.
- Detect obvious scheduling/resource conflicts.

Future functional requirements:

- Work/Duration/Units triangle.
- Multiple dependency types: FS, SS, FF, SF.
- Calendars and exceptions.
- Critical path.
- Resource leveling.
- Constraints.
- Full baseline/version comparison.
- MSPDI/XML import/export.

Acceptance criteria:

- Scheduling calculations are deterministic and covered by unit tests.
- UI Gantt is a view over the canonical task/assignment model.
- Moving or editing a task triggers permission checks and audit where state changes.

## 10.7 Resource planning

The system must forecast and control delivery capacity.

Functional requirements:

- Configure resource profiles, roles, skills/tags, capacity, calendars, availability exceptions.
- Create assignments and reservations.
- Calculate planned load by day/week/month.
- Detect overloads and insufficient role capacity.
- Support planning months ahead.
- Provide options to resolve overloads: shift, split, reassign, reserve, accept risk, escalate.
- Provide a resource-control surface with table/heatmap/timeline views.

Acceptance criteria:

- The system can show a user/team/role load forecast by month.
- A detected overload can be turned into a governed action with audit.
- A resource decision updates affected tasks/assignments/reservations or records accepted risk.

## 10.8 KPI engine

KPI must be configurable, evaluated, and actionable.

Functional requirements:

- Define KPI definitions with entity type, formula, unit, evaluation period, thresholds, owner role, and available actions.
- Use safe constrained formula expressions, not arbitrary executable code.
- Version KPI formulas and thresholds.
- Evaluate KPIs for projects, stages, resources, portfolio, tasks, CRM opportunities, and closed projects where applicable.
- Create control signals/deviations when thresholds are crossed.
- Track severity: normal, attention, critical, or tenant-defined equivalent.

Example KPI definitions:

- schedule variance;
- planned vs actual work;
- resource utilization;
- project margin/economic rate;
- completion progress vs plan;
- overdue approvals;
- capacity feasibility risk;
- customer satisfaction/CSI after closure.

Acceptance criteria:

- A tenant admin can configure KPI thresholds without code changes.
- A KPI evaluation result can be traced to formula, source data, threshold, and period.
- A critical KPI deviation exposes allowed actions based on permissions.

## 10.9 Management instruments / control surfaces

Control surfaces are the product's main differentiator.

Functional requirements:

- Define configurable control surfaces with data source, view type, filters, groupings, widgets, visible fields, severity rules, drill-downs, and actions.
- Support table, Kanban, Gantt, timeline, heatmap, card, and dashboard-style presentations where practical.
- Support saved views per user/team/tenant.
- Support row/card/widget/bulk/global actions.
- Support audit and action logs.
- Support role/scope-based visibility.

Initial control surfaces:

1. CRM Intake Control — opportunities, readiness, demand forecast, capacity fit, blockers, project-draft actions.
2. Portfolio Control — active projects, progress, deadlines, resource risks, KPI deviations, next actions.
3. Project Delivery Control — project stage state, Gantt, tasks, approvals, artifacts, deviations.
4. Resource Load Control — capacity, overloads, reservations, affected projects/tasks, resolution actions.
5. KPI Deviation Control — all active deviations/control signals and corrective actions.
6. My Work Control — user tasks by role/status, controlled tasks, approvals, rework.
7. Closed Projects Retrospective — closed snapshots, plan/fact, trend analysis, lessons, template-improvement actions.

Acceptance criteria:

- A control surface can expose at least one governed action per relevant row/card/signal.
- A user can open project Gantt or create a task directly from a control surface when authorized.
- Control-surface definitions do not contain hidden business logic that should belong to the KPI, scheduling, resource, or action engines.

## 10.10 Action engine

The action engine governs all state-changing actions triggered from control surfaces, workflows, or command UIs.

Functional requirements:

- Define action types and command bindings.
- Validate input schema.
- Check permissions and preconditions.
- Support dry-run/preview for risky actions.
- Execute command in application service.
- Write action execution log.
- Emit domain event where applicable.
- Refresh affected projections/control surfaces.

Acceptance criteria:

- A control-surface button cannot bypass action-engine validation.
- A dry-run can show before/after effects for shift/split/reassign or similar resource actions.
- Every completed action has an audit entry.

## 10.11 Closed-project retrospective

Closed projects must improve future control.

Functional requirements:

- Close a project through a closure workflow.
- Capture closed-project snapshot: lifecycle, dates, planned/factual work, KPI values, financial/economic values, artifacts, quality scores, client satisfaction, deviations, corrective actions, lessons learned.
- Analyze trends by project type, process template, role/team, client, period, and KPI.
- Allow authorized users to create improvement initiatives or update templates based on retrospective findings.

Acceptance criteria:

- Closed-project metrics do not silently change due to future edits of live project data.
- A user can compare plan vs fact for closed projects.
- A retrospective insight can create a governed improvement action.

## 10.12 Integrations

Integrations must map external systems to canonical internal models.

Initial integration families:

- CRM adapters: Bitrix24, AmoCRM, manual/API import.
- Scheduling adapters: MS Project import/export in later phases.
- Communication adapters: email/Slack/Teams in later phases.
- Calendar adapters in later phases.

Functional requirements:

- Store external mappings separately.
- Support idempotent sync.
- Support conflict resolution rules.
- Support integration health/status.
- Never make external IDs the primary internal domain identity.

Acceptance criteria:

- A project can continue to work if an external CRM integration is disconnected.
- External payload fields do not leak into domain code outside adapter/mapping boundaries.

## 11. Initial domain model draft

This is a draft and should be refined in `docs/domain/DOMAIN_MODEL.md`.

```txt
Tenant
TenantUser
AccessProfile
Permission
ScopeRule
CustomFieldDefinition
EntitySchema

ClientAccount
ClientContact
Opportunity
OpportunityStage
CommercialOffer
ProjectIntake
CapacityAssessment
DemandProjection
IntakeDecision

Project
ProjectStage
ProjectLifecycleTemplate
StageTemplate
RoleTemplate
ArtifactTemplate
ProjectArtifact
ApprovalRequest
ProjectBaseline
ProjectSnapshot

Task
TaskParticipant
TaskDependency
TaskComment
TaskChecklistItem
TaskStatusHistory

SchedulePlan
PlanTask
PlanAssignment
Calendar
ResourceCalendar
ResourceProfile
ResourceCapacity
ResourceReservation
ResourceLoadBucket
ResourceOverload

KpiDefinition
FormulaDefinition
ThresholdRule
KpiEvaluation
ControlSignal
Deviation
CorrectiveAction
ManagementDecision

ControlSurfaceDefinition
ControlSurfaceView
ControlSurfaceWidget
ControlSurfaceFilter
ControlSurfaceAction
SavedView

ActionDefinition
ActionExecution
ActionExecutionLog
AuditEvent
Notification
ExternalIntegration
ExternalMapping
```

## 12. Core user journeys

### 12.1 CRM opportunity to project start

1. Sales/CRM user creates or imports an opportunity.
2. System checks required intake fields.
3. User chooses or system suggests a project/process template.
4. System estimates demand by stage and role.
5. System checks capacity windows.
6. User chooses: request more data, reserve capacity, create project draft, defer, or accept risk.
7. When opportunity is approved/won, project draft becomes active project.
8. System generates stages, initial Gantt draft, starting tasks, and control points.

### 12.2 Resource overload resolution

1. Resource Load Control shows overload for a user/role/team/month.
2. User opens affected projects and tasks.
3. System offers shift/split/reassign/reserve/accept/escalate actions.
4. User previews chosen action.
5. System validates permission, preconditions, and effects.
6. User confirms.
7. System applies changes, logs action, updates load/KPI/projections.

### 12.3 KPI deviation correction

1. KPI engine evaluates a project/stage/resource metric.
2. Threshold is crossed and a control signal is created.
3. KPI Deviation Control shows severity, cause, source data, and available actions.
4. User creates corrective action, opens Gantt, requests explanation, escalates, or accepts deviation with reason.
5. System tracks corrective action until closed and reruns control.

### 12.4 Closed-project learning

1. Project passes closure workflow.
2. System creates immutable snapshot.
3. Retrospective control surface compares plan/fact and identifies trends.
4. User creates improvement action or updates template/KPI threshold if authorized.
5. Future estimates and stage templates improve.

## 13. Non-functional requirements

### Security

- Tenant isolation is mandatory.
- Permission checks must exist in backend/application services.
- Sensitive fields must be protected by access policies.
- Audit is mandatory for management actions and administrative configuration changes.

### Reliability

- Domain engines must be deterministic and unit-tested.
- Critical calculations should be reproducible.
- Integration sync must be idempotent where practical.

### Performance

- Control surfaces should support large project portfolios through pagination, virtualization, projections, or precomputed read models.
- Resource planning and KPI evaluation should be batchable and cache-aware.

### Maintainability

- No duplicated task models.
- No UI-embedded formulas.
- No tenant-specific code branches.
- Configuration must be validated and versioned.

### Localization

- UI text starts in Russian.
- Tenant labels must be configurable.
- Code/domain system keys remain stable English identifiers.

## 14. Finite release plan

The product must not be managed as an endless MVP. The complete delivery plan is defined in `docs/04_MASTER_PHASE_PLAN.md`.

This PRD uses the following release interpretation:

```txt
Foundation release
  Phase 0: Product and architecture contract
  Phase 1: Repository, platform, and E2E foundation
  Phase 2: SaaS tenant core and access control

Operational alpha
  Phase 3: CRM intake and opportunity-to-project
  Phase 4: Project lifecycle and work management
  Phase 5: Scheduling and Gantt foundation

Control beta
  Phase 6: Resource planning and conflict resolution
  Phase 7: KPI engine and control signals
  Phase 8: Control surfaces and action engine

Market release candidate
  Phase 9: Closed portfolio and retrospectives
  Phase 10: No-code tenant customization
  Phase 11: Integrations and migration
  Phase 12: Production SaaS hardening and market release
```

Each phase must be detailed before implementation starts. The phase-detail document must include closed tasks, mandatory E2E scenarios, acceptance criteria, verification commands, non-scope, and an exit gate.

E2E is a release requirement, not a final QA activity. Every phase after the repository foundation must prove its critical user flows through E2E.

## 15. Success metrics

Product success:

- Tenants can configure core processes and KPI without code changes.
- At least 80% of common management decisions can be initiated from control surfaces.
- CRM opportunities can be assessed for delivery feasibility before project start.
- Resource overloads can be detected and resolved through governed actions.
- Closed-project retrospectives produce actionable template or process improvements.

Engineering success:

- No duplicated task models for Gantt/Kanban/control surfaces.
- KPI formulas are not embedded in UI components.
- Control surfaces call action commands, not direct mutations.
- Tenant-specific labels and process names are configuration data.
- Core scheduling, KPI, access, resource, and action logic has deterministic tests.

## 16. Open questions

These questions should be resolved in follow-up architecture or product decision records:

1. Which ORM/migration tool is final for PostgreSQL?
2. Which UI design system is final for market SaaS: shadcn/ui, Ant Design, or a hybrid migration path?
3. Which CRM adapter is first for production: Bitrix24, AmoCRM, or internal/manual CRM only?
4. What billing/licensing model is expected: per user, per tenant, per active project, or hybrid?
5. What exact level of formula customization is safe and sufficient for MVP?
6. Which industry template ships first?
7. What data-migration path is required from the current BitrixReports prototype?
8. Which project-planning features are required before market release and which can stay in advanced roadmap?
