# 07. Gantt, задачи и ресурсы

## Единая задача

В KISS PM нет разных сущностей для Gantt task, Kanban task, corrective task и task из control surface. Есть один `Task`, который отображается в разных представлениях.

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

## Gantt MVP

Первая реализация Gantt должна включать:

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

## MS Project-class roadmap

Дальше нужны:

- Work / Duration / Units;
- task types: fixed units, fixed work, fixed duration;
- effort-driven behavior;
- dependency types FS, SS, FF, SF;
- lag/lead;
- calendars and exceptions;
- constraints;
- critical path;
- resource leveling;
- MSPDI/XML import/export.

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
