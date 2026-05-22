# 30. Phase 5/6: MS Project-class backend planning core

## Статус

Этот документ задает phase-detail contract только для backend planning engine decisions Phase 5 и Phase 6.

Scope меняется относительно раннего Gantt MVP: Phase 5/6 больше не являются фазами Gantt/resource UI. Backend должен сразу закладывать MS Project-class planning engine без import/export MS Project. Gantt, resource matrix, task list, KPI signals и control surfaces являются будущими потребителями engine contract, но их UI/UX, пользовательские страницы и KPI/control implementation не входят в Phase 5/6.

## Product intent

Проблема: если задачи, Gantt, Kanban, My Work, resource matrix и control surfaces будут развиваться как разные CRUD-модели, KISS PM снова получит несколько моделей работы и дорогой будущий rewrite. Phase 5/6 решает только backend engine boundary: одна модель плана, один command path, один расчетный слой.

Пользователь / роль:

- руководитель проекта;
- resource manager;
- исполнитель;
- операционный директор;
- tenant admin, который настраивает правила и роли.

Customer Need:

Пользователь должен получить один управляемый backend-план проекта, где любая задача участвует в сроках, трудоемкости, назначениях, загрузке, зависимостях, baseline, рисках и аудите независимо от того, какой будущий surface вызвал planning command.

Desired outcome:

Backend принимает изменение работы как planning command, пересчитывает schedule/resource read model, показывает validation issues и применяет изменение только через permission-checked, auditable action.

Business value:

- KISS PM становится системой управляемого планирования, а не task tracker с диаграммой.
- Future KPI/control signals получают единый расчетный фундамент, но не реализуются в Phase 5/6.
- Future UI не ломает API: Gantt, resource matrix, task list и scenario panel будут использовать один contract, но их UI не реализуется в Phase 5/6.

Non-goals:

- MSPDI/XML import/export.
- AI/autonomous auto-apply.
- BI-конструктор или произвольный formula engine внутри planning core.
- Поддержка внешних календарей как source of truth.
- Gantt UI, resource matrix UI, task workspace UI или browser E2E этих поверхностей.
- KPI/control surfaces implementation, KPI formulas, control signals и corrective action UX.

## Product decision: task CRUD is a wrapper

В KISS PM нет непланируемых задач.

Любая `Task` принадлежит planning model и участвует в `PlanSnapshot`, даже если сейчас у нее нет зависимостей или назначений. Простое создание задачи через task list, My Work или карточку проекта является удобным фасадом над `PlanningCommand`, а не отдельным обходным CRUD-путем.

Allowed:

- UI может иметь быстрый action "создать задачу".
- API может иметь compatibility endpoint для Phase 4 task creation.
- Application layer может собирать из простого task input команду `task.create`.

Forbidden:

- Прямое изменение дат, work, units, assignments, dependencies, constraints или baseline в обход planning command layer.
- Отдельная модель задач для Kanban/My Work, которая не попадает в `PlanSnapshot`.
- UI-only пересчет Gantt/resource matrix.
- Silent auto-reschedule без explainable preview или audit trail.

## User stories

### US1. Управляемая задача

Как руководитель проекта, я хочу создавать и менять задачу из любого рабочего представления, чтобы план, Gantt, ресурсная загрузка и аудит оставались согласованными.

Acceptance:

- Given active project and authorized actor
- When actor creates task from task list, Gantt or project workspace
- Then backend persists canonical `Task`
- And task appears in planning read model
- And command writes audit event
- And reload returns the same calculated state.

### US2. MS Project-like расчет

Как руководитель проекта, я хочу менять work, duration, units, task type, dependencies, calendars и constraints, чтобы видеть воспроизводимый расчет сроков и предупреждения до применения изменений.

Acceptance:

- Given project plan with tasks and assignments
- When actor previews a planning command
- Then backend returns deterministic calculated dates, critical path/slack, resource impact and validation issues
- And project state is not mutated.

### US3. Ресурсный конфликт

Как resource manager, я хочу видеть перегруз по людям/ролям во времени и получить объяснимые варианты решения, чтобы выбрать управленческий компромисс.

Acceptance:

- Given calculated plan with overload
- When actor requests scenario proposals
- Then backend returns aggressive, balanced and resilient proposals
- And each proposal includes changed tasks, changed assignments, overload hours, finish date, deadline delta, required approvals, risk score and `PlanDelta`.

### US4. Governed apply

Как операционный директор, я хочу применять выбранный сценарий только через права, preconditions и аудит, чтобы план не менялся незаметно.

Acceptance:

- Given previewed proposal
- When authorized actor applies it
- Then application service checks permission and plan version
- And persists authored changes transactionally
- And appends audit event
- And recalculates read model.

## Backend boundaries

### Domain packages

Целевая структура:

```txt
packages/
  project-core/
  scheduling-engine/
  resource-planning/
  planning-scenarios/
  planning-application/
```

Допустимо временно разместить первые модули в `packages/domain/src/planning/*`, если phase implementation пока не выделяет отдельные workspace packages. Даже в этом случае dependency direction должен быть таким:

```txt
planning-application
  -> planning-scenarios
  -> resource-planning
  -> scheduling-engine
  -> project-core types
```

`scheduling-engine` не импортирует API, persistence, React, Hono, Drizzle, access-control, audit или scenario planning.

### project-core

Отвечает за authored project plan state:

- `Project`;
- `Task`;
- `TaskAssignment`;
- `TaskDependency`;
- `ProjectBaseline`;
- `ProjectCalendar`;
- `ResourceCalendar`;
- `CalendarException`;
- `ResourceReservation`;
- `PlanVersion`.

`project-core` не считает сценарии и не принимает HTTP decisions.

### scheduling-engine

Чистый deterministic module.

Input:

- `PlanSnapshot`;
- расчетные options: дата расчета, timezone/calendar policy, horizon limits.

Output:

- `CalculatedPlan`;
- `CalculatedTask`;
- `CalculatedDependency`;
- `CriticalPathResult`;
- `ValidationIssue[]`;
- `ScheduleTrace`.

Обязательный scope:

- task types:
  - `fixed_units`;
  - `fixed_work`;
  - `fixed_duration`;
- `effortDriven`;
- `Work = Duration * Units`;
- dependency types:
  - `FS` / `ОН` / finish-to-start;
  - `FF` / `ОО` / finish-to-finish;
  - `SF` / `НО` / start-to-finish;
  - `SS` / `НН` / start-to-start;
- lag/lead;
- project calendars;
- resource calendars;
- calendar exceptions;
- constraints:
  - `as_soon_as_possible`;
  - `start_no_earlier_than`;
  - `finish_no_later_than`;
  - `must_start_on`;
  - `must_finish_on`;
- CPM:
  - earliest start/finish;
  - latest start/finish;
  - total slack;
  - critical path flag;
- validation:
  - circular dependencies;
  - impossible constraints;
  - negative or zero work/duration/units where forbidden;
  - assignment without resource;
  - schedule outside project bounds;
  - calendar has no working time in required interval.

### resource-planning

Чистый расчетный module поверх calculated schedule and resource inputs.

Input:

- `CalculatedPlan`;
- resource profiles;
- capacity calendars;
- availability exceptions;
- reservations;
- grouping options.

Output:

- `ResourceLoadMatrix`;
- `ResourceLoadBucket[]`;
- `ResourceOverload[]`;
- `FreeCapacityBucket[]`;
- drilldown rows for tasks/reservations/absence/conflict reasons.

Required buckets:

- day;
- week;
- month.

Required dimensions:

- person;
- role/position;
- team/department when available;
- project.

### planning-scenarios

Proposal layer over scheduling and resource planning.

Input:

- `PlanSnapshot`;
- `ScenarioRiskProfile`;
- target conflict or deadline pressure;
- allowed operations.

Output:

- `ScenarioProposal[]`.

Required proposal profiles:

- `aggressive`;
- `balanced`;
- `resilient`.

Allowed `PlanDelta` operations:

- shift task;
- split work;
- reassign resource;
- change units;
- change duration;
- reserve capacity;
- move deadline;
- accept overload risk with reason.

Scenario planning never mutates project state.

### planning-application

Application services own:

- actor/session resolution;
- permission checks;
- idempotency keys where needed;
- plan version precondition;
- command validation;
- transaction boundary;
- audit events;
- recalculation trigger;
- API DTO mapping.

## Canonical types

### PlanSnapshot

`PlanSnapshot` is immutable input for calculations:

```ts
type ProjectSourceType = "opportunity" | "workspace_inbox" | "manual";

type PlanProject = {
  id: string;
  sourceType: ProjectSourceType;
  sourceOpportunityId: string | null;
  plannedStart: string;
  plannedFinish: string;
  deadline: string | null;
  calendarId: string | null;
};

type PlanSnapshot = {
  tenantId: string;
  projectId: string;
  planVersion: number;
  project: PlanProject;
  tasks: PlanTask[];
  assignments: PlanAssignment[];
  dependencies: PlanDependency[];
  baselines: PlanBaseline[];
  calendars: PlanCalendar[];
  calendarExceptions: PlanCalendarException[];
  resources: PlanResource[];
  reservations: PlanReservation[];
  constraints: PlanConstraint[];
  capturedAt: string;
};
```

### PlanTask

```ts
type TaskType = "fixed_units" | "fixed_work" | "fixed_duration";
type SchedulingMode = "auto" | "manual";

type WorkingInstant = {
  date: string;
  minuteOfDay: number;
};

type PlanTask = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  title: string;
  statusId: string;
  schedulingMode: SchedulingMode;
  taskType: TaskType;
  effortDriven: boolean;
  plannedStart: string | null;
  plannedFinish: string | null;
  plannedStartInstant?: WorkingInstant | null;
  plannedFinishInstant?: WorkingInstant | null;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  calendarId: string | null;
  constraint: PlanConstraint | null;
};
```

Date-only fields are presentation labels and compatibility fields. Scheduling math, dependency lag/lead, FS/SS/FF/SF alignment and resource allocation use `WorkingInstant`.

### PlanAssignment

```ts
type PlanAssignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: "executor" | "co_executor" | "controller" | "approver" | "observer";
  unitsPermille: number;
  workMinutes: number | null;
  calendarId: string | null;
};
```

`unitsPermille` uses integer math: 1000 = 100%, 500 = 50%.

### PlanDependency

```ts
type DependencyType = "FS" | "SS" | "FF" | "SF";

type PlanDependency = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
  lagMinutes: number;
};
```

`lagMinutes` may be negative for lead.

### CalculatedPlan

```ts
type CalculatedPlan = {
  tenantId: string;
  projectId: string;
  planVersion: number;
  engineVersion: string;
  calculatedAt: string;
  tasks: CalculatedTask[];
  dependencies: CalculatedDependency[];
  projectFinish: string | null;
  criticalPathTaskIds: string[];
  validationIssues: ValidationIssue[];
};
```

`CalculatedTask` must expose date labels and `WorkingInstant` values for calculated, earliest and latest start/finish. CPM and resource planning must use the instant fields, not date-only strings.

### Project source

Not every planning container is created from a CRM opportunity. `Project` must distinguish source type explicitly:

```ts
type ProjectSourceType = "opportunity" | "workspace_inbox" | "manual";
```

Rules:

- opportunity-sourced projects keep `sourceOpportunityId`;
- `workspace_inbox` projects have `sourceOpportunityId = null`;
- each tenant has at most one active `workspace_inbox` planning project;
- task-list or My Work creation without explicit project resolves to that tenant's `workspace_inbox` project instead of creating a non-planning task store or fake opportunity.

## API contract

API should expose planning surfaces, not Gantt-only surfaces.

### Read model

```txt
GET /api/workspace/projects/:projectId/planning/read-model
```

Returns:

- authored project summary;
- calculated tasks;
- dependencies;
- assignments;
- baseline comparison;
- resource load summary;
- validation issues;
- plan version;
- engine version.

### Preview command

```txt
POST /api/workspace/projects/:projectId/planning/preview-command
```

Request:

```ts
type PreviewPlanningCommandRequest = {
  command: PlanningCommand;
  clientPlanVersion: number;
};
```

Response:

- `before`;
- `after`;
- `planDelta`;
- `validationIssues`;
- `permissionPreview`;
- `auditPreview`.

Must not persist authored state.

### Apply command

```txt
POST /api/workspace/projects/:projectId/planning/apply-command
```

Request:

```ts
type ApplyPlanningCommandRequest = {
  command: PlanningCommand;
  clientPlanVersion: number;
  idempotencyKey?: string;
};
```

Response:

- applied `PlanDelta`;
- new `planVersion`;
- recalculated read model summary;
- audit event id.

### Scenario proposals

```txt
POST /api/workspace/projects/:projectId/planning/scenario-proposals
POST /api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply
```

Scenario apply requires:

- existing non-expired proposal id backed by stored proposal snapshot, or complete signed proposal payload;
- actor permission;
- current plan version;
- proposal `planVersion`, `engineVersion` and target conflict still matching current project state;
- accepted risk reason when proposal includes overload/risk acceptance.

`proposalId` apply must never regenerate a proposal from current inputs and apply the newly generated result under an old id. The backend must either persist `planning_scenario_runs` with proposal payload hash, expiry and source `PlanSnapshot` metadata, or require a signed proposal payload that carries the same integrity fields.

## PlanningCommand union

All plan mutations go through this union:

```ts
type PlanningCommand =
  | { type: "task.create"; payload: CreateTaskPayload }
  | { type: "task.update_identity"; payload: UpdateTaskIdentityPayload }
  | { type: "task.update_schedule"; payload: UpdateTaskSchedulePayload }
  | { type: "task.update_work_model"; payload: UpdateTaskWorkModelPayload }
  | { type: "task.update_status"; payload: UpdateTaskStatusPayload }
  | { type: "task.move_wbs"; payload: MoveTaskWbsPayload }
  | { type: "task.delete_or_archive"; payload: DeleteOrArchiveTaskPayload }
  | { type: "dependency.upsert"; payload: UpsertDependencyPayload }
  | { type: "dependency.delete"; payload: DeleteDependencyPayload }
  | { type: "assignment.upsert"; payload: UpsertAssignmentPayload }
  | { type: "assignment.delete"; payload: DeleteAssignmentPayload }
  | { type: "baseline.capture"; payload: CaptureBaselinePayload }
  | { type: "calendar.exception.upsert"; payload: UpsertCalendarExceptionPayload }
  | { type: "constraint.update"; payload: UpdateConstraintPayload }
  | { type: "resource.reserve"; payload: ReserveResourcePayload }
  | { type: "risk.accept_overload"; payload: AcceptOverloadRiskPayload }
  | { type: "project.deadline.move"; payload: MoveProjectDeadlinePayload };
```

Compatibility task CRUD endpoints may remain, but must translate into this union internally.

## Persistence contract

Phase 5/6 backend requires schema support for authored state and optional projections.

Required authored tables or equivalents:

- `tasks`;
- `task_assignments`;
- `task_dependencies`;
- `project_baselines`;
- `project_baseline_tasks`;
- `project_baseline_assignments`;
- `project_calendars`;
- `resource_calendars`;
- `calendar_exceptions`;
- `resource_reservations`;
- `plan_versions`.

Optional projection/debug tables:

- `plan_calculation_runs`;
- `resource_load_projection`.

Required when scenario apply uses `proposalId` instead of signed payload:

- `planning_scenario_runs`.

Rules:

- tenant id participates in every planning table key or foreign key.
- task dependency must enforce same tenant/project.
- dependency cycles are engine validation issues; DB should still prevent cross-project dependency.
- `planVersion` increments only through planning application command transaction.
- calculated projections must include `planVersion` and `engineVersion`.
- `projects` must support non-opportunity planning containers through explicit `projectSourceType` or equivalent; do not model `workspace_inbox` as a fake CRM opportunity.
- `planning_scenario_runs`, when used, must store tenant id, project id, plan version, engine version, target conflict, proposal payload, proposal payload hash, expiry, actor id and applied-at metadata.

## Permissions and audit

Initial permissions:

- `tenant.projects.read`;
- `tenant.project_plan.read`;
- `tenant.project_plan.manage`;
- `tenant.project_baselines.manage`;
- `tenant.project_resources.read`;
- `tenant.project_resources.manage`;
- `tenant.planning_scenarios.preview`;
- `tenant.planning_scenarios.apply`;
- `tenant.audit_events.read`.

Audit action types:

- `planning.task.created`;
- `planning.task.updated`;
- `planning.task.status_changed`;
- `planning.task.archived`;
- `planning.dependency.upserted`;
- `planning.dependency.deleted`;
- `planning.assignment.upserted`;
- `planning.assignment.deleted`;
- `planning.baseline.captured`;
- `planning.calendar_exception.upserted`;
- `planning.constraint.updated`;
- `planning.resource_reserved`;
- `planning.overload_risk_accepted`;
- `planning.scenario.previewed`;
- `planning.scenario.applied`;
- `planning.command_denied`;
- `planning.command_conflict`.

Every applied command audit event must include:

- actor;
- source workflow;
- command type;
- command input;
- before state summary;
- after state summary;
- plan version before/after;
- permission result;
- validation issues;
- scenario proposal id if applicable.

## Error and conflict behavior

Required API errors:

- `session_required`;
- `permission_denied`;
- `project_not_found`;
- `plan_version_conflict`;
- `planning_command_invalid`;
- `planning_precondition_failed`;
- `dependency_cycle_detected`;
- `calendar_has_no_working_time`;
- `constraint_impossible`;
- `scenario_not_found`;
- `scenario_expired`;
- `accepted_risk_reason_required`;
- `persistence_not_configured`.

Preview may return blocking validation issues with HTTP 200 if preview itself succeeded.

Apply must reject blocking validation issues unless command explicitly accepts the corresponding risk and permission allows it.

## Implementation slices

### Slice A. Contract and compatibility boundary

Goal: define planning types, command union and task CRUD wrapper decision.

Acceptance:

- phase docs reference this contract;
- task CRUD endpoints are documented as wrappers;
- no UI or API consumer is allowed to mutate planning fields outside planning command.

### Slice B. Scheduling engine

Goal: deterministic MS Project-class calculation core.

Acceptance:

- unit tests cover task types, Work/Duration/Units, effort-driven behavior, dependency types, lag/lead, calendars, constraints, critical path and validation.
- same `PlanSnapshot` returns byte-stable result for stable sorted output.

### Slice C. Persistence and snapshot adapter

Goal: persist authored state and assemble `PlanSnapshot`.

Acceptance:

- migrations are tenant-scoped;
- repository tests prove same-project dependency rules;
- adapter returns all tasks, assignments, dependencies, calendars, reservations and baselines for active project.

### Slice D. Planning application commands

Goal: preview/apply commands with permissions, planVersion, transaction and audit.

Acceptance:

- API DB tests prove preview does not mutate;
- apply increments planVersion;
- denied command writes denied audit where current audit policy requires it;
- stale client version returns conflict.

### Slice E. Resource planning

Goal: resource load matrix backend read model.

Acceptance:

- tests cover person/position/day/week/month buckets;
- overload drilldown identifies tasks, assignments, reservations and absence/conflict reasons.

### Slice F. Scenario proposals

Goal: aggressive/balanced/resilient proposal generation and governed apply.

Acceptance:

- API returns exactly the requested proposal profiles when feasible;
- each proposal has explainable `PlanDelta`;
- apply goes through planning command transaction and recalculation.

## Verification plan

Required verification before claiming Phase 5/6 backend complete:

```bash
pnpm typecheck
pnpm test
pnpm test:db
```

Targeted suites must include:

- scheduling engine unit tests;
- resource planning unit tests;
- planning scenario unit tests;
- persistence migration/schema tests;
- API DB tests for preview/apply/permissions/audit/conflict;
- compatibility tests for task CRUD wrapper to planning command.

Browser E2E for Gantt/resource matrix is not a Phase 5/6 exit gate. Backend must expose deterministic seeded/read-model data that future UI phases can consume.

## Migration and worktree guidance

Current Phase 4 worktrees may continue building project/task frontend separately. Phase 5/6 does not edit or implement frontend UI files.

Recommended integration order:

1. Finish or stabilize Phase 4 task API shape.
2. Introduce planning command layer behind existing task creation/update routes.
3. Add new planning endpoints.
4. Prove backend read/preview/apply/scenario behavior with unit and DB/API tests.
5. Leave future Gantt/resource UI consumption to a separate frontend phase.

## Open decisions

- Exact first `engineVersion` string.
- Whether projections are computed synchronously only or cached after `planVersion` changes.
- Whether `task.delete_or_archive` permits hard delete before audit retention policy is finalized.
- First limits for scenario search: max tasks, max horizon, max branching operations.
- Whether `manual` scheduling mode still validates dependencies or only warns.
