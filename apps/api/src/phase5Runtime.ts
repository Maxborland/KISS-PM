import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionEntityRef, ActionExecutionLog } from "@kiss-pm/action-engine";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import type { ManagedProject, Task } from "@kiss-pm/project-core";
import {
  captureScheduleBaselineSnapshot,
  createScheduleDateRange,
  createSchedulePlan,
  createWbsProjectionFromProject,
  validateSchedulePlan
} from "@kiss-pm/scheduling-engine";
import type {
  DependencyType,
  ScheduleBaselineSnapshot,
  ScheduleDependency,
  SchedulePlan,
  ScheduleValidationIssue
} from "@kiss-pm/scheduling-engine";

const PHASE5_TIMESTAMP_START = Date.parse("2026-05-15T15:00:00+07:00");

export type Phase5ScheduleFields = {
  plannedStartDate: string;
  plannedFinishDate: string;
  plannedWorkHours: number;
  progressPercent: number;
};

export type Phase5ScheduleSnapshot = {
  schedulePlan: SchedulePlan;
  validationIssues: ScheduleValidationIssue[];
  baseline?: ScheduleBaselineSnapshot;
};

type ProjectScheduleState = {
  version: number;
  taskSchedules: Map<string, Phase5ScheduleFields>;
  dependencies: ScheduleDependency[];
  baseline?: ScheduleBaselineSnapshot;
  actionExecutions: ActionExecutionLog[];
};

function cloneScheduleFields(fields: Phase5ScheduleFields): Phase5ScheduleFields {
  return { ...fields };
}

function projectStorageKey(tenantId: TenantId, projectId: string): string {
  return `${tenantId}:${projectId}`;
}

function schedulePlanId(projectId: string): string {
  return `schedule-plan-${projectId}`;
}

function validateScheduleFields(fields: Phase5ScheduleFields): Phase5ScheduleFields {
  const range = createScheduleDateRange({
    plannedStartDate: fields.plannedStartDate,
    plannedFinishDate: fields.plannedFinishDate
  });
  if (range.plannedStartDate === undefined || range.plannedFinishDate === undefined) {
    throw Object.assign(new Error("schedule planned start and finish are required"), { code: "validation_error" });
  }
  if (typeof fields.plannedWorkHours !== "number" || !Number.isFinite(fields.plannedWorkHours) || fields.plannedWorkHours < 0) {
    throw Object.assign(new Error("schedule planned work hours are invalid"), { code: "validation_error" });
  }
  if (typeof fields.progressPercent !== "number" || !Number.isFinite(fields.progressPercent) || fields.progressPercent < 0 || fields.progressPercent > 100) {
    throw Object.assign(new Error("schedule progress percent is invalid"), { code: "validation_error" });
  }

  return {
    plannedStartDate: range.plannedStartDate,
    plannedFinishDate: range.plannedFinishDate,
    plannedWorkHours: fields.plannedWorkHours,
    progressPercent: fields.progressPercent
  };
}

function createPreconditionError(message: string, validationIssues: ScheduleValidationIssue[]): Error & {
  code: "precondition_failed";
  validationIssues: ScheduleValidationIssue[];
} {
  return Object.assign(new Error(message), { code: "precondition_failed" as const, validationIssues });
}

export function createPhase5RuntimeState() {
  const scheduleStates = new Map<string, ProjectScheduleState>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE5_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getOrCreateProjectState(project: ManagedProject): ProjectScheduleState {
    const key = projectStorageKey(project.tenantId, project.id);
    const existing = scheduleStates.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const nextState: ProjectScheduleState = {
      version: 1,
      taskSchedules: new Map(),
      dependencies: [],
      actionExecutions: []
    };
    scheduleStates.set(key, nextState);

    return nextState;
  }

  function requireTask(project: ManagedProject, taskId: string): Task {
    const task = project.tasks.find((candidate) => candidate.id === taskId);
    if (task === undefined) {
      throw Object.assign(new Error("task not found"), { code: "not_found" });
    }

    return task;
  }

  function buildPlan(project: ManagedProject, state: ProjectScheduleState): SchedulePlan {
    const projection = createWbsProjectionFromProject({
      id: schedulePlanId(project.id),
      project: {
        id: project.id,
        tenantId: project.tenantId,
        stages: project.stages.map((stage) => ({
          id: stage.id,
          tenantId: stage.tenantId,
          projectId: stage.projectId,
          sortOrder: stage.sortOrder
        })),
        tasks: project.tasks.map((task) => {
          const scheduleFields = state.taskSchedules.get(task.id);

          return {
            id: task.id,
            tenantId: task.tenantId,
            projectId: task.projectId,
            stageId: task.stageId,
            title: task.title,
            ...(scheduleFields?.plannedStartDate !== undefined
              ? { plannedStartDate: scheduleFields.plannedStartDate }
              : {}),
            dueDate: scheduleFields?.plannedFinishDate ?? task.dueDate,
            plannedWorkHours: scheduleFields?.plannedWorkHours ?? task.plannedWorkHours,
            ...(scheduleFields?.progressPercent !== undefined ? { progressPercent: scheduleFields.progressPercent } : {})
          };
        })
      },
      version: state.version,
      status: "active",
      ...(state.baseline !== undefined ? { baselineId: state.baseline.id } : {})
    });

    return createSchedulePlan({
      id: projection.id,
      tenantId: projection.tenantId,
      projectId: projection.projectId,
      version: projection.version,
      ...(projection.baselineId !== undefined ? { baselineId: projection.baselineId } : {}),
      status: projection.status,
      wbsNodes: projection.wbsNodes,
      dependencies: state.dependencies
    });
  }

  function getSchedule(project: ManagedProject): Phase5ScheduleSnapshot {
    const state = getOrCreateProjectState(project);
    const schedulePlan = buildPlan(project, state);

    return {
      schedulePlan,
      validationIssues: validateSchedulePlan(schedulePlan),
      ...(state.baseline !== undefined ? { baseline: state.baseline } : {})
    };
  }

  function readTaskScheduleFields(project: ManagedProject, taskId: string): Phase5ScheduleFields | undefined {
    requireTask(project, taskId);
    const state = getOrCreateProjectState(project);
    const fields = state.taskSchedules.get(taskId);

    return fields === undefined ? undefined : cloneScheduleFields(fields);
  }

  function prepareTaskScheduleFields(project: ManagedProject, taskId: string, input: Phase5ScheduleFields): Phase5ScheduleFields {
    if (project.tasks.some((task) => task.id === taskId)) {
      throw Object.assign(new Error("task already exists"), { code: "conflict" });
    }

    return validateScheduleFields(input);
  }

  function prepareTaskSchedulePatch(
    project: ManagedProject,
    taskId: string,
    input: Partial<Phase5ScheduleFields>
  ): Phase5ScheduleFields {
    const task = requireTask(project, taskId);
    const state = getOrCreateProjectState(project);
    const existing = state.taskSchedules.get(taskId);
    const nextFields = {
      plannedStartDate: input.plannedStartDate ?? existing?.plannedStartDate,
      plannedFinishDate: input.plannedFinishDate ?? existing?.plannedFinishDate ?? task.dueDate,
      plannedWorkHours: input.plannedWorkHours ?? existing?.plannedWorkHours ?? task.plannedWorkHours,
      progressPercent: input.progressPercent ?? existing?.progressPercent
    };
    if (nextFields.plannedStartDate === undefined || nextFields.progressPercent === undefined) {
      throw Object.assign(new Error("schedule planned start and progress are required"), { code: "validation_error" });
    }

    return validateScheduleFields(nextFields as Phase5ScheduleFields);
  }

  function setTaskScheduleFields(project: ManagedProject, taskId: string, fields: Phase5ScheduleFields): Phase5ScheduleSnapshot {
    requireTask(project, taskId);
    const state = getOrCreateProjectState(project);
    state.taskSchedules.set(taskId, validateScheduleFields(fields));
    state.version += 1;

    return getSchedule(project);
  }

  function createDependency(project: ManagedProject, input: {
    id: string;
    predecessorTaskId: string;
    successorTaskId: string;
    type: DependencyType;
  }): { dependency: ScheduleDependency; snapshot: Phase5ScheduleSnapshot } {
    const state = getOrCreateProjectState(project);
    const dependency: ScheduleDependency = {
      id: input.id,
      tenantId: project.tenantId,
      projectId: project.id,
      predecessorTaskId: input.predecessorTaskId,
      successorTaskId: input.successorTaskId,
      type: input.type
    };
    if (state.dependencies.some((existingDependency) => existingDependency.id === dependency.id)) {
      throw Object.assign(new Error("schedule dependency id must be unique"), { code: "conflict" });
    }
    const proposedPlan = createSchedulePlan({
      ...buildPlan(project, state),
      version: state.version + 1,
      dependencies: [...state.dependencies, dependency]
    });
    const validationIssues = validateSchedulePlan(proposedPlan);
    if (validationIssues.some((issue) => issue.severity === "blocking")) {
      throw createPreconditionError("schedule dependency violates current schedule", validationIssues);
    }

    state.dependencies = [...state.dependencies, dependency];
    state.version += 1;

    return { dependency: { ...dependency }, snapshot: getSchedule(project) };
  }

  function captureBaseline(project: ManagedProject, input: { id: string; actorId: TenantUserId }): Phase5ScheduleSnapshot {
    const state = getOrCreateProjectState(project);
    const schedulePlan = buildPlan(project, state);
    const baseline = captureScheduleBaselineSnapshot({
      id: input.id,
      tenantId: project.tenantId,
      projectId: project.id,
      schedulePlanId: schedulePlan.id,
      schedulePlan,
      createdBy: input.actorId,
      createdAt: now()
    });
    state.baseline = baseline;
    state.version += 1;

    return getSchedule(project);
  }

  function recordActionExecution(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    projectId: string;
    commandType: string;
    requiredPermission: string;
    source: ActionEntityRef;
    target?: ActionEntityRef;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    trace: string[];
  }): ActionExecutionLog {
    const state = getOrCreateProjectState({ id: input.projectId, tenantId: input.tenantId } as ManagedProject);
    const timestamp = now();
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `schedule-${input.projectId}-${state.actionExecutions.length + 1}`
      },
      commandType: input.commandType,
      requiredPermission: input.requiredPermission,
      status: "succeeded",
      source: input.source,
      ...(input.target !== undefined ? { target: input.target } : {}),
      before: input.before,
      after: input.after,
      timestamp,
      trace: input.trace
    });
    state.actionExecutions = [...state.actionExecutions, actionExecution];

    return structuredClone(actionExecution) as ActionExecutionLog;
  }

  function listActionExecutions(tenantId: TenantId, projectId: string): ActionExecutionLog[] {
    const state = scheduleStates.get(projectStorageKey(tenantId, projectId));

    return state === undefined ? [] : state.actionExecutions.map((entry) => structuredClone(entry) as ActionExecutionLog);
  }

  return {
    now,
    getSchedule,
    readTaskScheduleFields,
    prepareTaskScheduleFields,
    prepareTaskSchedulePatch,
    setTaskScheduleFields,
    createDependency,
    captureBaseline,
    recordActionExecution,
    listActionExecutions
  };
}
