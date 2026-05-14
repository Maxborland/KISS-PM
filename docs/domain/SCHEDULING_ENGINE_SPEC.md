# Scheduling Engine Spec

## 1. Purpose

The scheduling engine turns canonical tasks into a deterministic project plan. KISS PM needs a practical Gantt foundation early, but it must not become a premature full Microsoft Project clone.

## 2. MVP scope

MVP scheduling supports:

- WBS/tree structure;
- planned start and finish;
- duration;
- planned work;
- progress;
- task participants/assignments;
- basic Finish-to-Start dependencies;
- baseline draft fields;
- schedule validation;
- opening Gantt from project, portfolio, CRM/project draft, or control surface.

## 3. Future scope

Future scheduling scope includes:

- Work/Duration/Units triangle;
- Start-to-Start, Finish-to-Finish, Start-to-Finish dependencies;
- lags/leads;
- calendars and exceptions;
- constraints;
- critical path;
- resource leveling;
- multiple baselines and comparison;
- MSPDI/XML import/export;
- advanced schedule optimization.

Future scope must not block Phase 5 unless explicitly moved into the phase-detail document.

## 4. Model

```txt
SchedulePlan
- id
- tenantId
- projectId
- version
- baselineId
- status

WbsNode
- id
- tenantId
- projectId
- parentId
- taskId
- stageId
- sortOrder

ScheduleDependency
- id
- tenantId
- predecessorTaskId
- successorTaskId
- type: finish_to_start
- lag

BaselineSnapshot
- id
- tenantId
- projectId
- createdBy
- createdAt
- taskBaselineValues[]
```

## 5. Calculation rules

MVP calculations must be deterministic and testable without UI or network dependencies.

Initial rules:

- duration derives from planned start/finish when both are present;
- Finish-to-Start dependency warns or blocks when successor starts before predecessor finishes, depending on phase policy;
- baseline values remain stable until explicit baseline update;
- schedule validation reports missing dates, invalid ranges, dependency cycles, and obvious conflicts;
- schedule changes must be permission-checked and auditable when persisted.

## 6. Gantt relationship to canonical tasks

Gantt rows are projections over `Task`, `ProjectStage`, and WBS metadata. A Gantt task is not a separate domain entity. If a task is created in Gantt, it is the same canonical task that can appear in My Tasks, Kanban, resource planning, KPI source data, and control surfaces.

## 7. Test requirements

- Unit tests for date range validation.
- Unit tests for dependency validation.
- Unit tests for baseline stability.
- Integration tests for schedule save/load.
- E2E tests for Gantt open, task creation, date persistence, dependency creation, and baseline visibility.

