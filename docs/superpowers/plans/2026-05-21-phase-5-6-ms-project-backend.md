# Phase 5/6 MS Project-class Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend planning core for Phase 5/6 so every task participates in a deterministic MS Project-class planning model, task CRUD becomes a wrapper over planning commands, and resource/scenario planning share one API contract.

**Architecture:** Implement the first production slice inside `packages/domain/src/planning/*` to avoid premature workspace-package churn, but keep file boundaries matching future `project-core`, `scheduling-engine`, `resource-planning`, `planning-scenarios`, and `planning-application` packages. Persistence stores authored plan state and exposes a snapshot adapter; API exposes planning read/preview/apply/scenario endpoints and routes task CRUD wrappers through `PlanningCommand`.

**Scope guard:** Phase 5/6 is only the backend planning engine decision/implementation scope. Do not implement Gantt UI, resource matrix UI, KPI/control surfaces, browser E2E for those surfaces, or frontend feature work in this plan. Existing task/project APIs may be adapted only as compatibility wrappers so every task enters the planning engine.

**Tech Stack:** TypeScript, Vitest, Hono, Drizzle ORM, PostgreSQL, existing `@kiss-pm/domain`, `@kiss-pm/access-control`, `@kiss-pm/persistence`, `@kiss-pm/api`.

---

## Source Contracts

- Product contract: `docs/30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md`
- Domain source of truth: `docs/02_ДОМЕННАЯ_МОДЕЛЬ.md`
- Architecture source of truth: `docs/03_АРХИТЕКТУРА_SAAS_SELF_HOSTED.md`
- Planning surface consumer constraints: `docs/07_GANTT_ЗАДАЧИ_РЕСУРСЫ.md`
- Phase plan: `docs/12_ФАЗОВЫЙ_ПЛАН.md`

## Preconditions

- Start from a branch/worktree that already contains the accepted Phase 4 project/task backend, or merge it before Task 4.
- If `apps/api/src/projectWorkRoutes.ts` is absent, do not invent a second task API. Implement planning routes first and add the task CRUD wrapper only after Phase 4 task routes land.
- If an existing API compatibility endpoint creates a task without an explicit project, resolve it to the tenant-owned `workspace-inbox-project`. That project has a normal `planVersion`, calendar, tasks and audit; it is not a separate non-planning task store.
- `workspace-inbox-project` must be represented as a real planning project with explicit project source metadata. Do not create a fake CRM opportunity just to satisfy the current `sourceOpportunityId` constraint.
- Do not edit frontend worktree files in this backend plan.
- Do not implement MSPDI/XML import/export.

## Required Corrections From Architecture Review

These requirements are blocking. Do not implement a smaller green path that violates them.

- The scheduling engine must use a topological dependency order, not WBS order. It must include a forward pass, backward pass, real slack, and real critical path.
- Working time must support date + minute precision. Day-only helpers may exist for UI labels, but dependency lag/lead, FF/SF and resource allocation must use a `WorkingInstant` timeline.
- `Work / Duration / Units` must participate in scheduling through assignments. Isolated work-model tests are not enough.
- Preview and apply must share one pure reducer: `reducePlanningCommand(snapshot, command)`. API preview must not have separate command logic from API apply.
- Runtime parsing must validate every `PlanningCommand` variant strictly. A string `type` plus arbitrary `payload` is not acceptable.
- Projectless task creation must resolve to an explicit planning container. Use a tenant-owned `workspace-inbox-project` unless a concrete project is provided.
- Resource planning must allocate work only across working capacity buckets and must include resource calendars, exceptions, reservations, day/week/month buckets and free-capacity buckets.
- Scenario proposals must run against `PlanSnapshot + CalculatedPlan + ResourceLoadMatrix` and must prove that each proposal reduces, removes, or explicitly accepts the target conflict.
- Scenario apply must use a stored non-expired proposal snapshot or a signed proposal payload. Applying `:proposalId` by regenerating proposals from current inputs is forbidden.
- Parser and reducer coverage must be table-driven across every `PlanningCommand` variant before Slice D/F can pass.

## File Structure

Create:

- `packages/domain/src/planning/types.ts` — canonical planning DTOs and discriminated unions.
- `packages/domain/src/planning/workingTime.ts` — date+minute working-time timeline for calendars, lag/lead and resource allocation.
- `packages/domain/src/planning/calendar.ts` — deterministic working-time calendar helpers.
- `packages/domain/src/planning/workModel.ts` — Work/Duration/Units and task type recalculation.
- `packages/domain/src/planning/dependencyGraph.ts` — dependency graph, cycle detection, FS/SS/FF/SF constraints.
- `packages/domain/src/planning/schedulingEngine.ts` — `calculatePlan(snapshot, options)` orchestration.
- `packages/domain/src/planning/resourcePlanning.ts` — load buckets, overloads, free capacity, drilldown.
- `packages/domain/src/planning/scenarioPlanning.ts` — aggressive/balanced/resilient proposal generation.
- `packages/domain/src/planning/commandReducer.ts` — pure `reducePlanningCommand(snapshot, command)` shared by preview and apply.
- `packages/domain/src/planning/planningCommands.ts` — command validation and pure `PlanDelta` helpers.
- `packages/domain/src/planning/*.test.ts` — focused unit tests per planning module.
- `packages/persistence/src/planningRepository.ts` — snapshot adapter, planning state persistence, command persistence helpers.
- `packages/persistence/src/planningRepository.db.test.ts` — DB tests for same-project constraints, snapshot assembly and plan versioning.
- `packages/persistence/migrations/0010_phase_5_6_planning_core.sql` — authored planning tables.
- `apps/api/src/planningParsers.ts` — request parsing for planning endpoints.
- `apps/api/src/planningParsers.test.ts` — parser unit tests.
- `apps/api/src/planningRoutes.ts` — read-model, preview, apply, scenario routes.
- `apps/api/src/planningRoutes.db.test.ts` — API DB tests.

Modify:

- `packages/domain/src/index.ts` — export planning modules.
- `packages/access-control/src/index.ts` — add planning permissions and policy helpers.
- `packages/access-control/src/policy.test.ts` — permission regression tests.
- `packages/persistence/src/schema.ts` — Drizzle table definitions.
- `packages/persistence/src/index.ts` — export planning repository types/functions.
- `packages/persistence/src/seed.ts` — seed baseline planning data and permissions.
- `packages/persistence/src/migration.test.ts` — include migration `0010`.
- `packages/persistence/src/schema.test.ts` — table/schema assertions.
- `apps/api/src/apiTypes.ts` — planning data source records and methods.
- `apps/api/src/app.ts` — register planning routes.
- `apps/api/src/inMemoryTenantDataSource.ts` — minimal planning route support for non-DB tests.
- `apps/api/src/projectWorkRoutes.ts` — when present, translate task CRUD wrapper inputs into `PlanningCommand`.
- `apps/api/src/projectWorkRoutes.db.test.ts` — compatibility tests when task CRUD routes are present.

---

### Task 1: Slice A Domain Contract and Access Boundary

**Files:**
- Create: `packages/domain/src/planning/types.ts`
- Create: `packages/domain/src/planning/planningCommands.ts`
- Create: `packages/domain/src/planning/commandReducer.ts`
- Create: `packages/domain/src/planning/commandReducer.test.ts`
- Create: `packages/domain/src/planning/planningCommands.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/access-control/src/index.ts`
- Modify: `packages/access-control/src/policy.test.ts`

- [ ] **Step 1: Add failing tests for planning command shape and task CRUD wrapper invariant**

Create `packages/domain/src/planning/planningCommands.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  createPlanningCommand,
  isBlockingValidationIssue,
  type PlanningCommand,
  type PlanSnapshot
} from "./planningCommands";

describe("planning command contract", () => {
  it("creates a task.create planning command for task CRUD wrappers", () => {
    const command = createPlanningCommand({
      type: "task.create",
      payload: {
        id: "task-alpha",
        projectId: "project-alpha",
        title: "Подготовить план",
        statusId: "todo",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-05",
        workMinutes: 2400,
        assignments: []
      }
    });

    expect(command).toMatchObject({
      type: "task.create",
      payload: {
        id: "task-alpha",
        projectId: "project-alpha",
        workMinutes: 2400
      }
    });
  });

  it("keeps all plan mutations inside the PlanningCommand union", () => {
    const commandTypes: PlanningCommand["type"][] = [
      "task.create",
      "task.update_identity",
      "task.update_schedule",
      "task.update_work_model",
      "task.update_status",
      "task.move_wbs",
      "task.delete_or_archive",
      "dependency.upsert",
      "dependency.delete",
      "assignment.upsert",
      "assignment.delete",
      "baseline.capture",
      "calendar.exception.upsert",
      "constraint.update",
      "resource.reserve",
      "risk.accept_overload",
      "project.deadline.move"
    ];

    expect(commandTypes).toContain("task.create");
    expect(commandTypes).toContain("dependency.upsert");
    expect(commandTypes).toContain("assignment.upsert");
  });

  it("marks blocking validation severities explicitly", () => {
    expect(
      isBlockingValidationIssue({
        code: "dependency_cycle_detected",
        severity: "error",
        message: "Циклическая зависимость",
        entity: { type: "TaskDependency", id: "dep-alpha" }
      })
    ).toBe(true);
  });

  it("defines PlanSnapshot as immutable calculation input", () => {
    const snapshot: PlanSnapshot = {
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      planVersion: 1,
      project: {
        id: "project-alpha",
        sourceType: "opportunity",
        sourceOpportunityId: "opportunity-alpha",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-30",
        deadline: "2026-06-30",
        calendarId: "calendar-project-alpha"
      },
      tasks: [],
      assignments: [],
      dependencies: [],
      baselines: [],
      calendars: [],
      calendarExceptions: [],
      resources: [],
      reservations: [],
      constraints: [],
      capturedAt: "2026-05-21T00:00:00.000Z"
    };

    expect(snapshot.planVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Run the failing contract test**

Run:

```bash
pnpm vitest run packages/domain/src/planning/planningCommands.test.ts
```

Expected: fail because `packages/domain/src/planning/planningCommands.ts` does not exist.

- [ ] **Step 3: Add canonical planning types**

Create `packages/domain/src/planning/types.ts`:

```ts
export type PlanDate = string;
export type PlanDateTime = string;
export type WorkingInstant = {
  date: PlanDate;
  minuteOfDay: number;
};

export type TaskType = "fixed_units" | "fixed_work" | "fixed_duration";
export type SchedulingMode = "auto" | "manual";
export type DependencyType = "FS" | "SS" | "FF" | "SF";
export type BucketGranularity = "day" | "week" | "month";
export type ScenarioProfile = "aggressive" | "balanced" | "resilient";
export type ValidationSeverity = "info" | "warning" | "error";
export type ProjectSourceType = "opportunity" | "workspace_inbox" | "manual";

export type PlanProject = {
  id: string;
  sourceType: ProjectSourceType;
  sourceOpportunityId: string | null;
  plannedStart: PlanDate;
  plannedFinish: PlanDate;
  deadline: PlanDate | null;
  calendarId: string | null;
};

export type PlanConstraintType =
  | "as_soon_as_possible"
  | "start_no_earlier_than"
  | "finish_no_later_than"
  | "must_start_on"
  | "must_finish_on";

export type PlanConstraint = {
  id: string;
  taskId: string;
  type: PlanConstraintType;
  date: PlanDate | null;
};

export type PlanTask = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  title: string;
  statusId: string;
  schedulingMode: SchedulingMode;
  taskType: TaskType;
  effortDriven: boolean;
  plannedStart: PlanDate | null;
  plannedFinish: PlanDate | null;
  plannedStartInstant?: WorkingInstant | null;
  plannedFinishInstant?: WorkingInstant | null;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  calendarId: string | null;
  constraint: PlanConstraint | null;
};

export type PlanAssignmentRole =
  | "executor"
  | "co_executor"
  | "controller"
  | "approver"
  | "observer";

export type PlanAssignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: PlanAssignmentRole;
  unitsPermille: number;
  workMinutes: number | null;
  calendarId: string | null;
};

export type PlanDependency = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
  lagMinutes: number;
};

export type PlanCalendar = {
  id: string;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
};

export type PlanCalendarException = {
  id: string;
  calendarId: string;
  resourceId: string | null;
  date: PlanDate;
  workingMinutes: number;
  reason: string | null;
};

export type PlanResource = {
  id: string;
  userId: string | null;
  positionId: string | null;
  teamId: string | null;
  name: string;
  calendarId: string | null;
};

export type PlanReservation = {
  id: string;
  resourceId: string;
  projectId: string;
  start: PlanDate;
  finish: PlanDate;
  workMinutes: number;
  reason: string | null;
};

export type PlanBaseline = {
  id: string;
  capturedAt: PlanDateTime;
  tasks: Array<{
    taskId: string;
    plannedStart: PlanDate | null;
    plannedFinish: PlanDate | null;
    workMinutes: number;
  }>;
};

export type PlanSnapshot = {
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
  capturedAt: PlanDateTime;
};

export type ValidationIssue = {
  code:
    | "dependency_cycle_detected"
    | "calendar_has_no_working_time"
    | "constraint_impossible"
    | "assignment_without_resource"
    | "schedule_outside_project_bounds"
    | "invalid_work_model"
    | "planning_command_invalid";
  severity: ValidationSeverity;
  message: string;
  entity: { type: string; id: string } | null;
};

export type CalculatedTask = PlanTask & {
  calculatedStart: PlanDate | null;
  calculatedFinish: PlanDate | null;
  calculatedStartInstant: WorkingInstant | null;
  calculatedFinishInstant: WorkingInstant | null;
  earliestStart: PlanDate | null;
  earliestFinish: PlanDate | null;
  earliestStartInstant: WorkingInstant | null;
  earliestFinishInstant: WorkingInstant | null;
  latestStart: PlanDate | null;
  latestFinish: PlanDate | null;
  latestStartInstant: WorkingInstant | null;
  latestFinishInstant: WorkingInstant | null;
  totalSlackMinutes: number | null;
  isCritical: boolean;
};

export type CalculatedDependency = PlanDependency & {
  valid: boolean;
  issueCodes: string[];
};

export type CalculatedPlan = {
  tenantId: string;
  projectId: string;
  planVersion: number;
  engineVersion: string;
  calculatedAt: PlanDateTime;
  tasks: CalculatedTask[];
  dependencies: CalculatedDependency[];
  projectFinish: PlanDate | null;
  criticalPathTaskIds: string[];
  validationIssues: ValidationIssue[];
};
```

- [ ] **Step 4: Add command union helpers**

Create `packages/domain/src/planning/planningCommands.ts`:

```ts
import type {
  DependencyType,
  PlanAssignmentRole,
  PlanDate,
  PlanSnapshot,
  TaskType,
  ValidationIssue
} from "./types";

export type CreateTaskPayload = {
  id: string;
  projectId: string;
  parentTaskId?: string | null;
  title: string;
  statusId: string;
  plannedStart: PlanDate | null;
  plannedFinish: PlanDate | null;
  workMinutes: number;
  assignments: Array<{
    resourceId: string;
    role: PlanAssignmentRole;
    unitsPermille: number;
    workMinutes?: number | null;
  }>;
};

export type PlanningCommand =
  | { type: "task.create"; payload: CreateTaskPayload }
  | { type: "task.update_identity"; payload: { taskId: string; title: string } }
  | {
      type: "task.update_schedule";
      payload: { taskId: string; plannedStart: PlanDate | null; plannedFinish: PlanDate | null };
    }
  | {
      type: "task.update_work_model";
      payload: {
        taskId: string;
        taskType: TaskType;
        effortDriven: boolean;
        durationMinutes: number | null;
        workMinutes: number;
      };
    }
  | { type: "task.update_status"; payload: { taskId: string; statusId: string } }
  | { type: "task.move_wbs"; payload: { taskId: string; parentTaskId: string | null; sortOrder: number } }
  | { type: "task.delete_or_archive"; payload: { taskId: string; mode: "archive" | "delete" } }
  | {
      type: "dependency.upsert";
      payload: {
        id: string;
        predecessorTaskId: string;
        successorTaskId: string;
        dependencyType: DependencyType;
        lagMinutes: number;
      };
    }
  | { type: "dependency.delete"; payload: { dependencyId: string } }
  | {
      type: "assignment.upsert";
      payload: {
        id: string;
        taskId: string;
        resourceId: string;
        role: PlanAssignmentRole;
        unitsPermille: number;
        workMinutes: number | null;
      };
    }
  | { type: "assignment.delete"; payload: { assignmentId: string } }
  | { type: "baseline.capture"; payload: { baselineId: string; label: string } }
  | {
      type: "calendar.exception.upsert";
      payload: { id: string; calendarId: string; resourceId: string | null; date: PlanDate; workingMinutes: number; reason: string | null };
    }
  | { type: "constraint.update"; payload: { taskId: string; constraintId: string; type: string; date: PlanDate | null } }
  | { type: "resource.reserve"; payload: { id: string; resourceId: string; start: PlanDate; finish: PlanDate; workMinutes: number; reason: string | null } }
  | { type: "risk.accept_overload"; payload: { overloadId: string; acceptedRiskReason: string } }
  | { type: "project.deadline.move"; payload: { deadline: PlanDate; reason: string } };

export type PlanDelta = {
  commands: PlanningCommand[];
  changedTaskIds: string[];
  changedAssignmentIds: string[];
  changedDependencyIds: string[];
  acceptedRiskIds: string[];
};

export function createPlanningCommand(command: PlanningCommand): PlanningCommand {
  return command;
}

export function createEmptyPlanDelta(): PlanDelta {
  return {
    commands: [],
    changedTaskIds: [],
    changedAssignmentIds: [],
    changedDependencyIds: [],
    acceptedRiskIds: []
  };
}

export function isBlockingValidationIssue(issue: ValidationIssue): boolean {
  return issue.severity === "error";
}

export type { PlanSnapshot, ValidationIssue };
```

- [ ] **Step 5: Add command reducer contract**

Create `packages/domain/src/planning/commandReducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { reducePlanningCommand } from "./commandReducer";
import type { PlanSnapshot } from "./types";

const snapshot: PlanSnapshot = {
  tenantId: "tenant-alpha",
  projectId: "project-alpha",
  planVersion: 1,
  project: {
    id: "project-alpha",
    sourceType: "opportunity",
    sourceOpportunityId: "opportunity-alpha",
    plannedStart: "2026-06-01",
    plannedFinish: "2026-06-30",
    deadline: "2026-06-30",
    calendarId: "calendar-default"
  },
  tasks: [],
  assignments: [],
  dependencies: [],
  baselines: [],
  calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
  calendarExceptions: [],
  resources: [],
  reservations: [],
  constraints: [],
  capturedAt: "2026-05-21T00:00:00.000Z"
};

describe("planning command reducer", () => {
  it("creates a task inside the next immutable snapshot and returns a plan delta", () => {
    const result = reducePlanningCommand(snapshot, {
      type: "task.create",
      payload: {
        id: "task-alpha",
        projectId: "project-alpha",
        title: "Подготовить план",
        statusId: "todo",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-05",
        workMinutes: 2400,
        assignments: []
      }
    });

    expect(snapshot.tasks).toHaveLength(0);
    expect(result.nextSnapshot.tasks).toEqual([
      expect.objectContaining({ id: "task-alpha", workMinutes: 2400 })
    ]);
    expect(result.planDelta.changedTaskIds).toEqual(["task-alpha"]);
  });
});
```

Create `packages/domain/src/planning/commandReducer.ts`:

```ts
import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import type { PlanSnapshot, ValidationIssue } from "./types";

export type CommandReductionResult = {
  nextSnapshot: PlanSnapshot;
  planDelta: PlanDelta;
  validationIssues: ValidationIssue[];
};

export function reducePlanningCommand(
  snapshot: PlanSnapshot,
  command: PlanningCommand
): CommandReductionResult {
  if (command.type === "task.create") {
    const planDelta = {
      ...createEmptyPlanDelta(),
      commands: [command],
      changedTaskIds: [command.payload.id]
    };

    return {
      nextSnapshot: {
        ...snapshot,
        tasks: [
          ...snapshot.tasks,
          {
            id: command.payload.id,
            parentTaskId: command.payload.parentTaskId ?? null,
            wbsCode: String(snapshot.tasks.length + 1),
            title: command.payload.title,
            statusId: command.payload.statusId,
            schedulingMode: "auto",
            taskType: "fixed_units",
            effortDriven: false,
            plannedStart: command.payload.plannedStart,
            plannedFinish: command.payload.plannedFinish,
            durationMinutes: null,
            workMinutes: command.payload.workMinutes,
            percentComplete: 0,
            calendarId: snapshot.project.calendarId,
            constraint: null
          }
        ]
      },
      planDelta,
      validationIssues: []
    };
  }

  return {
    nextSnapshot: snapshot,
    planDelta: { ...createEmptyPlanDelta(), commands: [command] },
    validationIssues: [
      {
        code: "planning_command_invalid",
        severity: "error",
        message: "Команда планирования еще не поддержана reducer",
        entity: null
      }
    ]
  };
}
```

Before Slice D, extend this reducer for every `PlanningCommand` variant used by preview/apply, scenario apply and task CRUD wrappers. Preview and apply are forbidden from implementing command semantics outside this reducer.

Add a table-driven reducer coverage test before Slice D starts:

```ts
it.each<PlanningCommand>([
  taskCreateCommand,
  taskUpdateIdentityCommand,
  taskUpdateScheduleCommand,
  taskUpdateWorkModelCommand,
  taskUpdateStatusCommand,
  taskMoveWbsCommand,
  taskDeleteOrArchiveCommand,
  dependencyUpsertCommand,
  dependencyDeleteCommand,
  assignmentUpsertCommand,
  assignmentDeleteCommand,
  baselineCaptureCommand,
  calendarExceptionUpsertCommand,
  constraintUpdateCommand,
  resourceReserveCommand,
  riskAcceptOverloadCommand,
  projectDeadlineMoveCommand
])("reduces %s through the shared command reducer", (command) => {
  const result = reducePlanningCommand(snapshotWithRequiredEntities, command);
  expect(result.validationIssues).not.toContainEqual(
    expect.objectContaining({ code: "planning_command_invalid" })
  );
  expect(result.planDelta.commands).toContainEqual(command);
});
```

Do not mark Slice D complete while any command variant still returns the temporary `planning_command_invalid` branch.

- [ ] **Step 6: Export planning types**

Modify `packages/domain/src/index.ts`:

```ts
export * from "./planning/types";
export * from "./planning/planningCommands";
export * from "./planning/commandReducer";
```

Keep the existing exports in the same file.

- [ ] **Step 7: Add planning permissions**

Modify `packages/access-control/src/index.ts` by adding these permission literals to `permissions`:

```ts
"tenant.project_plan.read",
"tenant.project_plan.manage",
"tenant.project_baselines.manage",
"tenant.project_resources.read",
"tenant.project_resources.manage",
"tenant.planning_scenarios.preview",
"tenant.planning_scenarios.apply",
```

Add policy helpers:

```ts
export function canReadProjectPlan(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.project_plan.read" });
}

export function canManageProjectPlan(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.project_plan.manage" });
}

export function canManageProjectBaselines(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.project_baselines.manage" });
}

export function canReadProjectResources(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.project_resources.read" });
}

export function canManageProjectResources(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.project_resources.manage" });
}

export function canPreviewPlanningScenarios(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.planning_scenarios.preview" });
}

export function canApplyPlanningScenarios(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({ ...input, permission: "tenant.planning_scenarios.apply" });
}
```

- [ ] **Step 8: Add access-control tests**

Extend `packages/access-control/src/policy.test.ts` with tests that prove:

```ts
expect(canReadProjectPlan({ actor, profile, targetTenantId: actor.tenantId }).allowed).toBe(true);
expect(canManageProjectPlan({ actor, profile, targetTenantId: "tenant-beta" }).reason).toBe("cross_tenant_denied");
expect(canApplyPlanningScenarios({ actor, profileWithoutScenarioApply, targetTenantId: actor.tenantId }).reason).toBe("permission_missing");
```

Use the existing test fixture style in that file.

- [ ] **Step 9: Run Slice A verification**

Run:

```bash
pnpm vitest run packages/domain/src/planning/planningCommands.test.ts packages/domain/src/planning/commandReducer.test.ts packages/access-control/src/policy.test.ts
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 10: Commit Slice A**

Run:

```bash
git add packages/domain/src packages/access-control/src
git commit -m "feat: define planning command contract"
```

---

### Task 2: Slice B1 Calendar and Work Model

**Files:**
- Create: `packages/domain/src/planning/workingTime.ts`
- Create: `packages/domain/src/planning/workingTime.test.ts`
- Create: `packages/domain/src/planning/calendar.ts`
- Create: `packages/domain/src/planning/calendar.test.ts`
- Create: `packages/domain/src/planning/workModel.ts`
- Create: `packages/domain/src/planning/workModel.test.ts`

- [ ] **Step 1: Add working-time and calendar tests**

Create `packages/domain/src/planning/workingTime.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { addWorkingMinutesToInstant, compareWorkingInstants } from "./workingTime";
import type { PlanCalendar } from "./types";

const calendar: PlanCalendar = {
  id: "calendar-default",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};

describe("working-time timeline", () => {
  it("supports minute precision and skips non-working days", () => {
    expect(
      addWorkingMinutesToInstant(
        { date: "2026-06-05", minuteOfDay: 240 },
        360,
        calendar,
        []
      )
    ).toEqual({ date: "2026-06-08", minuteOfDay: 120 });
  });

  it("supports negative lead across working days", () => {
    expect(
      addWorkingMinutesToInstant(
        { date: "2026-06-08", minuteOfDay: 120 },
        -360,
        calendar,
        []
      )
    ).toEqual({ date: "2026-06-05", minuteOfDay: 240 });
  });

  it("sorts instants by date and minute", () => {
    expect(
      compareWorkingInstants(
        { date: "2026-06-01", minuteOfDay: 60 },
        { date: "2026-06-01", minuteOfDay: 120 }
      )
    ).toBeLessThan(0);
  });
});
```

Create `packages/domain/src/planning/calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { addWorkingMinutes, countWorkingMinutes, isWorkingDate } from "./calendar";
import type { PlanCalendar, PlanCalendarException } from "./types";

const calendar: PlanCalendar = {
  id: "calendar-default",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};

describe("planning calendar", () => {
  it("skips weekends when adding working minutes", () => {
    expect(addWorkingMinutes("2026-06-05", 480, calendar, [])).toBe("2026-06-05");
    expect(addWorkingMinutes("2026-06-05", 960, calendar, [])).toBe("2026-06-08");
  });

  it("honors zero-minute exceptions", () => {
    const exceptions: PlanCalendarException[] = [
      {
        id: "exception-alpha",
        calendarId: "calendar-default",
        resourceId: null,
        date: "2026-06-08",
        workingMinutes: 0,
        reason: "Выходной"
      }
    ];

    expect(isWorkingDate("2026-06-08", calendar, exceptions)).toBe(false);
    expect(countWorkingMinutes("2026-06-05", "2026-06-08", calendar, exceptions)).toBe(480);
  });
});
```

- [ ] **Step 2: Add work model tests**

Create `packages/domain/src/planning/workModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { recalculateWorkModel } from "./workModel";

describe("Work / Duration / Units model", () => {
  it("keeps units fixed for fixed_units tasks", () => {
    expect(
      recalculateWorkModel({
        taskType: "fixed_units",
        effortDriven: false,
        workMinutes: 960,
        durationMinutes: 480,
        unitsPermille: 1000,
        changedField: "workMinutes"
      })
    ).toMatchObject({ durationMinutes: 960, unitsPermille: 1000 });
  });

  it("keeps work fixed for fixed_work effort-driven tasks", () => {
    expect(
      recalculateWorkModel({
        taskType: "fixed_work",
        effortDriven: true,
        workMinutes: 960,
        durationMinutes: 480,
        unitsPermille: 2000,
        changedField: "unitsPermille"
      })
    ).toMatchObject({ workMinutes: 960, durationMinutes: 240 });
  });

  it("keeps duration fixed for fixed_duration tasks", () => {
    expect(
      recalculateWorkModel({
        taskType: "fixed_duration",
        effortDriven: false,
        workMinutes: 960,
        durationMinutes: 480,
        unitsPermille: 1000,
        changedField: "workMinutes"
      })
    ).toMatchObject({ durationMinutes: 480, unitsPermille: 2000 });
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm vitest run packages/domain/src/planning/workingTime.test.ts packages/domain/src/planning/calendar.test.ts packages/domain/src/planning/workModel.test.ts
```

Expected: fail because implementation files do not exist.

- [ ] **Step 4: Implement working-time and calendar helpers**

Create `packages/domain/src/planning/workingTime.ts` before `calendar.ts`. It must be the only helper used by dependency lag/lead and resource allocation.

Required functions:

```ts
export function addWorkingMinutesToInstant(
  start: WorkingInstant,
  minutes: number,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant;

export function diffWorkingMinutes(
  start: WorkingInstant,
  finish: WorkingInstant,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): number;

export function compareWorkingInstants(left: WorkingInstant, right: WorkingInstant): number;

export function maxWorkingInstant(left: WorkingInstant, right: WorkingInstant): WorkingInstant;

export function minWorkingInstant(left: WorkingInstant, right: WorkingInstant): WorkingInstant;
```

Implementation rules:

- `minuteOfDay` is measured inside the working day, from `0` to `workingMinutesPerDay`.
- Positive minutes move forward across working days and exceptions.
- Negative minutes move backward across working days and exceptions.
- Zero-working-time calendars throw `calendar_has_no_working_time`.
- Date-only helpers in `calendar.ts` may wrap this module for display, but must not be used for dependency math.

Create `packages/domain/src/planning/calendar.ts`:

```ts
import type { PlanCalendar, PlanCalendarException, PlanDate } from "./types";
import { addWorkingMinutesToInstant } from "./workingTime";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isWorkingDate(
  date: PlanDate,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): boolean {
  return getWorkingMinutesForDate(date, calendar, exceptions) > 0;
}

export function getWorkingMinutesForDate(
  date: PlanDate,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): number {
  const exception = exceptions.find(
    (candidate) => candidate.calendarId === calendar.id && candidate.date === date
  );
  if (exception) return exception.workingMinutes;

  const day = parsePlanDate(date).getUTCDay();
  return calendar.workingWeekdays.includes(day) ? calendar.workingMinutesPerDay : 0;
}

export function countWorkingMinutes(
  start: PlanDate,
  finish: PlanDate,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): number {
  let total = 0;
  forEachDate(start, finish, (date) => {
    total += getWorkingMinutesForDate(date, calendar, exceptions);
  });
  return total;
}

export function addWorkingMinutes(
  start: PlanDate,
  minutes: number,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): PlanDate {
  return addWorkingMinutesToInstant(
    { date: start, minuteOfDay: 0 },
    minutes,
    calendar,
    exceptions
  ).date;
}

export function addDays(date: PlanDate, days: number): PlanDate {
  const parsed = parsePlanDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatPlanDate(parsed);
}

export function maxPlanDate(left: PlanDate, right: PlanDate): PlanDate {
  return left > right ? left : right;
}

export function minPlanDate(left: PlanDate, right: PlanDate): PlanDate {
  return left < right ? left : right;
}

export function diffCalendarDays(start: PlanDate, finish: PlanDate): number {
  return Math.round((parsePlanDate(finish).getTime() - parsePlanDate(start).getTime()) / DAY_MS);
}

function forEachDate(start: PlanDate, finish: PlanDate, visit: (date: PlanDate) => void): void {
  const totalDays = diffCalendarDays(start, finish);
  for (let offset = 0; offset <= totalDays; offset += 1) {
    visit(addDays(start, offset));
  }
}

function parsePlanDate(value: PlanDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatPlanDate(value: Date): PlanDate {
  return value.toISOString().slice(0, 10);
}
```

- [ ] **Step 5: Implement work model helpers**

Create `packages/domain/src/planning/workModel.ts`:

```ts
import type { TaskType } from "./types";

export type WorkModelInput = {
  taskType: TaskType;
  effortDriven: boolean;
  workMinutes: number;
  durationMinutes: number;
  unitsPermille: number;
  changedField: "workMinutes" | "durationMinutes" | "unitsPermille";
};

export type WorkModelResult = {
  workMinutes: number;
  durationMinutes: number;
  unitsPermille: number;
};

export function recalculateWorkModel(input: WorkModelInput): WorkModelResult {
  assertPositive(input.durationMinutes, "durationMinutes");
  assertPositive(input.unitsPermille, "unitsPermille");
  assertNonNegative(input.workMinutes, "workMinutes");

  if (input.taskType === "fixed_units") {
    return {
      workMinutes: input.workMinutes,
      durationMinutes: Math.max(1, Math.round((input.workMinutes * 1000) / input.unitsPermille)),
      unitsPermille: input.unitsPermille
    };
  }

  if (input.taskType === "fixed_work") {
    if (input.effortDriven || input.changedField === "unitsPermille") {
      return {
        workMinutes: input.workMinutes,
        durationMinutes: Math.max(1, Math.round((input.workMinutes * 1000) / input.unitsPermille)),
        unitsPermille: input.unitsPermille
      };
    }
    return {
      workMinutes: input.workMinutes,
      durationMinutes: input.durationMinutes,
      unitsPermille: Math.max(1, Math.round((input.workMinutes * 1000) / input.durationMinutes))
    };
  }

  return {
    workMinutes: input.workMinutes,
    durationMinutes: input.durationMinutes,
    unitsPermille: Math.max(1, Math.round((input.workMinutes * 1000) / input.durationMinutes))
  };
}

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`invalid_${field}`);
  }
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid_${field}`);
  }
}
```

- [ ] **Step 6: Add assignment-aware work-model reducer tests**

Extend `packages/domain/src/planning/workModel.test.ts` with cases proving that assignment units affect task duration:

```ts
it("derives task duration from total assignment units", () => {
  expect(
    recalculateWorkModel({
      taskType: "fixed_units",
      effortDriven: false,
      workMinutes: 960,
      durationMinutes: 480,
      unitsPermille: 2000,
      changedField: "workMinutes"
    })
  ).toMatchObject({ durationMinutes: 480, unitsPermille: 2000 });
});
```

The scheduling engine in Task 3 must call this work-model logic from task assignments; a passing isolated work-model suite is not sufficient.

- [ ] **Step 7: Run Slice B1 verification**

Run:

```bash
pnpm vitest run packages/domain/src/planning/workingTime.test.ts packages/domain/src/planning/calendar.test.ts packages/domain/src/planning/workModel.test.ts
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 8: Commit Slice B1**

Run:

```bash
git add packages/domain/src/planning
git commit -m "feat: add planning calendar and work model"
```

---

### Task 3: Slice B2 Dependency Graph and Scheduling Engine

**Files:**
- Create: `packages/domain/src/planning/dependencyGraph.ts`
- Create: `packages/domain/src/planning/dependencyGraph.test.ts`
- Create: `packages/domain/src/planning/schedulingEngine.ts`
- Create: `packages/domain/src/planning/schedulingEngine.test.ts`

- [ ] **Step 1: Add dependency graph and topological-order tests**

Create `packages/domain/src/planning/dependencyGraph.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  detectDependencyCycles,
  getDependencyStartCandidate,
  getTopologicalTaskOrder
} from "./dependencyGraph";

describe("dependency graph", () => {
  it("detects dependency cycles", () => {
    expect(
      detectDependencyCycles([
        { id: "dep-1", predecessorTaskId: "a", successorTaskId: "b", type: "FS", lagMinutes: 0 },
        { id: "dep-2", predecessorTaskId: "b", successorTaskId: "a", type: "FS", lagMinutes: 0 }
      ])
    ).toEqual(["a", "b"]);
  });

  it("supports FS/SS/FF/SF dependency candidates with lag", () => {
    expect(
      getDependencyStartCandidate({
        dependency: { id: "dep", predecessorTaskId: "a", successorTaskId: "b", type: "FS", lagMinutes: 480 },
        predecessorStart: { date: "2026-06-01", minuteOfDay: 0 },
        predecessorFinish: { date: "2026-06-03", minuteOfDay: 480 },
        successorDurationMinutes: 480,
        calendar: { id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 },
        exceptions: []
      })
    ).toEqual({ date: "2026-06-04", minuteOfDay: 480 });
  });

  it("orders tasks topologically even when WBS order differs from dependency order", () => {
    expect(
      getTopologicalTaskOrder(
        ["task-late-wbs", "task-early-wbs"],
        [
          {
            id: "dep",
            predecessorTaskId: "task-early-wbs",
            successorTaskId: "task-late-wbs",
            type: "FS",
            lagMinutes: 0
          }
        ]
      )
    ).toEqual(["task-early-wbs", "task-late-wbs"]);
  });
});
```

- [ ] **Step 2: Add scheduling engine tests**

Create `packages/domain/src/planning/schedulingEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculatePlan } from "./schedulingEngine";
import type { PlanSnapshot } from "./types";

const baseSnapshot: PlanSnapshot = {
  tenantId: "tenant-alpha",
  projectId: "project-alpha",
  planVersion: 1,
  project: {
    id: "project-alpha",
    sourceType: "opportunity",
    sourceOpportunityId: "opportunity-alpha",
    plannedStart: "2026-06-01",
    plannedFinish: "2026-06-30",
    deadline: "2026-06-30",
    calendarId: "calendar-default"
  },
  calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
  calendarExceptions: [],
  resources: [],
  assignments: [],
  baselines: [],
  reservations: [],
  constraints: [],
  capturedAt: "2026-05-21T00:00:00.000Z",
  tasks: [
    {
      id: "task-a",
      parentTaskId: null,
      wbsCode: "1",
      title: "A",
      statusId: "todo",
      schedulingMode: "auto",
      taskType: "fixed_units",
      effortDriven: false,
      plannedStart: "2026-06-01",
      plannedFinish: null,
      durationMinutes: 960,
      workMinutes: 960,
      percentComplete: 0,
      calendarId: "calendar-default",
      constraint: null
    },
    {
      id: "task-b",
      parentTaskId: null,
      wbsCode: "2",
      title: "B",
      statusId: "todo",
      schedulingMode: "auto",
      taskType: "fixed_units",
      effortDriven: false,
      plannedStart: null,
      plannedFinish: null,
      durationMinutes: 480,
      workMinutes: 480,
      percentComplete: 0,
      calendarId: "calendar-default",
      constraint: null
    }
  ],
  dependencies: [
    { id: "dep-a-b", predecessorTaskId: "task-a", successorTaskId: "task-b", type: "FS", lagMinutes: 0 }
  ]
};

describe("scheduling engine", () => {
  it("calculates deterministic dates and critical path", () => {
    const result = calculatePlan(baseSnapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    expect(result.tasks.map((task) => [task.id, task.calculatedStart, task.calculatedFinish])).toEqual([
      ["task-a", "2026-06-01", "2026-06-02"],
      ["task-b", "2026-06-03", "2026-06-03"]
    ]);
    expect(result.criticalPathTaskIds).toEqual(["task-a", "task-b"]);
    expect(result.validationIssues).toEqual([]);
  });

  it("does not mark parallel slack tasks as critical", () => {
    const result = calculatePlan(
      {
        ...baseSnapshot,
        tasks: [
          ...baseSnapshot.tasks,
          {
            id: "task-side",
            parentTaskId: null,
            wbsCode: "3",
            title: "Side",
            statusId: "todo",
            schedulingMode: "auto",
            taskType: "fixed_units",
            effortDriven: false,
            plannedStart: "2026-06-01",
            plannedFinish: null,
            durationMinutes: 480,
            workMinutes: 480,
            percentComplete: 0,
            calendarId: "calendar-default",
            constraint: null
          }
        ]
      },
      { calculatedAt: "2026-05-21T00:00:00.000Z", engineVersion: "planning-core-v1" }
    );

    expect(result.criticalPathTaskIds).toEqual(["task-a", "task-b"]);
    expect(result.tasks.find((task) => task.id === "task-side")).toMatchObject({
      isCritical: false,
      totalSlackMinutes: expect.any(Number)
    });
  });

  it("returns validation issues for dependency cycles", () => {
    const result = calculatePlan(
      {
        ...baseSnapshot,
        dependencies: [
          ...baseSnapshot.dependencies,
          { id: "dep-b-a", predecessorTaskId: "task-b", successorTaskId: "task-a", type: "FS", lagMinutes: 0 }
        ]
      },
      { calculatedAt: "2026-05-21T00:00:00.000Z", engineVersion: "planning-core-v1" }
    );

    expect(result.validationIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "dependency_cycle_detected", severity: "error" })])
    );
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm vitest run packages/domain/src/planning/dependencyGraph.test.ts packages/domain/src/planning/schedulingEngine.test.ts
```

Expected: fail because implementation files do not exist.

- [ ] **Step 4: Implement dependency graph**

Create `packages/domain/src/planning/dependencyGraph.ts`.

Required exports:

```ts
export function detectDependencyCycles(dependencies: PlanDependency[]): string[];
export function getTopologicalTaskOrder(taskIds: string[], dependencies: PlanDependency[]): string[];
export function getDependencyStartCandidate(input: DependencyCandidateInput): WorkingInstant;
```

Implementation rules:

- `getTopologicalTaskOrder` must be used by `calculatePlan`.
- A predecessor that appears later by WBS must still be calculated before its successor.
- Cycle detection must return blocking validation issues before scheduling.
- Dependency candidate math must use `WorkingInstant`, not date-only strings.
- FS, SS, FF and SF must each have dedicated tests with lag and lead.

Minimum dependency semantics:

```ts
type DependencyCandidateInput = {
  dependency: PlanDependency;
  predecessorStart: WorkingInstant;
  predecessorFinish: WorkingInstant;
  successorDurationMinutes: number;
  calendar: PlanCalendar;
  exceptions: PlanCalendarException[];
};
```

For task-list wrappers, `projectId` must be either the selected project id or the explicit `workspace-inbox-project` id for the tenant. Do not permit `null`/missing project ids in `PlanningCommand`.

Do not implement dependency math with the date-only `addWorkingMinutes` wrapper.

- [ ] **Step 5: Implement scheduling engine**

Create `packages/domain/src/planning/schedulingEngine.ts`.

Required algorithm:

1. Validate task work models and calendars.
2. Detect cycles.
3. Build topological order from dependencies.
4. Forward pass: calculate earliest start/finish from constraints, calendars, assignment-derived duration and dependency candidates.
5. Backward pass: calculate latest start/finish from project finish/deadline and successor constraints.
6. Compute `totalSlackMinutes = latestStart - earliestStart`.
7. Mark `isCritical` only when slack is `0` and task is on a path to project finish.
8. Return stable output sorted by WBS for display, but never use WBS as scheduling order.

```ts
export type CalculatePlanOptions = {
  calculatedAt: string;
  engineVersion: string;
};
```

The implementation must call `recalculateWorkModel` using total assignment units for each task. If a task has no executor/co-executor assignments, use the task's own duration/work values and return an `assignment_without_resource` warning when work is greater than zero.

- [ ] **Step 6: Run Slice B2 verification**

Run:

```bash
pnpm vitest run packages/domain/src/planning/dependencyGraph.test.ts packages/domain/src/planning/schedulingEngine.test.ts
pnpm test -- --run packages/domain/src/planning
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 7: Add blocking tests before committing**

Before committing, add tests for:

- `SS`;
- `FF`;
- `SF`;
- positive lag;
- negative lead;
- predecessor appears after successor by WBS;
- parallel non-critical task with positive slack;
- assignment units changing duration;
- `start_no_earlier_than`;
- `finish_no_later_than`;
- invalid work model.

Use `packages/domain/src/planning/schedulingEngine.test.ts` and `packages/domain/src/planning/dependencyGraph.test.ts`.

- [ ] **Step 8: Commit Slice B2**

Run:

```bash
git add packages/domain/src/planning
git commit -m "feat: add deterministic scheduling engine"
```

---

### Task 4: Slice C Persistence and Snapshot Adapter

**Files:**
- Create: `packages/persistence/migrations/0010_phase_5_6_planning_core.sql`
- Create: `packages/persistence/src/planningRepository.ts`
- Create: `packages/persistence/src/planningRepository.db.test.ts`
- Modify: `packages/persistence/src/schema.ts`
- Modify: `packages/persistence/src/index.ts`
- Modify: `packages/persistence/src/migration.test.ts`
- Modify: `packages/persistence/src/schema.test.ts`
- Modify: `apps/api/src/apiTypes.ts`

- [ ] **Step 1: Add DB tests for snapshot assembly and same-project dependency**

Create `packages/persistence/src/planningRepository.db.test.ts` with tests that:

- seed tenant, users, active project and two tasks;
- seed `workspace-inbox-project` and assert a wrapper-created projectless task resolves into that project;
- assert `workspace-inbox-project` has `project_source_type = 'workspace_inbox'`, `source_opportunity_id = null` and does not require a CRM opportunity;
- assert a tenant cannot create a second `workspace_inbox` project;
- insert a same-project dependency and assert `buildPlanSnapshot("tenant-alpha", "project-alpha")` includes it;
- attempt cross-project dependency insertion and expect PostgreSQL constraint failure;
- apply a planning state mutation and assert `plan_versions.version` increments.

Use existing DB test setup from `packages/persistence/src/repositories.db.test.ts` and `packages/persistence/src/crmRepository.db.test.ts`.

- [ ] **Step 2: Run DB test to verify failure**

Run:

```bash
pnpm vitest run --config vitest.db.config.ts packages/persistence/src/planningRepository.db.test.ts
```

Expected: fail because migration/repository do not exist.

- [ ] **Step 3: Add migration**

Create `packages/persistence/migrations/0010_phase_5_6_planning_core.sql`.

Required tables:

```sql
ALTER TABLE "projects"
  ADD COLUMN "project_source_type" text NOT NULL DEFAULT 'opportunity';

ALTER TABLE "projects"
  ALTER COLUMN "source_opportunity_id" DROP NOT NULL;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_source_type_chk"
  CHECK ("project_source_type" in ('opportunity', 'workspace_inbox', 'manual'));

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_source_shape_chk"
  CHECK (
    ("project_source_type" = 'opportunity' AND "source_opportunity_id" IS NOT NULL)
    OR ("project_source_type" in ('workspace_inbox', 'manual') AND "source_opportunity_id" IS NULL)
  );

CREATE UNIQUE INDEX "projects_tenant_workspace_inbox_uidx"
  ON "projects" ("tenant_id")
  WHERE "project_source_type" = 'workspace_inbox';

CREATE TABLE "task_dependencies" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "id" text NOT NULL,
  "predecessor_task_id" text NOT NULL,
  "successor_task_id" text NOT NULL,
  "dependency_type" text NOT NULL,
  "lag_minutes" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL,
  PRIMARY KEY ("tenant_id", "project_id", "id"),
  CONSTRAINT "task_dependencies_type_chk" CHECK ("dependency_type" in ('FS', 'SS', 'FF', 'SF')),
  CONSTRAINT "task_dependencies_distinct_tasks_chk" CHECK ("predecessor_task_id" <> "successor_task_id"),
  CONSTRAINT "task_dependencies_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE,
  CONSTRAINT "task_dependencies_predecessor_fk" FOREIGN KEY ("tenant_id", "project_id", "predecessor_task_id") REFERENCES "tasks" ("tenant_id", "project_id", "id") ON DELETE CASCADE,
  CONSTRAINT "task_dependencies_successor_fk" FOREIGN KEY ("tenant_id", "project_id", "successor_task_id") REFERENCES "tasks" ("tenant_id", "project_id", "id") ON DELETE CASCADE
);

CREATE TABLE "plan_versions" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "version" integer NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  PRIMARY KEY ("tenant_id", "project_id"),
  CONSTRAINT "plan_versions_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE
);

CREATE TABLE "planning_scenario_runs" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "id" text NOT NULL,
  "plan_version" integer NOT NULL,
  "engine_version" text NOT NULL,
  "target_conflict_json" jsonb NOT NULL,
  "proposal_json" jsonb NOT NULL,
  "proposal_hash" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "applied_at" timestamp with time zone,
  PRIMARY KEY ("tenant_id", "project_id", "id"),
  CONSTRAINT "planning_scenario_runs_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id") ON DELETE CASCADE
);
```

Keep the existing `projects_tenant_source_opportunity_uidx`; PostgreSQL permits multiple `NULL` values, so non-opportunity projects do not collide. Existing rows become `project_source_type = 'opportunity'` through the default.

Also add:

- `project_calendars`;
- `resource_calendars`;
- `calendar_exceptions`;
- `resource_reservations`;
- `planning_scenario_runs` when proposal apply uses stored `proposalId`;
- `project_baselines`;
- `project_baseline_tasks`;
- `project_baseline_assignments`.

If Phase 4 `tasks` table does not yet contain planning columns, add nullable/default columns:

- `parent_task_id`;
- `wbs_code`;
- `scheduling_mode`;
- `task_type`;
- `effort_driven`;
- `duration_minutes`;
- `work_minutes`;
- `percent_complete`;
- `calendar_id`;
- `constraint_type`;
- `constraint_date`.

- [ ] **Step 4: Add Drizzle schema**

Modify `packages/persistence/src/schema.ts` with table definitions matching migration names and constraints.

Use existing tenant-scoped primary key style:

```ts
primaryKey({
  name: "task_dependencies_pkey",
  columns: [table.tenantId, table.projectId, table.id]
})
```

- [ ] **Step 5: Add planning repository**

Create `packages/persistence/src/planningRepository.ts`:

```ts
import type { CalculatedPlan, PlanSnapshot } from "@kiss-pm/domain";

export type PlanningRepository = {
  buildPlanSnapshot(tenantId: string, projectId: string): Promise<PlanSnapshot | undefined>;
  getPlanVersion(tenantId: string, projectId: string): Promise<number>;
  incrementPlanVersion(tenantId: string, projectId: string): Promise<number>;
  saveCalculatedPlan?(plan: CalculatedPlan): Promise<void>;
};
```

Then implement `createPlanningRepository(database)` using the existing repository style in `packages/persistence/src/projectIntakeRepository.ts` and `packages/persistence/src/repositories.ts`.

- [ ] **Step 6: Export planning repository**

Modify `packages/persistence/src/index.ts`:

```ts
export * from "./planningRepository";
```

- [ ] **Step 7: Extend API data source type**

Modify `apps/api/src/apiTypes.ts` by adding optional planning methods:

Also update backend `ProjectRecord` / API contract types so `sourceOpportunityId` is nullable and project source is explicit:

```ts
sourceType: "opportunity" | "workspace_inbox" | "manual";
sourceOpportunityId: string | null;
```

```ts
  buildPlanSnapshot?(tenantId: TenantId, projectId: string): Promise<PlanSnapshot | undefined>;
  getPlanVersion?(tenantId: TenantId, projectId: string): Promise<number>;
  incrementPlanVersion?(tenantId: TenantId, projectId: string): Promise<number>;
```

Import `PlanSnapshot` from `@kiss-pm/domain`.

- [ ] **Step 8: Run Slice C verification**

Run:

```bash
pnpm vitest run packages/persistence/src/schema.test.ts packages/persistence/src/migration.test.ts
pnpm vitest run --config vitest.db.config.ts packages/persistence/src/planningRepository.db.test.ts
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 9: Commit Slice C**

Run:

```bash
git add packages/persistence apps/api/src/apiTypes.ts
git commit -m "feat: persist planning snapshots"
```

---

### Task 5: Slice D Planning Application and API Commands

**Files:**
- Create: `apps/api/src/planningParsers.ts`
- Create: `apps/api/src/planningParsers.test.ts`
- Create: `apps/api/src/planningRoutes.ts`
- Create: `apps/api/src/planningRoutes.db.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/inMemoryTenantDataSource.ts`
- Modify: `apps/api/src/projectWorkRoutes.ts` if present after Phase 4 merge
- Modify: `apps/api/src/projectWorkRoutes.db.test.ts` if present after Phase 4 merge

- [ ] **Step 1: Add parser tests**

Create `apps/api/src/planningParsers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseApplyPlanningCommandBody, parsePreviewPlanningCommandBody } from "./planningParsers";

describe("planning parsers", () => {
  it("parses preview command body", () => {
    expect(
      parsePreviewPlanningCommandBody({
        clientPlanVersion: 1,
        command: {
          type: "dependency.upsert",
          payload: {
            id: "dep-alpha",
            predecessorTaskId: "task-a",
            successorTaskId: "task-b",
            dependencyType: "FS",
            lagMinutes: 0
          }
        }
      })
    ).toMatchObject({ ok: true });
  });

  it("rejects missing clientPlanVersion", () => {
    expect(parseApplyPlanningCommandBody({ command: { type: "task.create", payload: {} } })).toMatchObject({
      ok: false,
      error: "planning_command_invalid"
    });
  });

  it("rejects unknown command types and malformed payloads", () => {
    expect(
      parsePreviewPlanningCommandBody({
        clientPlanVersion: 1,
        command: { type: "task.teleport", payload: {} }
      })
    ).toMatchObject({ ok: false, error: "planning_command_invalid" });

    expect(
      parsePreviewPlanningCommandBody({
        clientPlanVersion: 1,
        command: {
          type: "assignment.upsert",
          payload: { id: "assignment-a", unitsPermille: 0 }
        }
      })
    ).toMatchObject({ ok: false, error: "planning_command_invalid" });
  });

  it.each([
    taskCreateBody,
    taskUpdateIdentityBody,
    taskUpdateScheduleBody,
    taskUpdateWorkModelBody,
    taskUpdateStatusBody,
    taskMoveWbsBody,
    taskDeleteOrArchiveBody,
    dependencyUpsertBody,
    dependencyDeleteBody,
    assignmentUpsertBody,
    assignmentDeleteBody,
    baselineCaptureBody,
    calendarExceptionUpsertBody,
    constraintUpdateBody,
    resourceReserveBody,
    riskAcceptOverloadBody,
    projectDeadlineMoveBody
  ])("strictly parses every PlanningCommand variant", (command) => {
    expect(parsePreviewPlanningCommandBody({ clientPlanVersion: 1, command })).toMatchObject({ ok: true });
  });

  it("rejects unknown fields inside command payloads", () => {
    expect(
      parsePreviewPlanningCommandBody({
        clientPlanVersion: 1,
        command: {
          ...dependencyUpsertBody,
          payload: { ...dependencyUpsertBody.payload, unexpected: "field" }
        }
      })
    ).toMatchObject({ ok: false, error: "planning_command_invalid" });
  });
});
```

Define the `*Body` fixtures in the parser test file with valid minimal payloads for every `PlanningCommand` variant, then mutate those fixtures in negative tests for missing fields, unknown fields and invalid enum/date/numeric values.

- [ ] **Step 2: Add API DB tests**

Create `apps/api/src/planningRoutes.db.test.ts` with tests for:

- `GET /api/workspace/projects/:projectId/planning/read-model` returns `planVersion`, calculated tasks and validation issues;
- `POST /preview-command` returns after-state and does not mutate DB;
- `POST /apply-command` increments plan version and writes audit;
- stale `clientPlanVersion` returns `409 { error: "plan_version_conflict" }`;
- user missing `tenant.project_plan.manage` receives 403 and denied audit if current audit policy requires it.

Use existing app DB test style from `apps/api/src/app.db.test.ts` and Phase 4 `projectWorkRoutes.db.test.ts` when available.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm vitest run apps/api/src/planningParsers.test.ts
pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts
```

Expected: fail because parser/routes do not exist.

- [ ] **Step 4: Implement parsers**

Create `apps/api/src/planningParsers.ts` using existing `parseHelpers.ts` style.

Parser requirements:

- Reject unknown command types.
- Reject missing or unknown payload fields for every command variant.
- Validate `YYYY-MM-DD` dates with strict date parsing.
- Validate `unitsPermille > 0`, `workMinutes >= 0`, `durationMinutes > 0` when present.
- Validate dependency type is exactly `FS`, `SS`, `FF` or `SF`.
- Validate task type is exactly `fixed_units`, `fixed_work` or `fixed_duration`.
- Validate constraint type is one of the canonical contract values.
- Validate `idempotencyKey` length and characters when present.
- Return `{ ok: false, error: "planning_command_invalid" }` for every malformed command.
- Use one explicit parser branch per `PlanningCommand` variant and enforce exact payload keys. Do not commit a parser that only supports `dependency.upsert`.

```ts
import type { PlanningCommand } from "@kiss-pm/domain";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type PreviewPlanningCommandBody = {
  clientPlanVersion: number;
  command: PlanningCommand;
};

export type ApplyPlanningCommandBody = PreviewPlanningCommandBody & {
  idempotencyKey?: string;
};

export function parsePreviewPlanningCommandBody(value: unknown): ParseResult<PreviewPlanningCommandBody> {
  return parseCommandBody(value, false);
}

export function parseApplyPlanningCommandBody(value: unknown): ParseResult<ApplyPlanningCommandBody> {
  return parseCommandBody(value, true);
}

function parseCommandBody(value: unknown, allowIdempotencyKey: boolean): ParseResult<ApplyPlanningCommandBody> {
  if (!value || typeof value !== "object") return { ok: false, error: "planning_command_invalid" };
  const body = value as Record<string, unknown>;
  if (!Number.isInteger(body.clientPlanVersion)) return { ok: false, error: "planning_command_invalid" };
  const command = parsePlanningCommand(body.command);
  if (!command.ok) return command;
  if (
    allowIdempotencyKey &&
    body.idempotencyKey !== undefined &&
    (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 120)
  ) {
    return { ok: false, error: "planning_command_invalid" };
  }
  return {
    ok: true,
    value: {
      clientPlanVersion: body.clientPlanVersion,
      command: command.value,
      ...(allowIdempotencyKey && typeof body.idempotencyKey === "string"
        ? { idempotencyKey: body.idempotencyKey }
        : {})
    }
  };
}

function parsePlanningCommand(value: unknown): ParseResult<PlanningCommand> {
  if (!value || typeof value !== "object") return { ok: false, error: "planning_command_invalid" };
  const command = value as Record<string, unknown>;

  switch (command.type) {
    case "task.create":
      return parseTaskCreateCommand(command);
    case "task.update_identity":
      return parseTaskUpdateIdentityCommand(command);
    case "task.update_schedule":
      return parseTaskUpdateScheduleCommand(command);
    case "task.update_work_model":
      return parseTaskUpdateWorkModelCommand(command);
    case "task.update_status":
      return parseTaskUpdateStatusCommand(command);
    case "task.move_wbs":
      return parseTaskMoveWbsCommand(command);
    case "task.delete_or_archive":
      return parseTaskDeleteOrArchiveCommand(command);
    case "dependency.upsert":
      return parseDependencyUpsertCommand(command);
    case "dependency.delete":
      return parseDependencyDeleteCommand(command);
    case "assignment.upsert":
      return parseAssignmentUpsertCommand(command);
    case "assignment.delete":
      return parseAssignmentDeleteCommand(command);
    case "baseline.capture":
      return parseBaselineCaptureCommand(command);
    case "calendar.exception.upsert":
      return parseCalendarExceptionUpsertCommand(command);
    case "constraint.update":
      return parseConstraintUpdateCommand(command);
    case "resource.reserve":
      return parseResourceReserveCommand(command);
    case "risk.accept_overload":
      return parseRiskAcceptOverloadCommand(command);
    case "project.deadline.move":
      return parseProjectDeadlineMoveCommand(command);
    default:
      return { ok: false, error: "planning_command_invalid" };
  }
}
```

Each `parse*Command` helper must validate required fields, reject unknown fields and return a fully typed command without `as PlanningCommand` unless all payload keys have been checked.

- [ ] **Step 5: Implement planning routes**

Create `apps/api/src/planningRoutes.ts` with:

- session actor resolution;
- `canReadProjectPlan` for read model;
- `canManageProjectPlan` for preview/apply command;
- `buildPlanSnapshot`;
- `calculatePlan`;
- `getPlanVersion`;
- `incrementPlanVersion`;
- `reducePlanningCommand`;
- audit via `appendManagementAuditEvent`.

Route skeleton:

```ts
export function registerPlanningRoutes(app: Hono, deps: PlanningRouteDeps) {
  app.get("/api/workspace/projects/:projectId/planning/read-model", async (context) => {
    // session, permission, snapshot, calculatePlan, return JSON
  });

  app.post("/api/workspace/projects/:projectId/planning/preview-command", async (context) => {
    // parse, permission, plan version check, reducePlanningCommand, calculate next snapshot, no persistence
  });

  app.post("/api/workspace/projects/:projectId/planning/apply-command", async (context) => {
    // parse, permission, transaction, plan version check, reducePlanningCommand, persist PlanDelta, increment version, audit, recalc
  });
}
```

Return `501 { error: "persistence_not_configured" }` when required data source methods are absent.

Preview and apply must call the same `reducePlanningCommand(snapshot, command)` function. A route handler must never directly mutate task dates, dependencies, assignments, constraints or reservations.

- [ ] **Step 6: Register routes**

Modify `apps/api/src/app.ts`:

```ts
import { registerPlanningRoutes } from "./planningRoutes";
```

and call:

```ts
registerPlanningRoutes(app, routeDeps);
```

after project/workspace routes are registered.

- [ ] **Step 7: Add task CRUD wrapper integration**

If `apps/api/src/projectWorkRoutes.ts` exists:

- update create/update task handlers to call planning application service or data source method that accepts `PlanningCommand`;
- keep existing endpoint URLs stable for already-shipped task/project API consumers;
- ensure date/work/assignment changes do not write directly around planning command.

Add compatibility test:

```ts
it("routes task CRUD creation through planning command and increments plan version", async () => {
  // POST /api/workspace/projects/:projectId/tasks
  // assert task appears in planning/read-model
  // assert planVersion increments
  // assert audit actionType is planning.task.created
});
```

If the file does not exist yet, add a `docs/status` note in the implementation PR that wrapper integration is blocked until Phase 4 task backend is merged.

- [ ] **Step 8: Run Slice D verification**

Run:

```bash
pnpm vitest run apps/api/src/planningParsers.test.ts
pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 9: Commit Slice D**

Run:

```bash
git add apps/api/src packages/domain/src/planning packages/persistence/src
git commit -m "feat: expose planning command API"
```

---

### Task 6: Slice E Resource Planning

**Files:**
- Create: `packages/domain/src/planning/resourcePlanning.ts`
- Create: `packages/domain/src/planning/resourcePlanning.test.ts`
- Modify: `apps/api/src/planningRoutes.ts`
- Modify: `apps/api/src/planningRoutes.db.test.ts`

- [ ] **Step 1: Add resource planning tests**

Create `packages/domain/src/planning/resourcePlanning.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildResourceLoadMatrix } from "./resourcePlanning";
import type { CalculatedPlan, PlanResource } from "./types";

describe("resource planning", () => {
  it("builds day/week/month load buckets and overload drilldown", () => {
    const resources: PlanResource[] = [
      { id: "resource-egor", userId: "user-egor", positionId: "engineer", teamId: null, name: "Егор", calendarId: null }
    ];
    const plan = {
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      planVersion: 1,
      engineVersion: "planning-core-v1",
      calculatedAt: "2026-05-21T00:00:00.000Z",
      projectFinish: "2026-06-01",
      criticalPathTaskIds: ["task-a"],
      validationIssues: [],
      dependencies: [],
      tasks: [
        {
          id: "task-a",
          title: "A",
          parentTaskId: null,
          wbsCode: "1",
          statusId: "todo",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-01",
          durationMinutes: 480,
          workMinutes: 960,
          percentComplete: 0,
          calendarId: null,
          constraint: null,
          calculatedStart: "2026-06-01",
          calculatedFinish: "2026-06-01",
          earliestStart: "2026-06-01",
          earliestFinish: "2026-06-01",
          latestStart: "2026-06-01",
          latestFinish: "2026-06-01",
          totalSlackMinutes: 0,
          isCritical: true
        }
      ]
    } satisfies CalculatedPlan;

    const matrix = buildResourceLoadMatrix({
      plan,
      resources,
      assignments: [{ id: "assignment-a", taskId: "task-a", resourceId: "resource-egor", role: "executor", unitsPermille: 1000, workMinutes: 960, calendarId: null }],
      calendars: [{ id: "default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
      calendarExceptions: [],
      reservations: [],
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01"
    });

    expect(matrix.overloads).toEqual([
      expect.objectContaining({
        resourceId: "resource-egor",
        date: "2026-06-01",
        overloadMinutes: 480,
        taskIds: ["task-a"]
      })
    ]);
    expect(matrix.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ granularity: "day" }),
        expect.objectContaining({ granularity: "week" }),
        expect.objectContaining({ granularity: "month" })
      ])
    );
    expect(matrix.freeCapacityBuckets).toEqual(expect.any(Array));
  });

  it("uses resource calendars, calendar exceptions and reservations in capacity", () => {
    const matrix = buildResourceLoadMatrix({
      plan: createOneDayCalculatedPlan({ workMinutes: 480 }),
      resources: [
        { id: "resource-egor", userId: "user-egor", positionId: "engineer", teamId: null, name: "Егор", calendarId: "calendar-egor" }
      ],
      assignments: [{ id: "assignment-a", taskId: "task-a", resourceId: "resource-egor", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null }],
      calendars: [{ id: "calendar-egor", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
      calendarExceptions: [{ id: "absence", calendarId: "calendar-egor", resourceId: "resource-egor", date: "2026-06-01", workingMinutes: 0, reason: "Отсутствие" }],
      reservations: [{ id: "reservation-a", resourceId: "resource-egor", projectId: "project-beta", start: "2026-06-01", finish: "2026-06-01", workMinutes: 120, reason: "Резерв" }],
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01"
    });

    expect(matrix.overloads[0]).toMatchObject({
      resourceId: "resource-egor",
      overloadMinutes: 600,
      taskIds: ["task-a"],
      reservationIds: ["reservation-a"],
      absenceReason: "Отсутствие"
    });
  });
});

function createOneDayCalculatedPlan(input: { workMinutes: number }): CalculatedPlan {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 1,
    engineVersion: "planning-core-v1",
    calculatedAt: "2026-05-21T00:00:00.000Z",
    projectFinish: "2026-06-01",
    criticalPathTaskIds: ["task-a"],
    validationIssues: [],
    dependencies: [],
    tasks: [
      {
        id: "task-a",
        title: "A",
        parentTaskId: null,
        wbsCode: "1",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: 480,
        workMinutes: input.workMinutes,
        percentComplete: 0,
        calendarId: null,
        constraint: null,
        calculatedStart: "2026-06-01",
        calculatedFinish: "2026-06-01",
        calculatedStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
        calculatedFinishInstant: { date: "2026-06-01", minuteOfDay: 480 },
        earliestStart: "2026-06-01",
        earliestFinish: "2026-06-01",
        earliestStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
        earliestFinishInstant: { date: "2026-06-01", minuteOfDay: 480 },
        latestStart: "2026-06-01",
        latestFinish: "2026-06-01",
        latestStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
        latestFinishInstant: { date: "2026-06-01", minuteOfDay: 480 },
        totalSlackMinutes: 0,
        isCritical: true
      }
    ]
  };
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm vitest run packages/domain/src/planning/resourcePlanning.test.ts
```

Expected: fail because `resourcePlanning.ts` does not exist.

- [ ] **Step 3: Implement resource planning module**

Create `packages/domain/src/planning/resourcePlanning.ts`:

Implementation requirements:

- Emit `day`, `week` and `month` buckets in one result.
- Use each resource's own calendar when present; fall back to project/default calendar only when resource calendar is absent.
- Apply calendar exceptions before capacity calculation.
- Add reservations into assigned load and drilldown.
- Allocate task work only across working days/instants between calculated start and finish.
- Return `freeCapacityBuckets`.
- Return overload drilldown with `taskIds`, `reservationIds`, `absenceReason` and `capacityMinutes`.
- Do not divide work by raw calendar-day count.

```ts
import { diffCalendarDays, addDays } from "./calendar";
import type {
  BucketGranularity,
  CalculatedPlan,
  PlanAssignment,
  PlanCalendar,
  PlanCalendarException,
  PlanDate,
  PlanReservation,
  PlanResource
} from "./types";

export type ResourceLoadBucket = {
  resourceId: string;
  date: PlanDate;
  granularity: BucketGranularity;
  assignedMinutes: number;
  capacityMinutes: number;
  taskIds: string[];
};

export type ResourceOverload = ResourceLoadBucket & {
  overloadMinutes: number;
  reservationIds: string[];
  absenceReason: string | null;
};

export type ResourceLoadMatrix = {
  buckets: ResourceLoadBucket[];
  freeCapacityBuckets: ResourceLoadBucket[];
  overloads: ResourceOverload[];
};

export function buildResourceLoadMatrix(input: {
  plan: CalculatedPlan;
  resources: PlanResource[];
  assignments: PlanAssignment[];
  calendars: PlanCalendar[];
  calendarExceptions: PlanCalendarException[];
  reservations: PlanReservation[];
  rangeStart: PlanDate;
  rangeFinish: PlanDate;
}): ResourceLoadMatrix {
  const buckets: ResourceLoadBucket[] = [];
  const defaultCalendar = input.calendars[0] ?? { id: "default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 };

  for (const resource of input.resources) {
    for (const date of enumerateDates(input.rangeStart, input.rangeFinish)) {
      const taskIds: string[] = [];
      let assignedMinutes = 0;

      for (const assignment of input.assignments.filter((candidate) => candidate.resourceId === resource.id)) {
        const task = input.plan.tasks.find((candidate) => candidate.id === assignment.taskId);
        if (!task?.calculatedStart || !task.calculatedFinish) continue;
        if (date < task.calculatedStart || date > task.calculatedFinish) continue;

        const taskDays = Math.max(1, diffCalendarDays(task.calculatedStart, task.calculatedFinish) + 1);
        assignedMinutes += Math.round((assignment.workMinutes ?? task.workMinutes) / taskDays);
        taskIds.push(task.id);
      }

      const capacityMinutes = defaultCalendar.workingWeekdays.includes(new Date(`${date}T00:00:00.000Z`).getUTCDay())
        ? defaultCalendar.workingMinutesPerDay
        : 0;

      buckets.push({
        resourceId: resource.id,
        date,
        granularity: "day",
        assignedMinutes,
        capacityMinutes,
        taskIds
      });
    }
  }

  return {
    buckets,
    overloads: buckets
      .filter((bucket) => bucket.assignedMinutes > bucket.capacityMinutes)
      .map((bucket) => ({
        ...bucket,
        overloadMinutes: bucket.assignedMinutes - bucket.capacityMinutes
      }))
  };
}

function enumerateDates(start: PlanDate, finish: PlanDate): PlanDate[] {
  const days = diffCalendarDays(start, finish);
  return Array.from({ length: days + 1 }, (_, offset) => addDays(start, offset));
}
```

The illustrative skeleton above is incomplete until it satisfies all implementation requirements in this step. Do not commit a day-only matrix.

- [ ] **Step 4: Add read-model resource summary**

Modify `apps/api/src/planningRoutes.ts` so read model response includes:

```ts
resourceLoad: {
  buckets,
  overloads
}
```

Use `buildResourceLoadMatrix` after `calculatePlan`.

- [ ] **Step 5: Extend API DB read-model test**

Update `apps/api/src/planningRoutes.db.test.ts` to assert:

```ts
expect(body.resourceLoad.overloads).toEqual(expect.any(Array));
expect(body.resourceLoad.buckets[0]).toMatchObject({
  granularity: "day"
});
```

- [ ] **Step 6: Run Slice E verification**

Run:

```bash
pnpm vitest run packages/domain/src/planning/resourcePlanning.test.ts
pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 7: Commit Slice E**

Run:

```bash
git add packages/domain/src/planning apps/api/src/planningRoutes.ts apps/api/src/planningRoutes.db.test.ts
git commit -m "feat: calculate resource load matrix"
```

---

### Task 7: Slice F Scenario Proposals and Governed Apply

**Files:**
- Create: `packages/domain/src/planning/scenarioPlanning.ts`
- Create: `packages/domain/src/planning/scenarioPlanning.test.ts`
- Modify: `apps/api/src/planningParsers.ts`
- Modify: `apps/api/src/planningParsers.test.ts`
- Modify: `apps/api/src/planningRoutes.ts`
- Modify: `apps/api/src/planningRoutes.db.test.ts`

- [ ] **Step 1: Add scenario planning tests**

Create `packages/domain/src/planning/scenarioPlanning.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { proposePlanningScenarios } from "./scenarioPlanning";
import { buildResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import type { PlanSnapshot } from "./types";

describe("scenario planning", () => {
  it("returns aggressive, balanced and resilient proposals with explainable deltas", () => {
    const snapshot = createOverloadedScenarioSnapshot();
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01"
    });
    const proposals = proposePlanningScenarios({
      snapshot,
      calculatedPlan,
      resourceLoad,
      target: {
        type: "resource_overload",
        resourceId: "resource-egor",
        date: "2026-06-01",
        overloadMinutes: 480,
        taskIds: ["task-a"]
      }
    });

    expect(proposals.map((proposal) => proposal.profile)).toEqual(["aggressive", "balanced", "resilient"]);
    expect(proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: "aggressive",
          conflictEffect: "accepted"
        }),
        expect.objectContaining({
          profile: "balanced",
          conflictEffect: "reduced"
        }),
        expect.objectContaining({
          profile: "resilient",
          conflictEffect: "removed"
        })
      ])
    );
    expect(proposals[0]).toMatchObject({
      planDelta: expect.objectContaining({ commands: expect.any(Array) }),
      explainability: expect.objectContaining({ riskScore: expect.any(Number) })
    });

    for (const proposal of proposals) {
      const applied = applyPlanDeltaToSnapshot(snapshot, proposal.planDelta);
      const recalculated = calculatePlan(applied, {
        calculatedAt: "2026-05-21T00:00:00.000Z",
        engineVersion: "planning-core-v1"
      });
      const recalculatedLoad = buildResourceLoadMatrix({
        plan: recalculated,
        resources: applied.resources,
        assignments: applied.assignments,
        calendars: applied.calendars,
        calendarExceptions: applied.calendarExceptions,
        reservations: applied.reservations,
        rangeStart: "2026-06-01",
        rangeFinish: "2026-06-01"
      });
      const remaining = findTargetOverload(recalculatedLoad, "resource-egor", "2026-06-01");

      if (proposal.conflictEffect === "accepted") {
        expect(proposal.planDelta.commands).toEqual(
          expect.arrayContaining([expect.objectContaining({ type: "risk.accept_overload" })])
        );
      }
      if (proposal.conflictEffect === "reduced") {
        expect(remaining?.overloadMinutes ?? 0).toBeLessThan(480);
      }
      if (proposal.conflictEffect === "removed") {
        expect(remaining).toBeUndefined();
      }
    }
  });
});

function createOverloadedScenarioSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 1,
    project: {
      id: "project-alpha",
      sourceType: "opportunity",
      sourceOpportunityId: "opportunity-alpha",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-30",
      calendarId: "calendar-default"
    },
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "A",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 960,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-egor",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 960,
        calendarId: null
      }
    ],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [{ id: "resource-egor", userId: "user-egor", positionId: "engineer", teamId: null, name: "Егор", calendarId: "calendar-default" }],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}
```

Define `applyPlanDeltaToSnapshot` in this test through the same `reducePlanningCommand` pipeline used by apply routes, and define `findTargetOverload` as a narrow lookup in `ResourceLoadMatrix.overloads`.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm vitest run packages/domain/src/planning/scenarioPlanning.test.ts
```

Expected: fail because implementation file does not exist.

- [ ] **Step 3: Implement scenario planning**

Create `packages/domain/src/planning/scenarioPlanning.ts`.

Implementation requirements:

- Input must include `PlanSnapshot`, `CalculatedPlan`, `ResourceLoadMatrix` and target conflict.
- Every proposal must contain a `conflictEffect`: `accepted`, `reduced` or `removed`.
- `aggressive` may accept overload only with explicit `risk.accept_overload` command and required approval.
- `balanced` must reduce overload minutes or return no balanced proposal.
- `resilient` must remove overload or return no resilient proposal.
- Proposal `PlanDelta` commands must be valid `PlanningCommand` values accepted by the strict parser.
- Scenario apply must use the same `reducePlanningCommand` path as direct apply.
- Unit tests must apply each proposal delta, recalculate `CalculatedPlan` and rebuild `ResourceLoadMatrix`; labels alone are not sufficient proof of `accepted`, `reduced` or `removed`.
- `balanced` must not use `resource.reserve` on the already overloaded resource/date as its only operation, because that increases committed load. It may reassign work, change units, split work, move non-critical work, or reserve capacity on a different available resource.
- `resilient` must move or reshape work so the target overload bucket disappears after recalculation.

```ts
import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import type { CalculatedPlan, PlanSnapshot, ScenarioProfile } from "./types";
import type { ResourceLoadMatrix } from "./resourcePlanning";

export type ScenarioTarget = {
  type: "resource_overload";
  resourceId: string;
  date: string;
  overloadMinutes: number;
  taskIds: string[];
};

export type ScenarioProposal = {
  id: string;
  profile: ScenarioProfile;
  conflictEffect: "accepted" | "reduced" | "removed";
  planDelta: PlanDelta;
  explainability: {
    finishDate: string | null;
    deadlineDeltaDays: number;
    overloadMinutes: number;
    overloadedResourceIds: string[];
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    dependencyWarnings: string[];
    requiredApprovals: string[];
    riskScore: number;
  };
};

export function proposePlanningScenarios(input: {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad: ResourceLoadMatrix;
  target: ScenarioTarget;
}): ScenarioProposal[] {
  const overload = input.resourceLoad.overloads.find(
    (candidate) =>
      candidate.resourceId === input.target.resourceId &&
      candidate.date === input.target.date
  );
  if (!overload) return [];

  return [
    createProposal("aggressive", "accepted", input.target, [
      {
        type: "risk.accept_overload",
        payload: {
          overloadId: `${input.target.resourceId}:${input.target.date}`,
          acceptedRiskReason: "Aggressive scenario keeps deadline and accepts visible overload"
        }
      }
    ]),
    createReducedProposal(input),
    createRemovedProposal(input)
  ].filter(isScenarioProposal);
}

function isScenarioProposal(value: ScenarioProposal | null): value is ScenarioProposal {
  return value !== null;
}

function createProposal(
  profile: ScenarioProfile,
  conflictEffect: ScenarioProposal["conflictEffect"],
  target: ScenarioTarget,
  commands: PlanningCommand[]
): ScenarioProposal {
  const planDelta = {
    ...createEmptyPlanDelta(),
    commands,
    changedTaskIds: commands.flatMap((command) =>
      "taskId" in command.payload ? [String(command.payload.taskId)] : []
    )
  };

  return {
    id: `scenario-${profile}-${target.resourceId}-${target.date}`,
    profile,
    conflictEffect,
    planDelta,
    explainability: {
      finishDate: null,
      deadlineDeltaDays: profile === "resilient" ? 1 : 0,
      overloadMinutes: profile === "aggressive" ? target.overloadMinutes : 0,
      overloadedResourceIds: profile === "aggressive" ? [target.resourceId] : [],
      changedTaskIds: planDelta.changedTaskIds,
      changedAssignmentIds: [],
      dependencyWarnings: [],
      requiredApprovals: profile === "aggressive" ? ["tenant.planning_scenarios.apply"] : [],
      riskScore: profile === "aggressive" ? 80 : profile === "balanced" ? 40 : 20
    }
  };
}
```

`createReducedProposal` and `createRemovedProposal` must construct candidate deltas, run them through `reducePlanningCommand`, recalculate the plan and compare the target overload before returning a proposal. If no candidate satisfies the promised effect, omit that profile instead of returning a mislabeled proposal.

- [ ] **Step 4: Add scenario API parser tests**

Extend `apps/api/src/planningParsers.test.ts`:

```ts
expect(
  parseScenarioProposalBody({
    target: {
      type: "resource_overload",
      resourceId: "resource-egor",
      date: "2026-06-01",
      overloadMinutes: 480,
      taskIds: ["task-a"]
    }
  })
).toMatchObject({ ok: true });
```

- [ ] **Step 5: Add scenario routes**

Modify `apps/api/src/planningRoutes.ts`:

- `POST /api/workspace/projects/:projectId/planning/scenario-proposals`
- `POST /api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply`

Use:

- `canPreviewPlanningScenarios` for proposal generation;
- `canApplyPlanningScenarios` for apply;
- persist `planning_scenario_runs` with proposal payload, payload hash, source `planVersion`, `engineVersion`, target conflict, expiry and actor id, or require a signed proposal payload carrying the same fields;
- reject missing/unknown proposal id with `404 { error: "scenario_not_found" }`;
- reject expired proposal with `409 { error: "scenario_expired" }`;
- reject proposal apply when current plan version differs from proposal source version with `409 { error: "plan_version_conflict" }`;
- reject proposal apply when payload hash/signature does not match the stored/signed proposal with `400 { error: "planning_command_invalid" }`;
- `accepted_risk_reason_required` when applied proposal includes `risk.accept_overload` or leaves overload accepted;
- same plan version conflict handling as `apply-command`;
- `planning.scenario.previewed` and `planning.scenario.applied` audit events.

- [ ] **Step 6: Add scenario API DB tests**

Extend `apps/api/src/planningRoutes.db.test.ts`:

- scenario proposal endpoint returns profiles `aggressive`, `balanced`, `resilient`;
- each returned profile is proven by recalculating the proposal delta: aggressive accepted by risk command, balanced lower overload, resilient no target overload;
- restricted actor gets 403 for apply;
- unknown proposal id returns `scenario_not_found`;
- expired proposal returns `scenario_expired`;
- stale proposal source version returns `plan_version_conflict`;
- tampered signed/stored proposal payload returns `planning_command_invalid`;
- apply increments plan version;
- apply writes `planning.scenario.applied`.

- [ ] **Step 7: Run Slice F verification**

Run:

```bash
pnpm vitest run packages/domain/src/planning/scenarioPlanning.test.ts apps/api/src/planningParsers.test.ts
pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts
pnpm typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 8: Commit Slice F**

Run:

```bash
git add packages/domain/src/planning apps/api/src
git commit -m "feat: add planning scenario proposals"
```

---

### Task 8: End-to-End Backend Hardening and Compatibility Review

**Files:**
- Modify: `packages/persistence/src/seed.ts`
- Modify: `apps/api/src/inMemoryTenantDataSource.ts`
- Modify: `apps/api/src/app.db.test.ts`
- Modify: `docs/status/phase5-6-ms-project-backend-ledger.md`

- [ ] **Step 1: Add dev seed planning data**

Update `packages/persistence/src/seed.ts` so demo tenant has:

- active project with plan version;
- at least three tasks;
- FS and SS dependencies;
- one baseline;
- one resource overload;
- one calendar exception.

- [ ] **Step 2: Add smoke-style API DB coverage**

Extend `apps/api/src/app.db.test.ts` or create a focused smoke test that performs:

1. login;
2. read planning model;
3. preview dependency change;
4. apply dependency change;
5. request scenario proposals;
6. apply one proposal;
7. assert audit contains planning events.

- [ ] **Step 3: Add status ledger**

Create `docs/status/phase5-6-ms-project-backend-ledger.md`:

```md
# Phase 5/6 MS Project-class backend ledger

## Scope

- Planning command contract.
- Deterministic scheduling engine.
- Planning persistence and snapshot adapter.
- Planning API read/preview/apply.
- Resource load matrix backend.
- Scenario proposals and governed apply.

## Non-scope

- MSPDI/XML import/export.
- Gantt/resource matrix UI.
- KPI/control surfaces.
- Frontend feature work.
- Autonomous auto-apply.

## Verification

Заполнить только после свежего выполнения команд в Step 4. Каждая строка должна содержать команду, exit code, количество прошедших/упавших тестов из вывода и короткую заметку о покрытом acceptance.
```

Update the ledger after fresh verification.

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm test:db
```

Expected: all commands exit 0.

- [ ] **Step 5: Run targeted search checks**

Run:

```bash
rg -n "plannedStart|plannedFinish|workMinutes|durationMinutes|unitsPermille|dependency" apps packages
rg -n "planning\\.task|planning\\.scenario|planning\\.command" apps packages docs
```

Expected:

- planning field mutations are routed through planning command/application code;
- no route handler directly recalculates planning/resource values outside domain planning modules;
- audit action names are documented and used consistently.

- [ ] **Step 6: Update ledger with verification evidence**

Edit `docs/status/phase5-6-ms-project-backend-ledger.md` and add the actual command results from Step 4.

- [ ] **Step 7: Commit hardening**

Run:

```bash
git add packages apps docs/status/phase5-6-ms-project-backend-ledger.md
git commit -m "test: harden planning backend flow"
```

---

## Self-Review Checklist

- [ ] Contract coverage: slices A-F from `docs/30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md` map to Tasks 1-7.
- [ ] API stability: read model, preview, apply and scenario endpoints are planned without frontend coupling.
- [ ] Task CRUD decision: wrapper integration is explicit and does not create a second task model.
- [ ] Persistence safety: tenant/project scoped tables and plan version conflict behavior are included.
- [ ] Verification: each slice has targeted tests plus final `pnpm typecheck`, `pnpm test`, `pnpm test:db`.
- [ ] Non-goals: MSPDI/XML import/export, frontend UI, KPI/control surfaces and browser E2E for those surfaces are excluded.

## Execution Recommendation

Use subagent-driven execution with disjoint ownership:

- Worker 1: Tasks 1-3, `packages/domain/src/planning/*`.
- Worker 2: Task 4, `packages/persistence/*` and migration.
- Worker 3: Task 5, `apps/api/src/planning*` and route registration.
- Worker 4: Tasks 6-7, resource/scenario modules plus API extension.
- Main agent: integration review, task CRUD wrapper decision, final verification and ledger.

Do not run Workers 2-4 before Worker 1 exports the canonical types. Do not run task CRUD wrapper changes before the Phase 4 task backend is present in the implementation worktree.
