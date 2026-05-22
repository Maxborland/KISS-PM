import { createEmptyPlanDelta, type PlanDelta, type PlanningCommand } from "./planningCommands";
import { comparePlanDates } from "./calendar";
import type {
  PlanAssignment,
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
          task.id === command.payload.taskId
            ? {
                ...task,
                plannedStart: command.payload.plannedStart ?? task.plannedStart,
                plannedFinish: command.payload.plannedFinish ?? task.plannedFinish
              }
            : task
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
    case "assignment.delete":
      return withSnapshot(snapshot, command, {
        assignments: snapshot.assignments.filter(
          (assignment) => assignment.id !== command.payload.assignmentId
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
    wbsCode: String(snapshot.tasks.length + 1),
    title: command.payload.title,
    statusId: command.payload.statusId,
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart,
    plannedFinish,
    durationMinutes: null,
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
      tasks: [...snapshot.tasks, task],
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
      if (command.payload.workMinutes < 0) {
        return [invalid("planning_command_invalid", "Трудоемкость задачи не может быть отрицательной")];
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

function invalid(code: ValidationIssue["code"], message: string): ValidationIssue {
  return {
    code,
    severity: "error",
    message,
    entity: null
  };
}

function moveTask(
  tasks: PlanTask[],
  taskId: string,
  parentTaskId: string | null,
  sortOrder: number
): PlanTask[] {
  const moved = tasks.find((task) => task.id === taskId);
  if (!moved) return tasks;

  const rest = tasks.filter((task) => task.id !== taskId);
  const index = Math.max(0, Math.min(sortOrder, rest.length));
  const next = [...rest.slice(0, index), { ...moved, parentTaskId }, ...rest.slice(index)];

  return next.map((task, taskIndex) => ({
    ...task,
    wbsCode: String(taskIndex + 1)
  }));
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
  if (command.type === "assignment.delete") return [command.payload.assignmentId];
  return [];
}

function dependencyIdsFor(command: PlanningCommand): string[] {
  if (command.type === "dependency.upsert") return [command.payload.id];
  if (command.type === "dependency.delete") return [command.payload.dependencyId];
  return [];
}
