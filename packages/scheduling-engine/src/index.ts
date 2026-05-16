export const packageName = "@kiss-pm/scheduling-engine";

export type TenantId = string;
export type ProjectId = string;
export type SchedulePlanId = string;
export type WbsNodeId = string;
export type TaskId = string;
export type ProjectStageId = string;
export type ScheduleDependencyId = string;
export type ScheduleBaselineSnapshotId = string;

export type DependencyType = "finish_to_start";
export type SchedulePlanStatus = "draft" | "active" | "archived";
export type ScheduleValidationIssueSeverity = "warning" | "blocking";
export type ScheduleValidationIssueCode =
  | "finish_to_start_conflict"
  | "invalid_date_range"
  | "invalid_planned_work_hours"
  | "invalid_progress_percent"
  | "missing_planned_finish_date"
  | "missing_planned_start_date"
  | "missing_planned_work_hours"
  | "missing_progress_percent";

export type ScheduleDateRange = {
  plannedStartDate?: string;
  plannedFinishDate?: string;
  durationDays?: number;
};

export type WbsNode = {
  id: WbsNodeId;
  tenantId: TenantId;
  projectId: ProjectId;
  parentId?: WbsNodeId;
  taskId?: TaskId;
  stageId?: ProjectStageId;
  sortOrder: number;
  schedule?: ScheduleDateRange;
  plannedWorkHours?: number;
  progressPercent?: number;
};

export type ScheduleDependency = {
  id: ScheduleDependencyId;
  tenantId: TenantId;
  projectId: ProjectId;
  predecessorTaskId: TaskId;
  successorTaskId: TaskId;
  type: DependencyType;
};

export type SchedulePlan = {
  id: SchedulePlanId;
  tenantId: TenantId;
  projectId: ProjectId;
  version: number;
  baselineId?: ScheduleBaselineSnapshotId;
  status: SchedulePlanStatus;
  wbsNodes: WbsNode[];
  dependencies: ScheduleDependency[];
};

export type CanonicalProjectStageForWbsProjection = {
  id: ProjectStageId;
  tenantId: TenantId;
  projectId: ProjectId;
  sortOrder: number;
};

export type CanonicalProjectTaskForWbsProjection = {
  id: TaskId;
  tenantId: TenantId;
  projectId: ProjectId;
  stageId: ProjectStageId;
  title: string;
  plannedStartDate?: string;
  dueDate?: string;
  plannedWorkHours?: number;
  progressPercent?: number;
};

export type CanonicalProjectForWbsProjection = {
  id: ProjectId;
  tenantId: TenantId;
  stages: CanonicalProjectStageForWbsProjection[];
  tasks: CanonicalProjectTaskForWbsProjection[];
};

export type WbsProjectionSource = {
  type: "canonical_project";
  projectId: ProjectId;
};

export type WbsProjection = SchedulePlan & {
  source: WbsProjectionSource;
};

export type ScheduleValidationIssue = {
  code: ScheduleValidationIssueCode;
  severity: ScheduleValidationIssueSeverity;
  message: string;
  nodeId?: WbsNodeId;
  dependencyId?: ScheduleDependencyId;
  fieldRefs: string[];
};

export type ScheduleTaskBaselineValue = {
  taskId: TaskId;
  plannedStartDate?: string;
  plannedFinishDate?: string;
  durationDays?: number;
  progressPercent?: number;
};

export type ScheduleBaselineSnapshot = {
  readonly id: ScheduleBaselineSnapshotId;
  readonly tenantId: TenantId;
  readonly projectId: ProjectId;
  readonly schedulePlanId: SchedulePlanId;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly taskBaselineValues: ScheduleTaskBaselineValue[];
};

export type ScheduleBaselineCaptureInput = {
  id: ScheduleBaselineSnapshotId;
  tenantId: TenantId;
  projectId: ProjectId;
  schedulePlanId: SchedulePlanId;
  schedulePlan: SchedulePlan;
  createdBy: string;
  createdAt: string;
};

export class SchedulingEngineModelError extends Error {
  constructor(
    readonly code: "validation_error" | "tenant_mismatch" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "SchedulingEngineModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireNonNegativeNumber(value: number | undefined, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be a non-negative number`);
  }

  return value;
}

function requireProgressPercent(value: number | undefined, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be between 0 and 100`);
  }

  return value;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function requireArray<T>(value: T[] | undefined, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function requireIsoDate(value: string | undefined, fieldName: string): string {
  const date = requireNonEmptyString(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be an ISO date`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be a valid ISO date`);
  }

  return date;
}

function requireTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new SchedulingEngineModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function validateOptionalIsoDate(value: string | undefined, fieldName: string): string | undefined {
  return value === undefined ? undefined : requireIsoDate(value, fieldName);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function durationDaysInclusive(startDate: string, finishDate: string): number {
  const startTime = Date.parse(`${startDate}T00:00:00.000Z`);
  const finishTime = Date.parse(`${finishDate}T00:00:00.000Z`);
  return Math.floor((finishTime - startTime) / 86_400_000) + 1;
}

function createScheduleDateRangeFromInput(
  input: ScheduleDateRange | undefined,
  fieldName = "schedule"
): ScheduleDateRange | undefined {
  if (input === undefined) return undefined;
  const range = requireObject(input, fieldName);
  return createScheduleDateRange({
    plannedStartDate: validateOptionalIsoDate(range.plannedStartDate, `${fieldName}.plannedStartDate`),
    plannedFinishDate: validateOptionalIsoDate(range.plannedFinishDate, `${fieldName}.plannedFinishDate`)
  });
}

function validateDependencyType(value: DependencyType | undefined): DependencyType {
  if (value !== "finish_to_start") {
    throw new SchedulingEngineModelError("validation_error", "schedule dependency type is invalid");
  }

  return value;
}

function assertSameScope(
  expectedTenantId: TenantId,
  expectedProjectId: ProjectId,
  actualTenantId: TenantId,
  actualProjectId: ProjectId,
  entityName: string
): void {
  if (actualTenantId !== expectedTenantId) {
    throw new SchedulingEngineModelError("tenant_mismatch", `${entityName} tenant mismatch`);
  }
  if (actualProjectId !== expectedProjectId) {
    throw new SchedulingEngineModelError("tenant_mismatch", `${entityName} project mismatch`);
  }
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareDefinedStrings(left: string | undefined, right: string | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return compareStrings(left, right);
}

function nextProjectedSortOrder(index: number): number {
  return (index + 1) * 10;
}

function copyScheduleTaskBaselineValue(value: ScheduleTaskBaselineValue): ScheduleTaskBaselineValue {
  return {
    taskId: value.taskId,
    ...(value.plannedStartDate !== undefined ? { plannedStartDate: value.plannedStartDate } : {}),
    ...(value.plannedFinishDate !== undefined ? { plannedFinishDate: value.plannedFinishDate } : {}),
    ...(value.durationDays !== undefined ? { durationDays: value.durationDays } : {}),
    ...(value.progressPercent !== undefined ? { progressPercent: value.progressPercent } : {})
  };
}

function captureTaskBaselineValue(node: WbsNode & { taskId: TaskId }): ScheduleTaskBaselineValue {
  const plannedStartDate = node.schedule?.plannedStartDate;
  const plannedFinishDate = node.schedule?.plannedFinishDate;
  const durationDays = node.schedule?.durationDays;
  const progressPercent = node.progressPercent;

  if (
    plannedStartDate === undefined ||
    plannedFinishDate === undefined ||
    durationDays === undefined ||
    progressPercent === undefined
  ) {
    throw new SchedulingEngineModelError(
      "validation_error",
      "baseline capture task WBS node must have planned start, finish, duration, and progress"
    );
  }

  return {
    taskId: node.taskId,
    plannedStartDate,
    plannedFinishDate,
    durationDays,
    progressPercent
  };
}

export function createScheduleDateRange(input: {
  plannedStartDate?: string;
  plannedFinishDate?: string;
}): ScheduleDateRange {
  const plannedStartDate = validateOptionalIsoDate(input.plannedStartDate, "schedule.plannedStartDate");
  const plannedFinishDate = validateOptionalIsoDate(input.plannedFinishDate, "schedule.plannedFinishDate");

  if (plannedStartDate !== undefined && plannedFinishDate !== undefined && plannedFinishDate < plannedStartDate) {
    throw new SchedulingEngineModelError(
      "validation_error",
      "schedule.plannedFinishDate must be on or after plannedStartDate"
    );
  }

  return {
    ...(plannedStartDate !== undefined ? { plannedStartDate } : {}),
    ...(plannedFinishDate !== undefined ? { plannedFinishDate } : {}),
    ...(plannedStartDate !== undefined && plannedFinishDate !== undefined
      ? { durationDays: durationDaysInclusive(plannedStartDate, plannedFinishDate) }
      : {})
  };
}

export function createWbsProjectionFromProject(input: {
  id: SchedulePlanId;
  project: CanonicalProjectForWbsProjection;
  version: number;
  status?: SchedulePlanStatus;
  baselineId?: ScheduleBaselineSnapshotId;
}): WbsProjection {
  const project = requireObject(input.project, "project");
  const tenantId = requireNonEmptyString(project.tenantId, "project.tenantId");
  const projectId = requireNonEmptyString(project.id, "project.id");
  const stages = requireArray(project.stages, "project.stages").map((rawStage) => {
    const stage = requireObject(rawStage, "project stage");
    const stageTenantId = requireNonEmptyString(stage.tenantId, "project stage.tenantId");
    const stageProjectId = requireNonEmptyString(stage.projectId, "project stage.projectId");
    if (stageTenantId !== tenantId) {
      throw new SchedulingEngineModelError("tenant_mismatch", "project stage tenant mismatch");
    }
    if (stageProjectId !== projectId) {
      throw new SchedulingEngineModelError("tenant_mismatch", "project stage project mismatch");
    }

    return {
      id: requireNonEmptyString(stage.id, "project stage.id"),
      tenantId: stageTenantId,
      projectId: stageProjectId,
      sortOrder: requirePositiveInteger(stage.sortOrder, "project stage.sortOrder")
    };
  });
  const tasks = requireArray(project.tasks, "project.tasks").map((rawTask) => {
    const task = requireObject(rawTask, "project task");
    const taskTenantId = requireNonEmptyString(task.tenantId, "project task.tenantId");
    const taskProjectId = requireNonEmptyString(task.projectId, "project task.projectId");
    if (taskTenantId !== tenantId) {
      throw new SchedulingEngineModelError("tenant_mismatch", "project task tenant mismatch");
    }
    if (taskProjectId !== projectId) {
      throw new SchedulingEngineModelError("tenant_mismatch", "project task project mismatch");
    }

    return {
        id: requireNonEmptyString(task.id, "project task.id"),
        tenantId: taskTenantId,
        projectId: taskProjectId,
        stageId: requireNonEmptyString(task.stageId, "project task.stageId"),
        title: requireNonEmptyString(task.title, "project task.title"),
        ...(task.plannedStartDate !== undefined
          ? { plannedStartDate: requireIsoDate(task.plannedStartDate, "project task.plannedStartDate") }
          : {}),
        ...(task.dueDate !== undefined ? { dueDate: requireIsoDate(task.dueDate, "project task.dueDate") } : {}),
        ...(task.plannedWorkHours !== undefined
          ? { plannedWorkHours: requireNonNegativeNumber(task.plannedWorkHours, "project task.plannedWorkHours") }
          : {}),
      ...(task.progressPercent !== undefined
        ? { progressPercent: requireProgressPercent(task.progressPercent, "project task.progressPercent") }
        : {})
    };
  });

  const stageIds = stages.map((stage) => stage.id);
  if (new Set(stageIds).size !== stageIds.length) {
    throw new SchedulingEngineModelError("conflict", "canonical project stage ids must be unique");
  }
  const taskIds = tasks.map((task) => task.id);
  if (new Set(taskIds).size !== taskIds.length) {
    throw new SchedulingEngineModelError("conflict", "canonical project task ids must be unique");
  }

  const stageIdSet = new Set(stageIds);
  for (const task of tasks) {
    if (!stageIdSet.has(task.stageId)) {
      throw new SchedulingEngineModelError("validation_error", "project task stageId must reference a project stage");
    }
  }

  const orderedStages = [...stages].sort(
    (left, right) => left.sortOrder - right.sortOrder || compareStrings(left.id, right.id)
  );
  const orderedTasksByStageId = new Map<ProjectStageId, CanonicalProjectTaskForWbsProjection[]>();
  for (const task of tasks) {
    const stageTasks = orderedTasksByStageId.get(task.stageId) ?? [];
    stageTasks.push(task);
    orderedTasksByStageId.set(task.stageId, stageTasks);
  }
  for (const [stageId, stageTasks] of orderedTasksByStageId.entries()) {
    orderedTasksByStageId.set(
      stageId,
      [...stageTasks].sort(
        (left, right) =>
          compareDefinedStrings(left.dueDate, right.dueDate) ||
          compareStrings(left.title, right.title) ||
          compareStrings(left.id, right.id)
      )
    );
  }

  const projectedNodes: WbsNode[] = [];
  for (const stage of orderedStages) {
    const stageNodeId = `wbs-stage-${stage.id}`;
    projectedNodes.push({
      id: stageNodeId,
      tenantId,
      projectId,
      stageId: stage.id,
      sortOrder: nextProjectedSortOrder(projectedNodes.length)
    });
    for (const task of orderedTasksByStageId.get(stage.id) ?? []) {
      projectedNodes.push({
        id: `wbs-task-${task.id}`,
        tenantId,
        projectId,
        parentId: stageNodeId,
        taskId: task.id,
        sortOrder: nextProjectedSortOrder(projectedNodes.length),
        ...(task.plannedStartDate !== undefined || task.dueDate !== undefined
          ? {
              schedule: {
                ...(task.plannedStartDate !== undefined ? { plannedStartDate: task.plannedStartDate } : {}),
                ...(task.dueDate !== undefined ? { plannedFinishDate: task.dueDate } : {})
              }
            }
          : {}),
        ...(task.plannedWorkHours !== undefined ? { plannedWorkHours: task.plannedWorkHours } : {}),
        ...(task.progressPercent !== undefined ? { progressPercent: task.progressPercent } : {})
      });
    }
  }

  const plan = createSchedulePlan({
    id: input.id,
    tenantId,
    projectId,
    version: input.version,
    baselineId: input.baselineId,
    status: input.status,
    wbsNodes: projectedNodes,
    dependencies: []
  });

  return {
    ...plan,
    source: {
      type: "canonical_project",
      projectId
    }
  };
}

function createWbsNode(input: WbsNode, tenantId: TenantId, projectId: ProjectId): WbsNode {
  const node = requireObject(input, "wbsNode");
  const safeTenantId = requireNonEmptyString(node.tenantId, "wbsNode.tenantId");
  const safeProjectId = requireNonEmptyString(node.projectId, "wbsNode.projectId");
  assertSameScope(tenantId, projectId, safeTenantId, safeProjectId, "wbsNode");

  const taskId = node.taskId !== undefined ? requireNonEmptyString(node.taskId, "wbsNode.taskId") : undefined;
  const stageId = node.stageId !== undefined ? requireNonEmptyString(node.stageId, "wbsNode.stageId") : undefined;
  if (taskId === undefined && stageId === undefined) {
    throw new SchedulingEngineModelError(
      "validation_error",
      "wbsNode must reference a canonical task or project stage"
    );
  }
  if (taskId !== undefined && stageId !== undefined) {
    throw new SchedulingEngineModelError("validation_error", "wbsNode cannot reference both task and project stage");
  }

  return {
    id: requireNonEmptyString(node.id, "wbsNode.id"),
    tenantId: safeTenantId,
    projectId: safeProjectId,
    ...(node.parentId !== undefined ? { parentId: requireNonEmptyString(node.parentId, "wbsNode.parentId") } : {}),
    ...(taskId !== undefined ? { taskId } : {}),
    ...(stageId !== undefined ? { stageId } : {}),
    sortOrder: requirePositiveInteger(node.sortOrder, "wbsNode.sortOrder"),
    ...(node.schedule !== undefined ? { schedule: createScheduleDateRangeFromInput(node.schedule, "wbsNode.schedule") } : {}),
    ...(node.plannedWorkHours !== undefined
      ? { plannedWorkHours: requireNonNegativeNumber(node.plannedWorkHours, "wbsNode.plannedWorkHours") }
      : {}),
    ...(node.progressPercent !== undefined
      ? { progressPercent: requireProgressPercent(node.progressPercent, "wbsNode.progressPercent") }
      : {})
  };
}

function createDependency(input: ScheduleDependency, tenantId: TenantId, projectId: ProjectId): ScheduleDependency {
  const dependency = requireObject(input, "schedule dependency");
  const safeTenantId = requireNonEmptyString(dependency.tenantId, "schedule dependency.tenantId");
  const safeProjectId = requireNonEmptyString(dependency.projectId, "schedule dependency.projectId");
  assertSameScope(tenantId, projectId, safeTenantId, safeProjectId, "schedule dependency");

  const predecessorTaskId = requireNonEmptyString(
    dependency.predecessorTaskId,
    "schedule dependency.predecessorTaskId"
  );
  const successorTaskId = requireNonEmptyString(dependency.successorTaskId, "schedule dependency.successorTaskId");
  if (predecessorTaskId === successorTaskId) {
    throw new SchedulingEngineModelError("validation_error", "schedule dependency cannot link a task to itself");
  }

  return {
    id: requireNonEmptyString(dependency.id, "schedule dependency.id"),
    tenantId: safeTenantId,
    projectId: safeProjectId,
    predecessorTaskId,
    successorTaskId,
    type: validateDependencyType(dependency.type)
  };
}

function assertNoDependencyCycles(dependencies: ScheduleDependency[]): void {
  const successorsByPredecessor = new Map<TaskId, TaskId[]>();
  for (const dependency of dependencies) {
    const successors = successorsByPredecessor.get(dependency.predecessorTaskId) ?? [];
    successors.push(dependency.successorTaskId);
    successorsByPredecessor.set(dependency.predecessorTaskId, successors);
  }
  for (const successors of successorsByPredecessor.values()) {
    successors.sort(compareStrings);
  }

  const visiting = new Set<TaskId>();
  const visited = new Set<TaskId>();

  const visit = (taskId: TaskId): void => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      throw new SchedulingEngineModelError("conflict", "schedule dependencies must not create cycles");
    }

    visiting.add(taskId);
    for (const successorTaskId of successorsByPredecessor.get(taskId) ?? []) {
      visit(successorTaskId);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (const taskId of [...successorsByPredecessor.keys()].sort(compareStrings)) {
    visit(taskId);
  }
}

function assertUniqueTaskBackedWbsNodeTaskIds(wbsNodes: Array<Pick<WbsNode, "taskId">>): void {
  const taskNodeTaskIds = wbsNodes
    .map((node) => node.taskId)
    .filter((taskId): taskId is TaskId => taskId !== undefined);
  if (new Set(taskNodeTaskIds).size !== taskNodeTaskIds.length) {
    throw new SchedulingEngineModelError("conflict", "schedule WBS task ids must be unique");
  }
}

function assertScheduleDependencyStructure(plan: SchedulePlan): void {
  const rawPlan = requireObject(plan, "schedulePlan");
  const tenantId = requireNonEmptyString(rawPlan.tenantId, "tenantId");
  const projectId = requireNonEmptyString(rawPlan.projectId, "projectId");
  const nodes = requireArray(rawPlan.wbsNodes, "schedulePlan.wbsNodes");
  const nodeIds: WbsNodeId[] = [];
  const taskIds = new Set<TaskId>();

  for (const rawNode of nodes) {
    const node = requireObject(rawNode, "wbsNode");
    const nodeTenantId = requireNonEmptyString(node.tenantId, "wbsNode.tenantId");
    const nodeProjectId = requireNonEmptyString(node.projectId, "wbsNode.projectId");
    assertSameScope(tenantId, projectId, nodeTenantId, nodeProjectId, "wbsNode");
    nodeIds.push(requireNonEmptyString(node.id, "wbsNode.id"));
    if (node.taskId !== undefined) {
      taskIds.add(requireNonEmptyString(node.taskId, "wbsNode.taskId"));
    }
  }
  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new SchedulingEngineModelError("conflict", "schedule WBS node ids must be unique");
  }
  assertUniqueTaskBackedWbsNodeTaskIds(nodes);

  const dependencies = requireArray(rawPlan.dependencies ?? [], "schedulePlan.dependencies").map((dependency) =>
    createDependency(dependency, tenantId, projectId)
  );
  const dependencyKeys = new Set<string>();
  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.predecessorTaskId)) {
      throw new SchedulingEngineModelError(
        "validation_error",
        "schedule dependency predecessorTaskId must reference a task WBS node"
      );
    }
    if (!taskIds.has(dependency.successorTaskId)) {
      throw new SchedulingEngineModelError(
        "validation_error",
        "schedule dependency successorTaskId must reference a task WBS node"
      );
    }
    const dependencyKey = `${dependency.type}:${dependency.predecessorTaskId}->${dependency.successorTaskId}`;
    if (dependencyKeys.has(dependencyKey)) {
      throw new SchedulingEngineModelError("conflict", "schedule dependencies must be unique");
    }
    dependencyKeys.add(dependencyKey);
  }
  assertNoDependencyCycles(dependencies);
}

export function createSchedulePlan(input: {
  id: SchedulePlanId;
  tenantId: TenantId;
  projectId: ProjectId;
  version: number;
  baselineId?: ScheduleBaselineSnapshotId;
  status?: SchedulePlanStatus;
  wbsNodes: WbsNode[];
  dependencies?: ScheduleDependency[];
}): SchedulePlan {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const projectId = requireNonEmptyString(input.projectId, "projectId");
  const wbsNodes = requireArray(input.wbsNodes, "schedulePlan.wbsNodes").map((node) =>
    createWbsNode(node, tenantId, projectId)
  );
  const nodeIds = wbsNodes.map((node) => node.id);
  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new SchedulingEngineModelError("conflict", "schedule WBS node ids must be unique");
  }
  assertUniqueTaskBackedWbsNodeTaskIds(wbsNodes);
  for (const node of wbsNodes) {
    if (node.parentId !== undefined && !nodeIds.includes(node.parentId)) {
      throw new SchedulingEngineModelError("validation_error", "wbsNode.parentId must reference another WBS node");
    }
    if (node.parentId === node.id) {
      throw new SchedulingEngineModelError("validation_error", "wbsNode cannot be its own parent");
    }
  }

  const taskIds = new Set(wbsNodes.map((node) => node.taskId).filter((taskId): taskId is string => taskId !== undefined));
  const dependencies = requireArray(input.dependencies ?? [], "schedulePlan.dependencies").map((dependency) =>
    createDependency(dependency, tenantId, projectId)
  );
  const dependencyKeys = new Set<string>();
  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.predecessorTaskId)) {
      throw new SchedulingEngineModelError(
        "validation_error",
        "schedule dependency predecessorTaskId must reference a task WBS node"
      );
    }
    if (!taskIds.has(dependency.successorTaskId)) {
      throw new SchedulingEngineModelError(
        "validation_error",
        "schedule dependency successorTaskId must reference a task WBS node"
      );
    }
    const dependencyKey = `${dependency.type}:${dependency.predecessorTaskId}->${dependency.successorTaskId}`;
    if (dependencyKeys.has(dependencyKey)) {
      throw new SchedulingEngineModelError("conflict", "schedule dependencies must be unique");
    }
    dependencyKeys.add(dependencyKey);
  }
  assertNoDependencyCycles(dependencies);

  const status = input.status ?? "draft";
  if (status !== "draft" && status !== "active" && status !== "archived") {
    throw new SchedulingEngineModelError("validation_error", "schedulePlan.status is invalid");
  }

  return {
    id: requireNonEmptyString(input.id, "schedulePlan.id"),
    tenantId,
    projectId,
    version: requirePositiveInteger(input.version, "schedulePlan.version"),
    baselineId:
      input.baselineId !== undefined ? requireNonEmptyString(input.baselineId, "schedulePlan.baselineId") : undefined,
    status,
    wbsNodes: wbsNodes.map((node) => ({ ...node, ...(node.schedule !== undefined ? { schedule: { ...node.schedule } } : {}) })),
    dependencies: dependencies.map((dependency) => ({ ...dependency }))
  };
}

export function validateSchedulePlan(plan: SchedulePlan): ScheduleValidationIssue[] {
  assertScheduleDependencyStructure(plan);

  const plannedFieldIssues = validatePlannedTaskFields(plan);
  if (plannedFieldIssues.length > 0) {
    return [...plannedFieldIssues, ...validateFinishToStartConflicts(plan)];
  }

  const safePlan = createSchedulePlan(plan);
  return validateFinishToStartConflicts(safePlan);
}

function validateFinishToStartConflicts(plan: SchedulePlan): ScheduleValidationIssue[] {
  const nodes = Array.isArray(plan.wbsNodes) ? plan.wbsNodes : [];
  const dependencies = Array.isArray(plan.dependencies) ? plan.dependencies : [];
  const taskNodeById = new Map(
    nodes
      .filter(
        (node): node is WbsNode & { taskId: TaskId } =>
          typeof node.taskId === "string" && node.taskId.trim().length > 0
      )
      .map((node) => [node.taskId, node])
  );
  const issues: ScheduleValidationIssue[] = [];

  for (const dependency of dependencies) {
    if (dependency.type !== "finish_to_start") continue;
    if (
      typeof dependency.predecessorTaskId !== "string" ||
      typeof dependency.successorTaskId !== "string" ||
      typeof dependency.id !== "string" ||
      dependency.id.trim().length === 0
    ) {
      continue;
    }
    const predecessor = taskNodeById.get(dependency.predecessorTaskId);
    const successor = taskNodeById.get(dependency.successorTaskId);
    if (predecessor === undefined || successor === undefined) continue;
    const predecessorFinish = predecessor.schedule?.plannedFinishDate;
    const successorStart = successor.schedule?.plannedStartDate;
    if (
      isValidIsoDate(predecessorFinish) &&
      isValidIsoDate(successorStart) &&
      successorStart < predecessorFinish
    ) {
      issues.push({
        code: "finish_to_start_conflict",
        severity: "blocking",
        message: "Successor task starts before predecessor task finishes.",
        nodeId: successor.id,
        dependencyId: dependency.id,
        fieldRefs: ["plannedStartDate", "plannedFinishDate"]
      });
    }
  }

  return issues;
}

function createPlannedFieldIssue(input: {
  code: ScheduleValidationIssueCode;
  message: string;
  nodeId?: WbsNodeId;
  fieldRefs: string[];
}): ScheduleValidationIssue {
  return {
    code: input.code,
    severity: "blocking",
    message: input.message,
    ...(input.nodeId !== undefined ? { nodeId: input.nodeId } : {}),
    fieldRefs: input.fieldRefs
  };
}

function validatePlannedTaskFields(plan: SchedulePlan): ScheduleValidationIssue[] {
  const nodes = Array.isArray(plan.wbsNodes) ? plan.wbsNodes : [];
  const issues: ScheduleValidationIssue[] = [];

  for (const node of nodes) {
    if (node.taskId === undefined) continue;

    const nodeId = typeof node.id === "string" && node.id.trim().length > 0 ? node.id : undefined;
    const plannedStartDate = node.schedule?.plannedStartDate;
    const plannedFinishDate = node.schedule?.plannedFinishDate;

    if (plannedStartDate === undefined) {
      issues.push(
        createPlannedFieldIssue({
          code: "missing_planned_start_date",
          message: "Task WBS node is missing planned start date.",
          nodeId,
          fieldRefs: ["plannedStartDate"]
        })
      );
    }
    if (plannedFinishDate === undefined) {
      issues.push(
        createPlannedFieldIssue({
          code: "missing_planned_finish_date",
          message: "Task WBS node is missing planned finish date.",
          nodeId,
          fieldRefs: ["plannedFinishDate"]
        })
      );
    }

    const startIsValid = plannedStartDate === undefined ? false : isValidIsoDate(plannedStartDate);
    const finishIsValid = plannedFinishDate === undefined ? false : isValidIsoDate(plannedFinishDate);
    if (
      plannedStartDate !== undefined &&
      plannedFinishDate !== undefined &&
      (!startIsValid || !finishIsValid || plannedFinishDate < plannedStartDate)
    ) {
      issues.push(
        createPlannedFieldIssue({
          code: "invalid_date_range",
          message: "Task WBS node planned finish date must be on or after planned start date.",
          nodeId,
          fieldRefs: ["plannedStartDate", "plannedFinishDate"]
        })
      );
    }

    if (node.plannedWorkHours === undefined) {
      issues.push(
        createPlannedFieldIssue({
          code: "missing_planned_work_hours",
          message: "Task WBS node is missing planned work hours.",
          nodeId,
          fieldRefs: ["plannedWorkHours"]
        })
      );
    } else if (
      typeof node.plannedWorkHours !== "number" ||
      !Number.isFinite(node.plannedWorkHours) ||
      node.plannedWorkHours < 0
    ) {
      issues.push(
        createPlannedFieldIssue({
          code: "invalid_planned_work_hours",
          message: "Task WBS node planned work hours must be a non-negative number.",
          nodeId,
          fieldRefs: ["plannedWorkHours"]
        })
      );
    }

    if (node.progressPercent === undefined) {
      issues.push(
        createPlannedFieldIssue({
          code: "missing_progress_percent",
          message: "Task WBS node is missing progress percent.",
          nodeId,
          fieldRefs: ["progressPercent"]
        })
      );
    } else if (
      typeof node.progressPercent !== "number" ||
      !Number.isFinite(node.progressPercent) ||
      node.progressPercent < 0 ||
      node.progressPercent > 100
    ) {
      issues.push(
        createPlannedFieldIssue({
          code: "invalid_progress_percent",
          message: "Task WBS node progress percent must be between 0 and 100.",
          nodeId,
          fieldRefs: ["progressPercent"]
        })
      );
    }
  }

  return issues;
}

export function createScheduleBaselineSnapshot(input: {
  id: ScheduleBaselineSnapshotId;
  tenantId: TenantId;
  projectId: ProjectId;
  schedulePlanId: SchedulePlanId;
  createdBy: string;
  createdAt: string;
  taskBaselineValues: ScheduleTaskBaselineValue[];
}): ScheduleBaselineSnapshot {
  const taskBaselineValues = requireArray(input.taskBaselineValues, "baseline.taskBaselineValues").map((rawValue) => {
    const value = requireObject(rawValue, "baseline.taskBaselineValue");
    const plannedStartDate =
      value.plannedStartDate !== undefined
        ? requireIsoDate(value.plannedStartDate, "baseline.taskBaselineValue.plannedStartDate")
        : undefined;
    const plannedFinishDate =
      value.plannedFinishDate !== undefined
        ? requireIsoDate(value.plannedFinishDate, "baseline.taskBaselineValue.plannedFinishDate")
        : undefined;
    if (plannedStartDate !== undefined && plannedFinishDate !== undefined && plannedFinishDate < plannedStartDate) {
      throw new SchedulingEngineModelError(
        "validation_error",
        "baseline.taskBaselineValue.plannedFinishDate must be on or after plannedStartDate"
      );
    }
    const durationDays =
      value.durationDays !== undefined
        ? requirePositiveInteger(value.durationDays, "baseline.taskBaselineValue.durationDays")
        : undefined;
    if (
      plannedStartDate !== undefined &&
      plannedFinishDate !== undefined &&
      durationDays !== undefined &&
      durationDays !== durationDaysInclusive(plannedStartDate, plannedFinishDate)
    ) {
      throw new SchedulingEngineModelError(
        "validation_error",
        "baseline.taskBaselineValue.durationDays must match planned date range"
      );
    }

    return {
      taskId: requireNonEmptyString(value.taskId, "baseline.taskBaselineValue.taskId"),
      ...(plannedStartDate !== undefined ? { plannedStartDate } : {}),
      ...(plannedFinishDate !== undefined ? { plannedFinishDate } : {}),
      ...(durationDays !== undefined ? { durationDays } : {}),
      ...(value.progressPercent !== undefined
        ? { progressPercent: requireProgressPercent(value.progressPercent, "baseline.taskBaselineValue.progressPercent") }
        : {})
    };
  });
  const taskBaselineIds = taskBaselineValues.map((value) => value.taskId);
  if (new Set(taskBaselineIds).size !== taskBaselineIds.length) {
    throw new SchedulingEngineModelError("conflict", "baseline.taskBaselineValues task ids must be unique");
  }
  const frozenTaskBaselineValues = Object.freeze(
    taskBaselineValues.map((value) => Object.freeze(copyScheduleTaskBaselineValue(value)))
  );
  const snapshotCore = {
    id: requireNonEmptyString(input.id, "baseline.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    projectId: requireNonEmptyString(input.projectId, "projectId"),
    schedulePlanId: requireNonEmptyString(input.schedulePlanId, "baseline.schedulePlanId"),
    createdBy: requireNonEmptyString(input.createdBy, "baseline.createdBy"),
    createdAt: requireTimestamp(input.createdAt, "baseline.createdAt")
  };

  return Object.freeze({
    ...snapshotCore,
    get taskBaselineValues() {
      return frozenTaskBaselineValues.map(copyScheduleTaskBaselineValue);
    }
  });
}

export function captureScheduleBaselineSnapshot(input: ScheduleBaselineCaptureInput): ScheduleBaselineSnapshot {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const projectId = requireNonEmptyString(input.projectId, "projectId");
  const schedulePlanId = requireNonEmptyString(input.schedulePlanId, "baseline.schedulePlanId");
  const safePlan = createSchedulePlan(requireObject(input.schedulePlan, "baseline.schedulePlan"));
  assertSameScope(tenantId, projectId, safePlan.tenantId, safePlan.projectId, "baseline capture schedulePlan");
  if (safePlan.id !== schedulePlanId) {
    throw new SchedulingEngineModelError("tenant_mismatch", "baseline capture schedulePlanId must match schedule plan id");
  }

  const taskBaselineValues = [...safePlan.wbsNodes]
    .filter((node): node is WbsNode & { taskId: TaskId } => node.taskId !== undefined)
    .sort((left, right) => left.sortOrder - right.sortOrder || compareStrings(left.id, right.id))
    .map(captureTaskBaselineValue);

  return createScheduleBaselineSnapshot({
    id: input.id,
    tenantId,
    projectId,
    schedulePlanId,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    taskBaselineValues
  });
}

export function updateScheduleBaselineSnapshot(input: ScheduleBaselineCaptureInput): ScheduleBaselineSnapshot {
  return captureScheduleBaselineSnapshot(input);
}
