# 07. Gantt, задачи и ресурсы

## Единая задача

В KISS PM нет разных сущностей для Gantt task, Kanban task, corrective task и task из control surface. Есть один `Task`, который отображается в разных представлениях.

Любая `Task` участвует в planning model и попадает в `PlanSnapshot`. Простые task CRUD-действия являются удобным фасадом над planning command layer, а не отдельным путем изменения дат, трудоемкости, назначений, зависимостей, constraints или baseline.

## Task fields

- tenantId;
- projectId;
- stageId при наличии;
- title;
- status;
- priority;
- plannedStart / plannedFinish;
- actualStart / actualFinish;
- duration;
- plannedWork;
- actualWork;
- progress;
- participants;
- dependencies;
- source;
- audit/activity history.

## Participant roles

- executor;
- co-executor;
- requester;
- controller;
- approver;
- observer.

## Gantt baseline

Первая реализация Gantt/read model должна включать:

- WBS hierarchy;
- старт/финиш;
- duration;
- plannedWork;
- progress;
- participants/assignments;
- Finish-to-Start dependency;
- baseline basics;
- validation errors;
- audit for state changes.

## MS Project-class backend scope

Phase 5/6 backend scope подробно закреплен в `30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md`. Движок планирования должен поддерживать:

- Work / Duration / Units;
- task types: fixed units, fixed work, fixed duration;
- effort-driven behavior;
- dependency types FS, SS, FF, SF;
- lag/lead;
- calendars and exceptions;
- constraints;
- critical path;
- resource leveling;
- scenario planning proposals.

MSPDI/XML import/export остается future integration adapter и не входит в Phase 5/6 backend scope.

## Resource planning

Resource planning должен показывать загрузку людей, ролей, команд и подразделений во времени.

Обязательные возможности:

- capacity calendars;
- availability exceptions;
- assignments;
- reservations;
- load buckets по дням/неделям/месяцам;
- overload detection;
- free capacity heatmap;
- drilldown из ячейки матрицы;
- preview действий shift/split/reassign/reserve/accept risk.

## Матрица загрузки

Матрица загрузки — обязательное наследие BR2 как capability. Она должна быть плотной, интерактивной и управленческой: пользователь видит перегруз, открывает причину, выбирает действие, получает audit и пересчет.

## Scenario Planning Engine

Scenario Planning Engine — future capability над Gantt scheduling и resource matrix. Он не заменяет MS Project-class scheduling engine, а использует его для оценки последствий сценариев.

Модель поиска:

```txt
нода = состояние плана / PlanSnapshot
ребро = управленческое действие / PlanDelta
ресурс = ограничение capacity, календарь, availability, skill, deadline
цель = выбранный допустимый компромисс
```

Первый набор действий:

- shift task;
- split work;
- reassign participant/resource;
- reserve capacity;
- accept overload risk with reason;
- move deadline.

Система должна возвращать несколько `PlanningScenario`, а не один ответ:

- aggressive — минимизировать дату финиша или удержать дедлайн, допускает явные перегрузы;
- balanced — сохранить дедлайн и минимизировать перегрузы;
- resilient — убрать перегрузы и показать сдвиг фактического дедлайна.

Каждый сценарий обязан содержать explainable preview: finish date, deadline delta, overload hours, overloaded people, changed tasks, changed assignments, dependency warnings, required approvals, risk score и plan delta.

Применение сценария всегда проходит через command/action layer: permission check, preconditions, audit, recalculation. Нельзя делать auto-apply без явного управленческого решения.
