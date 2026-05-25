# 39. Phase 7: KPI, signals, action engine backend

## Статус

Backend-scope Phase 7 реализован до Phase 10 поверх planning engine. Этот документ остается canonical contract для KPI definitions, evaluations, signals, governed actions и action engine; Phase 10 проверяет его как production hardening surface.

UI control surfaces, frontend KPI dashboards и визуальный audit viewer не входят в первый backend slice. Backend обязан вернуть стабильные read models и governed action contracts, чтобы будущий UI не придумывал собственную логику.

## Product intent

KPI в KISS PM не является декоративной карточкой. KPI должен:

1. посчитать состояние проекта на основе canonical project/planning data;
2. сохранить traceable `KpiEvaluation`;
3. создать `ControlSignal`, если есть отклонение;
4. предложить разрешенные `ManagementAction` / `CorrectiveAction`;
5. для schedule/resource проблем построить explainable solver proposal;
6. применить изменение только через governed action, права, preconditions и audit.

## Backend boundaries

### Domain

`packages/domain/src/control/*` отвечает за чистую бизнес-логику:

- `KpiDefinition`;
- constrained formula expression;
- built-in planning KPI metrics;
- `KpiEvaluation`;
- `ControlSignal`;
- `ManagementActionCandidate`;
- deterministic auto-solver для deadline/resource отклонений.

Domain не импортирует API, persistence, Hono, Drizzle или access-control.

### Persistence

Persistence хранит tenant-scoped:

- KPI definitions;
- KPI evaluations;
- control signals;
- corrective actions;
- action executions.

Все записи имеют `tenantId`; project-scoped записи имеют `projectId`.

### API / application

API отвечает за:

- actor/profile resolution;
- permission checks;
- transaction boundary;
- plan-version precondition для action, который меняет planning state;
- audit events;
- mapping domain result -> API DTO.

Action engine не меняет planning tables напрямую. Planning-changing actions должны идти через existing `PlanningCommand` / `PlanDelta` application path.

## KPI formula scope

Первый backend slice поддерживает:

- built-in KPI:
  - `deadline_delta_days`;
  - `resource_overload_minutes`;
  - `critical_task_count`;
  - `progress_percent`;
  - `baseline_finish_slip_days`;
- constrained expression AST:
  - number literal;
  - metric reference;
  - arithmetic `add/sub/mul/div`;
  - `min/max/abs`.

Запрещено:

- arbitrary JavaScript;
- SQL fragments;
- string interpolation;
- runtime code execution.

## Auto-solver scope

Solver является deterministic proposal engine. Он не применяет изменения сам.

Cost priority: `deadline first`.

Cost function:

1. минимизировать deadline miss;
2. затем плановую дату завершения;
3. затем resource overload minutes;
4. затем количество changed tasks/assignments;
5. затем risk score.

Allowed Phase 7/8 solver operations:

- keep assignment on current resource when capacity allows;
- reassign work to compatible same-position/same-team resource;
- split work across compatible resources through explicit assignment allocations;
- shift authored task schedule to match allocation span;
- accept overload risk only as fallback when no no-overlap candidate exists.

Любой proposal возвращает explainability:

- target signal;
- commands / plan delta;
- expected deadline delta;
- expected overload delta;
- changed entities;
- risk score;
- required permissions.

## Phase 7/8 resource-constrained solver contract

Auto-solver для resource/schedule конфликтов строится поверх canonical planning engine и обязан сохранять один источник истины:

1. `PlanAssignmentAllocation` является явной моделью распределения работы по дням.
   - одна запись на `assignmentId + date`;
   - split work между сотрудниками моделируется несколькими assignments плюс allocations;
   - explicit allocations имеют приоритет над равномерным fallback-распределением нагрузки.
2. `schedule` режим может пересобрать draft/новый план шире.
3. `repair` режим не трогает завершенные задачи (`percentComplete >= 100`) и считает их занятость locked occupation.
4. Занятость других проектов входит в snapshot horizon как read-only reservation/occupation и не мутируется solver-ом.
5. No-overlap proposal всегда предпочтительнее accepted-overload.
   Accepted-overload proposal допустим только когда без перегруза решения нет.
6. Search core использует bounded beam-search:
   - state = частично распределенный plan frontier;
   - expansion = keep / reassign / split / overload fallback для очередного assignment;
   - beam сортируется deterministic cost order;
   - `beamWidth`, `maxIterations`, `maxProposals` являются частью persisted run metadata.
7. Authored task schedule должен быть синхронизирован с allocation span:
   - если allocations сдвигают работу, proposal включает `task.update_schedule`;
   - explainability `finishDate` считается как максимум из scheduling finish и последней allocation date;
   - resource load preview обязан покрывать horizon до последней allocation date.
   - scheduling engine использует explicit allocation span как расчетную длительность задачи, чтобы Gantt/read-model и resource matrix не расходились.
8. Solver run сохраняется как persisted result:
   - apply использует только сохраненный proposal;
   - apply не пересчитывает proposal заново;
   - apply проверяет `planVersion`, expiry, payload hash, permissions, validation preview и пишет audit.
9. Allocation-changing proposal требует `tenant.project_resources.manage`.
   Planning-changing proposal требует `tenant.project_plan.manage`.

## Exit gate

Phase 7 backend считается готовым только когда:

- KPI definition CRUD/seed defaults работают через API;
- evaluation creates persisted `KpiEvaluation`;
- deviation creates persisted `ControlSignal`;
- action preview/apply writes `ActionExecution` and audit;
- corrective action create/update is permissioned and auditable;
- planning-changing action goes through planning command path;
- solver returns deterministic proposals and never mutates state during preview;
- DB tests prove tenant isolation, permission denial, audit, and plan-version conflict.
