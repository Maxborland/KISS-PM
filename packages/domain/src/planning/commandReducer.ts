import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import { comparePlanDates } from "./calendar";
import type {
  PlanAssignment,
  PlanAssignmentAllocation,
  PlanBaseline,
  PlanConstraint,
  PlanSnapshot,
  PlanTask,
  ValidationIssue
} from "./types";

export type CommandReductionResult = {
  nextSnapshot: PlanSnapshot;
  planDelta: PlanDelta;
  validationIssues: ValidationIssue[];
};

export function reducePlanningCommand(
  snapshot: PlanSnapshot,
  command: PlanningCommand
): CommandReductionResult {
  const invalid = validateCommandPreconditions(snapshot, command);
  if (invalid.length > 0) {
    return {
      nextSnapshot: snapshot,
      planDelta: { ...createEmptyPlanDelta(), commands: [command] },
      validationIssues: invalid
    };
  }

  switch (command.type) {
    case "task.create":
      return reduceTaskCreate(snapshot, command);
    case "task.update_identity":
      return withSnapshot(snapshot, command, {
        tasks: snapshot.tasks.map((task) =>
          task.id === command.payload.taskId ? { ...task, title: command.payload.title } : task
        )
      });
    case "task.update_schedule":
      return withSnapshot(snapshot, command, {
        tasks: snapshot.tasks.map((task) =>
          task.id === command.payload.taskId ? updateTaskSchedule(task, command.payload) : task
        )
      });
    case "task.update_work_model":
      return withSnapshot(snapshot, command, {
        tasks: snapshot.tasks.map((task) =>
          task.id === command.payload.taskId
            ? {
                ...task,
                taskType: command.payload.taskType,
                effortDriven: command.payload.effortDriven,
                durationMinutes: command.payload.durationMinutes,
                workMinutes: command.payload.workMinutes
              }
            : task
        )
      });
    case "task.update_status":
      return withSnapshot(snapshot, command, {
        tasks: snapshot.tasks.map((task) =>
          task.id === command.payload.taskId ? { ...task, statusId: command.payload.statusId } : task
        )
      });
    case "task.move_wbs":
      return withSnapshot(snapshot, command, {
        tasks: moveTask(snapshot.tasks, command.payload.taskId, command.payload.parentTaskId, command.payload.sortOrder)
      });
    case "task.delete_or_archive":
      return reduceTaskDeleteOrArchive(snapshot, command);
    case "dependency.upsert":
      return reduceDependencyUpsert(snapshot, command);
    case "dependency.delete":
      return withSnapshot(snapshot, command, {
        dependencies: snapshot.dependencies.filter(
          (dependency) => dependency.id !== command.payload.dependencyId
        )
      });
    case "assignment.upsert":
      return reduceAssignmentUpsert(snapshot, command);
    case "assignment.allocations.replace":
      return reduceAssignmentAllocationsReplace(snapshot, command);
    case "assignment.delete":
      return withSnapshot(snapshot, command, {
        assignments: snapshot.assignments.filter(
          (assignment) => assignment.id !== command.payload.assignmentId
        ),
        assignmentAllocations: snapshot.assignmentAllocations.filter(
          (allocation) => allocation.assignmentId !== command.payload.assignmentId
        )
      });
    case "baseline.capture":
      return reduceBaselineCapture(snapshot, command);
    case "calendar.exception.upsert":
      return withSnapshot(snapshot, command, {
        calendarExceptions: upsertById(snapshot.calendarExceptions, {
          id: command.payload.id,
          calendarId: command.payload.calendarId,
          resourceId: command.payload.resourceId,
          date: command.payload.date,
          workingMinutes: command.payload.workingMinutes,
          reason: command.payload.reason
        })
      });
    case "constraint.update":
      return reduceConstraintUpdate(snapshot, command);
    case "resource.reserve":
      return withSnapshot(snapshot, command, {
        reservations: upsertById(snapshot.reservations, {
          id: command.payload.id,
          resourceId: command.payload.resourceId,
          projectId: snapshot.projectId,
          start: command.payload.start,
          finish: command.payload.finish,
          workMinutes: command.payload.workMinutes,
          reason: command.payload.reason
        })
      });
    case "risk.accept_overload":
      return withSnapshot(snapshot, command, {}, { acceptedRiskIds: [command.payload.overloadId] });
    case "project.deadline.move":
      return withSnapshot(snapshot, command, {
        project: { ...snapshot.project, deadline: command.payload.deadline }
      });
  }
}

function reduceTaskCreate(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "task.create" }>
): CommandReductionResult {
  const plannedStart = command.payload.plannedStart ?? snapshot.project.plannedStart;
  const plannedFinish = command.payload.plannedFinish ?? plannedStart;
  const task: PlanTask = {
    id: command.payload.id,
    parentTaskId: command.payload.parentTaskId ?? null,
    wbsCode: nextPreviewWbsCode(snapshot.tasks, command.payload.parentTaskId ?? null),
    title: command.payload.title,
    statusId: command.payload.statusId,
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart,
    plannedFinish,
    durationMinutes: command.payload.durationMinutes ?? null,
    workMinutes: command.payload.workMinutes,
    percentComplete: 0,
    calendarId: snapshot.project.calendarId,
    constraint: null
  };
  const assignments = command.payload.assignments.map<PlanAssignment>((assignment, index) => ({
    id: assignment.id ?? `${command.payload.id}-assignment-${index + 1}`,
    taskId: command.payload.id,
    resourceId: assignment.resourceId,
    role: assignment.role,
    unitsPermille: assignment.unitsPermille,
    workMinutes: assignment.workMinutes ?? null,
    calendarId: null
  }));

  return withSnapshot(
    snapshot,
    command,
    {
      tasks: sortTasksByWbs([...snapshot.tasks, task]),
      assignments: [...snapshot.assignments, ...assignments]
    },
    {
      changedTaskIds: [task.id],
      changedAssignmentIds: assignments.map((assignment) => assignment.id)
    }
  );
}

function reduceTaskDeleteOrArchive(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "task.delete_or_archive" }>
): CommandReductionResult {
  const removedAssignmentIds = snapshot.assignments
    .filter((assignment) => assignment.taskId === command.payload.taskId)
    .map((assignment) => assignment.id);
  const removedDependencyIds = snapshot.dependencies
    .filter(
      (dependency) =>
        dependency.predecessorTaskId === command.payload.taskId ||
        dependency.successorTaskId === command.payload.taskId
    )
    .map((dependency) => dependency.id);

  return withSnapshot(
    snapshot,
    command,
    {
      tasks: snapshot.tasks.filter((task) => task.id !== command.payload.taskId),
      assignments: snapshot.assignments.filter(
        (assignment) => assignment.taskId !== command.payload.taskId
      ),
      assignmentAllocations: snapshot.assignmentAllocations.filter(
        (allocation) => allocation.taskId !== command.payload.taskId
      ),
      dependencies: snapshot.dependencies.filter(
        (dependency) =>
          dependency.predecessorTaskId !== command.payload.taskId &&
          dependency.successorTaskId !== command.payload.taskId
      ),
      constraints: snapshot.constraints.filter(
        (constraint) => constraint.taskId !== command.payload.taskId
      )
    },
    {
      changedAssignmentIds: removedAssignmentIds,
      changedDependencyIds: removedDependencyIds
    }
  );
}

function reduceDependencyUpsert(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "dependency.upsert" }>
): CommandReductionResult {
  return withSnapshot(
    snapshot,
    command,
    {
      dependencies: upsertById(snapshot.dependencies, {
        id: command.payload.id,
        predecessorTaskId: command.payload.predecessorTaskId,
        successorTaskId: command.payload.successorTaskId,
        type: command.payload.dependencyType,
        lagMinutes: command.payload.lagMinutes
      })
    },
    { changedDependencyIds: [command.payload.id] }
  );
}

function reduceAssignmentUpsert(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "assignment.upsert" }>
): CommandReductionResult {
  return withSnapshot(
    snapshot,
    command,
    {
      assignments: upsertById(snapshot.assignments, {
        id: command.payload.id,
        taskId: command.payload.taskId,
        resourceId: command.payload.resourceId,
        role: command.payload.role,
        unitsPermille: command.payload.unitsPermille,
        workMinutes: command.payload.workMinutes,
        calendarId: null
      })
    },
    { changedAssignmentIds: [command.payload.id] }
  );
}

function reduceAssignmentAllocationsReplace(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "assignment.allocations.replace" }>
): CommandReductionResult {
  const assignment = snapshot.assignments.find(
    (candidate) => candidate.id === command.payload.assignmentId
  );
  if (!assignment) {
    return {
      nextSnapshot: snapshot,
      planDelta: { ...createEmptyPlanDelta(), commands: [command] },
      validationIssues: [
        invalid("planning_command_invalid", "Команда ссылается на неизвестное назначение")
      ]
    };
  }

  const nextAllocations = command.payload.allocations
    .filter((allocation) => allocation.workMinutes > 0)
    .map<PlanAssignmentAllocation>((allocation) => ({
      assignmentId: assignment.id,
      taskId: assignment.taskId,
      resourceId: assignment.resourceId,
      date: allocation.date,
      workMinutes: allocation.workMinutes
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return withSnapshot(
    snapshot,
    command,
    {
      assignmentAllocations: [
        ...snapshot.assignmentAllocations.filter(
          (allocation) => allocation.assignmentId !== assignment.id
        ),
        ...nextAllocations
      ]
    },
    { changedAssignmentIds: [assignment.id] }
  );
}

function reduceBaselineCapture(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "baseline.capture" }>
): CommandReductionResult {
  const baseline: PlanBaseline = {
    id: command.payload.baselineId,
    capturedAt: snapshot.capturedAt,
    tasks: snapshot.tasks.map((task) => ({
      taskId: task.id,
      plannedStart: task.plannedStart,
      plannedFinish: task.plannedFinish,
      workMinutes: task.workMinutes
    }))
  };

  return withSnapshot(snapshot, command, {
    baselines: upsertById(snapshot.baselines, baseline)
  });
}

function reduceConstraintUpdate(
  snapshot: PlanSnapshot,
  command: Extract<PlanningCommand, { type: "constraint.update" }>
): CommandReductionResult {
  const constraint: PlanConstraint = {
    id: command.payload.constraintId,
    taskId: command.payload.taskId,
    type: command.payload.type,
    date: command.payload.date
  };

  return withSnapshot(snapshot, command, {
    constraints: upsertById(snapshot.constraints, constraint),
    tasks: snapshot.tasks.map((task) =>
      task.id === command.payload.taskId ? { ...task, constraint } : task
    )
  });
}

function withSnapshot(
  snapshot: PlanSnapshot,
  command: PlanningCommand,
  patch: Partial<PlanSnapshot>,
  deltaPatch: Partial<PlanDelta> = {}
): CommandReductionResult {
  return {
    nextSnapshot: {
      ...snapshot,
      ...patch
    },
    planDelta: {
      ...createEmptyPlanDelta(),
      commands: [command],
      changedTaskIds: taskIdsFor(command),
      changedAssignmentIds: assignmentIdsFor(command),
      changedDependencyIds: dependencyIdsFor(command),
      acceptedRiskIds: [],
      ...deltaPatch
    },
    validationIssues: []
  };
}

function validateCommandPreconditions(
  snapshot: PlanSnapshot,
  command: PlanningCommand
): ValidationIssue[] {
  const taskIds = new Set(snapshot.tasks.map((task) => task.id));
  const resourceIds = new Set(snapshot.resources.map((resource) => resource.id));
  const assignmentIds = new Set(snapshot.assignments.map((assignment) => assignment.id));
  const dependencyIds = new Set(snapshot.dependencies.map((dependency) => dependency.id));
  const calendarIds = new Set(snapshot.calendars.map((calendar) => calendar.id));

  if (command.type === "task.create" && command.payload.projectId !== snapshot.projectId) {
    return [invalid("planning_command_invalid", "Команда создает задачу в другом проекте")];
  }

  switch (command.type) {
    case "task.create":
      if (taskIds.has(command.payload.id)) {
        return [invalid("planning_command_invalid", "Задача с таким идентификатором уже есть в плане")];
      }
      if (
        command.payload.parentTaskId !== undefined &&
        command.payload.parentTaskId !== null &&
        !taskIds.has(command.payload.parentTaskId)
      ) {
        return [invalid("planning_command_invalid", "Команда ссылается на неизвестную родительскую задачу")];
      }
      if (command.payload.workMinutes < 0) {
        return [invalid("planning_command_invalid", "Трудоемкость задачи не может быть отрицательной")];
      }
      if (
        command.payload.durationMinutes !== undefined &&
        command.payload.durationMinutes !== null &&
        command.payload.durationMinutes <= 0
      ) {
        return [invalid("planning_command_invalid", "Длительность задачи должна быть больше нуля")];
      }
      if (
        command.payload.assignments.some(
          (assignment) =>
            !resourceIds.has(assignment.resourceId) ||
            assignment.unitsPermille <= 0 ||
            (assignment.workMinutes !== undefined &&
              assignment.workMinutes !== null &&
              assignment.workMinutes < 0)
        )
      ) {
        return [invalid("planning_command_invalid", "Команда содержит некорректное назначение")];
      }
      return [];
    case "task.update_identity":
    case "task.update_schedule":
    case "task.update_status":
      return requireTask(taskIds, command.payload.taskId);
    case "task.update_work_model":
      return [
        ...requireTask(taskIds, command.payload.taskId),
        ...validateWorkModelPayload(command.payload.durationMinutes, command.payload.workMinutes)
      ];
    case "task.move_wbs":
      if (!taskIds.has(command.payload.taskId)) {
        return [invalid("planning_command_invalid", "Команда ссылается на неизвестную задачу")];
      }
      if (command.payload.parentTaskId === command.payload.taskId) {
        return [invalid("planning_command_invalid", "Задача не может быть родителем самой себе")];
      }
      if (command.payload.parentTaskId !== null && !taskIds.has(command.payload.parentTaskId)) {
        return [invalid("planning_command_invalid", "Команда ссылается на неизвестную родительскую задачу")];
      }
      if (
        command.payload.parentTaskId !== null &&
        isDescendantTask(snapshot.tasks, command.payload.taskId, command.payload.parentTaskId)
      ) {
        return [invalid("planning_command_invalid", "Задача не может быть перемещена под свою дочернюю задачу")];
      }
      if (!Number.isFinite(command.payload.sortOrder) || command.payload.sortOrder < 0) {
        return [invalid("planning_command_invalid", "Порядок WBS должен быть неотрицательным числом")];
      }
      return [];
    case "task.delete_or_archive":
      return requireTask(taskIds, command.payload.taskId);
    case "dependency.upsert":
      if (
        !taskIds.has(command.payload.predecessorTaskId) ||
        !taskIds.has(command.payload.successorTaskId)
      ) {
        return [invalid("planning_command_invalid", "Зависимость ссылается на неизвестную задачу")];
      }
      if (command.payload.predecessorTaskId === command.payload.successorTaskId) {
        return [invalid("planning_command_invalid", "Задача не может зависеть сама от себя")];
      }
      if (!Number.isFinite(command.payload.lagMinutes)) {
        return [invalid("planning_command_invalid", "Lag/lead должен быть числом рабочих минут")];
      }
      return [];
    case "dependency.delete":
      if (!dependencyIds.has(command.payload.dependencyId)) {
        return [invalid("planning_command_invalid", "Команда ссылается на неизвестную зависимость")];
      }
      return [];
    case "assignment.upsert":
      if (!taskIds.has(command.payload.taskId)) {
        return [invalid("planning_command_invalid", "Назначение ссылается на неизвестную задачу")];
      }
      if (!resourceIds.has(command.payload.resourceId)) {
        return [invalid("planning_command_invalid", "Назначение ссылается на неизвестный ресурс")];
      }
      if (command.payload.unitsPermille <= 0) {
        return [invalid("planning_command_invalid", "Units назначения должны быть больше нуля")];
      }
      if (command.payload.workMinutes !== null && command.payload.workMinutes < 0) {
        return [invalid("planning_command_invalid", "Трудоемкость назначения не может быть отрицательной")];
      }
      return [];
    case "assignment.allocations.replace":
      if (!assignmentIds.has(command.payload.assignmentId)) {
        return [invalid("planning_command_invalid", "Команда ссылается на неизвестное назначение")];
      }
      if (
        command.payload.allocations.some(
          (allocation) =>
            allocation.workMinutes < 0 || allocation.date.trim().length === 0
        )
      ) {
        return [invalid("planning_command_invalid", "Команда содержит некорректное распределение назначения")];
      }
      if (new Set(command.payload.allocations.map((allocation) => allocation.date)).size !== command.payload.allocations.length) {
        return [invalid("planning_command_invalid", "Распределение назначения содержит повторяющиеся даты")];
      }
      return [];
    case "assignment.delete":
      if (!assignmentIds.has(command.payload.assignmentId)) {
        return [invalid("planning_command_invalid", "Команда ссылается на неизвестное назначение")];
      }
      return [];
    case "baseline.capture":
      if (command.payload.baselineId.trim().length === 0) {
        return [invalid("planning_command_invalid", "Baseline должен иметь идентификатор")];
      }
      return [];
    case "calendar.exception.upsert":
      if (!calendarIds.has(command.payload.calendarId)) {
        return [invalid("planning_command_invalid", "Исключение ссылается на неизвестный календарь")];
      }
      if (
        command.payload.resourceId !== null &&
        !resourceIds.has(command.payload.resourceId)
      ) {
        return [invalid("planning_command_invalid", "Исключение ссылается на неизвестный ресурс")];
      }
      if (command.payload.workingMinutes < 0) {
        return [invalid("planning_command_invalid", "Рабочее время исключения не может быть отрицательным")];
      }
      return [];
    case "constraint.update":
      return requireTask(taskIds, command.payload.taskId);
    case "resource.reserve":
      if (!resourceIds.has(command.payload.resourceId)) {
        return [invalid("planning_command_invalid", "Резерв ссылается на неизвестный ресурс")];
      }
      if (comparePlanDates(command.payload.start, command.payload.finish) > 0) {
        return [invalid("planning_command_invalid", "Дата начала резерва не может быть позже завершения")];
      }
      if (command.payload.workMinutes <= 0) {
        return [invalid("planning_command_invalid", "Трудоемкость резерва должна быть больше нуля")];
      }
      return [];
    case "risk.accept_overload":
      if (command.payload.acceptedRiskReason.trim().length === 0) {
        return [invalid("planning_command_invalid", "Принятие риска требует обоснования")];
      }
      return [];
    case "project.deadline.move":
      if (command.payload.reason.trim().length === 0) {
        return [invalid("planning_command_invalid", "Перенос deadline требует причины")];
      }
      return [];
  }

  return [];
}

function requireTask(taskIds: Set<string>, taskId: string): ValidationIssue[] {
  if (taskIds.has(taskId)) return [];
  return [invalid("planning_command_invalid", "Команда ссылается на неизвестную задачу")];
}

function validateWorkModelPayload(
  durationMinutes: number | null,
  workMinutes: number
): ValidationIssue[] {
  if (workMinutes < 0) {
    return [invalid("planning_command_invalid", "Трудоемкость задачи не может быть отрицательной")];
  }
  if (durationMinutes !== null && durationMinutes <= 0) {
    return [invalid("planning_command_invalid", "Длительность задачи должна быть больше нуля")];
  }
  return [];
}

function isDescendantTask(tasks: PlanTask[], ancestorTaskId: string, candidateTaskId: string): boolean {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const visitedTaskIds = new Set<string>();
  let current = tasksById.get(candidateTaskId);

  while (current?.parentTaskId) {
    if (current.parentTaskId === ancestorTaskId) return true;
    if (visitedTaskIds.has(current.parentTaskId)) return false;
    visitedTaskIds.add(current.parentTaskId);
    current = tasksById.get(current.parentTaskId);
  }

  return false;
}

function invalid(code: ValidationIssue["code"], message: string): ValidationIssue {
  return {
    code,
    severity: "error",
    message,
    entity: null
  };
}

function updateTaskSchedule(
  task: PlanTask,
  payload: Extract<PlanningCommand, { type: "task.update_schedule" }>["payload"]
): PlanTask {
  const plannedStart = payload.plannedStart ?? task.plannedStart;
  const plannedStartInstant =
    payload.plannedStart !== null && task.plannedStartInstant
      ? { ...task.plannedStartInstant, date: payload.plannedStart }
      : task.plannedStartInstant;

  return {
    ...task,
    plannedStart,
    plannedFinish: payload.plannedFinish ?? task.plannedFinish,
    ...(plannedStartInstant !== undefined ? { plannedStartInstant } : {})
  };
}

function moveTask(
  tasks: PlanTask[],
  taskId: string,
  parentTaskId: string | null,
  sortOrder: number
): PlanTask[] {
  const orderedTasks = reindexWbsHierarchy(tasks);
  const moved = orderedTasks.find((task) => task.id === taskId);
  if (!moved) return tasks;

  const retargeted = orderedTasks.map((task) => (task.id === taskId ? { ...task, parentTaskId } : task));
  const siblingIds = retargeted
    .filter((task) => task.parentTaskId === parentTaskId && task.id !== taskId)
    .map((task) => task.id);
  const index = Math.max(0, Math.min(sortOrder, siblingIds.length));
  const targetSiblingIds = [...siblingIds.slice(0, index), moved.id, ...siblingIds.slice(index)];
  const siblingOrderOverrides = new Map<string, number>();
  targetSiblingIds.forEach((id, siblingIndex) => siblingOrderOverrides.set(id, siblingIndex));

  return reindexWbsHierarchy(retargeted, siblingOrderOverrides);
}

function nextPreviewWbsCode(tasks: PlanTask[], parentTaskId: string | null): string {
  if (parentTaskId !== null) {
    const parent = tasks.find((task) => task.id === parentTaskId);
    if (!parent) return String(tasks.length + 1);
    const maxChildCode = tasks.reduce((max, task) => {
      if (task.parentTaskId !== parentTaskId) return max;
      const childCode = parseWbsPart(task.wbsCode.split(".").at(-1));
      return Math.max(max, childCode);
    }, 0);
    return `${parent.wbsCode}.${maxChildCode + 1}`;
  }

  const maxTopLevelCode = tasks.reduce((max, task) => {
    if (task.parentTaskId !== null) return max;
    return Math.max(max, parseWbsPart(task.wbsCode));
  }, 0);
  return String(maxTopLevelCode + 1);
}

function sortTasksByWbs(tasks: PlanTask[]): PlanTask[] {
  return [...tasks].sort(
    (left, right) => compareWbsCodes(left.wbsCode, right.wbsCode) || left.id.localeCompare(right.id)
  );
}

function reindexWbsHierarchy(
  tasks: PlanTask[],
  siblingOrderOverrides: Map<string, number> = new Map()
): PlanTask[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const inputOrderById = new Map(tasks.map((task, index) => [task.id, index]));
  const tasksByParentId = new Map<string | null, PlanTask[]>();

  for (const task of tasks) {
    const parentId = task.parentTaskId !== null && taskIds.has(task.parentTaskId) ? task.parentTaskId : null;
    const normalizedTask = parentId === task.parentTaskId ? task : { ...task, parentTaskId: null };
    tasksByParentId.set(parentId, [...(tasksByParentId.get(parentId) ?? []), normalizedTask]);
  }

  const result: PlanTask[] = [];
  const emittedTaskIds = new Set<string>();

  const appendChildren = (parentId: string | null, prefix: string): void => {
    const siblings = [...(tasksByParentId.get(parentId) ?? [])].sort((left, right) => {
      const leftOverride = siblingOrderOverrides.get(left.id);
      const rightOverride = siblingOrderOverrides.get(right.id);
      if (leftOverride !== undefined || rightOverride !== undefined) {
        return (leftOverride ?? Number.MAX_SAFE_INTEGER) - (rightOverride ?? Number.MAX_SAFE_INTEGER);
      }
      return (
        compareWbsCodes(left.wbsCode, right.wbsCode) ||
        (inputOrderById.get(left.id) ?? 0) - (inputOrderById.get(right.id) ?? 0) ||
        left.id.localeCompare(right.id)
      );
    });

    siblings.forEach((task, index) => {
      if (emittedTaskIds.has(task.id)) return;
      const wbsCode = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      emittedTaskIds.add(task.id);
      result.push({ ...task, wbsCode });
      appendChildren(task.id, wbsCode);
    });
  };

  appendChildren(null, "");
  return result;
}

function compareWbsCodes(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = parseWbsPart(leftParts[index]);
    const rightPart = parseWbsPart(rightParts[index]);
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
}

function parseWbsPart(part: string | undefined): number {
  if (part === undefined) return 0;
  const numericPart = Number.parseInt(part, 10);
  return Number.isFinite(numericPart) ? numericPart : 0;
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const exists = items.some((candidate) => candidate.id === item.id);
  if (!exists) return [...items, item];
  return items.map((candidate) => (candidate.id === item.id ? item : candidate));
}

function taskIdsFor(command: PlanningCommand): string[] {
  if ("taskId" in command.payload && typeof command.payload.taskId === "string") {
    return [command.payload.taskId];
  }
  if (command.type === "task.create") return [command.payload.id];
  return [];
}

function assignmentIdsFor(command: PlanningCommand): string[] {
  if (command.type === "assignment.upsert") return [command.payload.id];
  if (command.type === "assignment.allocations.replace") return [command.payload.assignmentId];
  if (command.type === "assignment.delete") return [command.payload.assignmentId];
  return [];
}

function dependencyIdsFor(command: PlanningCommand): string[] {
  if (command.type === "dependency.upsert") return [command.payload.id];
  if (command.type === "dependency.delete") return [command.payload.dependencyId];
  return [];
}
