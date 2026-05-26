# Phase 7/8 Backend: Auto-Solver Ресурсно-Ограниченного Планирования

## Summary

Auto-solver строит или ремонтирует граф проекта поверх существующего planning engine так, чтобы работа назначалась сотрудникам в рамках рабочего дня, с учетом календарей, отсутствий, reservations/занятости других проектов и project deadline.

Solver не применяет изменения сам. Он создает объяснимый persisted run с proposal payload/hash. Применение proposal идет только через governed planning command path: permission, preconditions, plan version, validation, audit.

## Product Intent

Пользователь: руководитель проекта или ресурсный менеджер.

Потребность: быстро получить реалистичный план без ручного перебора WBS/Gantt/resource matrix.

Ценность: backend дает UI и control/action engine безопасные варианты действий, которые можно показать, сравнить и применить без preview/apply drift.

## Non-Goals

- UI реализации.
- Импорт/экспорт MS Project.
- Silent auto-apply.
- Оптимизация через вероятностные/недетерминированные алгоритмы.
- Minute-slot meetings в первом релизе; типы проектируются так, чтобы заменить day buckets на minute slots позже.

## Domain Contract

### Explicit Assignment Allocations

```ts
type PlanAssignmentAllocation = {
  assignmentId: string;
  taskId: string;
  resourceId: string;
  date: string;
  workMinutes: number;
};
```

Правила:

- одна allocation на `assignmentId + date`;
- allocation принадлежит существующему assignment;
- `taskId` и `resourceId` должны совпадать с assignment;
- split across resources делается через несколько assignments плюс allocations;
- если у assignment есть explicit allocations, resource load использует только их;
- если allocations нет, сохраняется текущий fallback: work равномерно распределяется по calculated duration/capacity.

### Planning Command

```ts
{
  type: "assignment.allocations.replace",
  payload: {
    assignmentId: string;
    allocations: Array<{
      date: string;
      workMinutes: number;
    }>;
  };
}
```

Команда атомарно заменяет explicit allocations одного assignment.

## Solver Contract

```ts
type AutoPlanningSolverMode = "schedule" | "repair";

type AutoPlanningSolverRunResult = {
  runId: string;
  mode: AutoPlanningSolverMode;
  clientPlanVersion: number;
  engineVersion: string;
  proposals: AutoPlanningProposal[];
};
```

Search:

- deterministic bounded beam search;
- defaults: beam width `20`, max iterations `200`, max proposals `5`;
- first release uses day buckets;
- candidate operations:
  - shift task within dependency-safe window;
  - reassign work;
  - split assignment allocations;
  - compress critical task work/duration only where work model allows;
  - accept overload risk only as fallback.

Cost order:

1. blocking dependency/calendar violations;
2. deadline miss days;
3. finish date;
4. overload minutes;
5. changed tasks;
6. changed assignments/allocations;
7. risk score.

## Persistence Contract

### `task_assignment_allocations`

- tenant/project scoped;
- FK to `task_assignments`;
- unique `(tenant_id, project_id, assignment_id, date)`;
- cascade cleanup with assignment/task/project;
- archived tasks/assignments do not contribute to snapshots.

### `planning_solver_runs`

Stores:

- tenant/project/run id;
- mode;
- client plan version;
- engine version;
- input metadata;
- target deadline;
- proposals JSON;
- proposal payload hash;
- expiry;
- created by/at;
- applied proposal id/at.

## API Contract

```txt
POST /api/workspace/projects/:projectId/planning/auto-solver-runs
GET /api/workspace/projects/:projectId/planning/auto-solver-runs/:runId
POST /api/workspace/projects/:projectId/planning/auto-solver-runs/:runId/proposals/:proposalId/apply
```

Apply requires:

- `tenant.project_plan.manage`;
- `tenant.project_resources.manage` when assignments/allocations change;
- current `planVersion` equals run `clientPlanVersion`;
- proposal hash matches persisted run;
- proposal not expired;
- preview after commands has no blocking validation issues;
- audit writes inside transaction.

## Acceptance Criteria

- Explicit allocations override fallback distribution.
- Other-project reservations still count as read-only occupation.
- Solver produces no-overlap proposal before overload fallback when feasible.
- Solver ranking is deterministic and deadline-first.
- Persisted run apply never recomputes proposal payload.
- Stale/tampered/expired/missing-permission apply is rejected.
- Successful apply writes audit and increments plan version.
