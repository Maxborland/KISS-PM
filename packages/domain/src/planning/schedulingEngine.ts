import {
  detectDependencyCycles,
  getPredecessorLatestWindow,
  getSuccessorStartCandidate,
  getTopologicalTaskOrder,
  minLatestWindow
} from "./dependencyGraph";
import { comparePlanDates } from "./calendar";
import { recalculateWorkModel } from "./workModel";
import {
  addWorkingMinutesToInstant,
  compareWorkingInstants,
  diffWorkingMinutes,
  endOfWorkingDate,
  maxWorkingInstant,
  startOfWorkingDate
} from "./workingTime";
import type {
  CalculatedDependency,
  CalculatedPlan,
  CalculatedTask,
  PlanAssignment,
  PlanCalendar,
  PlanSnapshot,
  PlanTask,
  ScheduleTraceEntry,
  ValidationIssue,
  WorkingInstant
} from "./types";

export type CalculatePlanOptions = {
  calculatedAt: string;
  engineVersion: string;
};

type ScheduleWindow = {
  task: PlanTask;
  calendar: PlanCalendar;
  calendarExceptions: PlanSnapshot["calendarExceptions"];
  durationMinutes: number;
  authoredStart: WorkingInstant;
  dependencyStart: WorkingInstant | null;
  earliestStart: WorkingInstant;
  earliestFinish: WorkingInstant;
  latestStart: WorkingInstant;
  latestFinish: WorkingInstant;
};

const defaultCalendar: PlanCalendar = {
  id: "default-calendar",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};

export function calculatePlan(
  snapshot: PlanSnapshot,
  options: CalculatePlanOptions
): CalculatedPlan {
  const validationIssues: ValidationIssue[] = [];
  const cycles = detectDependencyCycles(snapshot.dependencies);
  for (const cycle of cycles) {
    validationIssues.push({
      code: "dependency_cycle_detected",
      severity: "error",
      message: "В плане найдена циклическая зависимость",
      entity: { type: "TaskDependency", id: cycle.dependencyIds[0] ?? "unknown" }
    });
  }

  const cycleTaskIds = new Set(cycles.flatMap((cycle) => cycle.taskIds));
  const orderedTaskIds = getTopologicalTaskOrder(
    snapshot.tasks.map((task) => task.id),
    snapshot.dependencies
  );
  const tasksById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const windows = new Map<string, ScheduleWindow>();

  for (const taskId of orderedTaskIds) {
    const task = tasksById.get(taskId);
    if (!task) continue;

    try {
      const taskCalendar = selectTaskCalendar(snapshot, task);
      const taskCalendarExceptions = selectTaskCalendarExceptions(snapshot, taskCalendar);
      const durationMinutes = resolveDurationMinutes(task, snapshot.assignments, validationIssues);
      const authoredStart = resolveAuthoredStart(task, snapshot, taskCalendar, taskCalendarExceptions);
      const dependencyStart = resolveDependencyStart(
        task,
        durationMinutes,
        snapshot,
        windows,
        taskCalendar,
        taskCalendarExceptions
      );
      let earliestStart = dependencyStart
        ? maxWorkingInstant(authoredStart, dependencyStart)
        : authoredStart;
      earliestStart = applyStartConstraint(
        task,
        earliestStart,
        dependencyStart,
        taskCalendar,
        taskCalendarExceptions,
        validationIssues
      );
      const earliestFinish = addWorkingMinutesToInstant(
        earliestStart,
        durationMinutes,
        taskCalendar,
        taskCalendarExceptions
      );

      validateFinishConstraints(task, earliestFinish, taskCalendar, taskCalendarExceptions, validationIssues);
      validateProjectBounds(snapshot, task, earliestStart, earliestFinish, validationIssues);

      windows.set(task.id, {
        task,
        calendar: taskCalendar,
        calendarExceptions: taskCalendarExceptions,
        durationMinutes,
        authoredStart,
        dependencyStart,
        earliestStart,
        earliestFinish,
        latestStart: earliestStart,
        latestFinish: earliestFinish
      });
    } catch (error) {
      if (!isCalendarNoWorkingTimeError(error)) throw error;
      validationIssues.push({
        code: "calendar_has_no_working_time",
        severity: "error",
        message: "В календаре задачи нет доступного рабочего времени",
        entity: { type: "Task", id: task.id }
      });
    }
  }

  const projectFinishInstant = latestProjectFinish([...windows.values()]);
  if (projectFinishInstant) {
    const reverseOrder = [...orderedTaskIds].reverse();
    const successorsByPredecessor = groupSuccessors(snapshot);
    for (const taskId of reverseOrder) {
      const window = windows.get(taskId);
      if (!window) continue;
      let latestWindow = {
        latestStart: addWorkingMinutesToInstant(
          projectFinishInstant,
          -window.durationMinutes,
          window.calendar,
          window.calendarExceptions
        ),
        latestFinish: projectFinishInstant
      };

      for (const dependency of successorsByPredecessor.get(taskId) ?? []) {
        const successor = windows.get(dependency.successorTaskId);
        if (!successor) continue;
        const candidate = getPredecessorLatestWindow({
          dependencyType: dependency.type,
          lagMinutes: dependency.lagMinutes,
          predecessorDurationMinutes: window.durationMinutes,
          successorLatestStart: successor.latestStart,
          successorLatestFinish: successor.latestFinish,
          calendar: window.calendar,
          calendarExceptions: window.calendarExceptions
        });
        latestWindow = minLatestWindow(latestWindow, candidate);
      }

      window.latestStart = latestWindow.latestStart;
      window.latestFinish = latestWindow.latestFinish;
    }
  }

  const calculatedTasks = snapshot.tasks
    .map((task) => toCalculatedTask(task, windows.get(task.id)))
    .sort(compareTasksForStableOutput);
  const criticalPathTaskIds = calculatedTasks
    .filter((task) => task.isCritical)
    .map((task) => task.id);
  const cycleDependencyIds = new Set(cycles.flatMap((cycle) => cycle.dependencyIds));
  const calculatedDependencies: CalculatedDependency[] = snapshot.dependencies
    .map((dependency) => ({
      ...dependency,
      valid: !cycleDependencyIds.has(dependency.id),
      issueCodes: cycleDependencyIds.has(dependency.id) ? ["dependency_cycle_detected"] : []
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    tenantId: snapshot.tenantId,
    projectId: snapshot.projectId,
    planVersion: snapshot.planVersion,
    engineVersion: options.engineVersion,
    calculatedAt: options.calculatedAt,
    tasks: calculatedTasks,
    dependencies: calculatedDependencies,
    projectFinish: projectFinishInstant?.date ?? null,
    criticalPathTaskIds: cycleTaskIds.size > 0 ? [] : criticalPathTaskIds,
    criticalPath: { taskIds: cycleTaskIds.size > 0 ? [] : criticalPathTaskIds },
    scheduleTrace: calculatedTasks.map((task) =>
      toScheduleTraceEntry(task, windows.get(task.id), validationIssues)
    ),
    validationIssues
  };
}

function resolveDurationMinutes(
  task: PlanTask,
  assignments: PlanAssignment[],
  validationIssues: ValidationIssue[]
): number {
  const workAssignments = assignments.filter(
    (assignment) =>
      assignment.taskId === task.id &&
      (assignment.role === "executor" || assignment.role === "co_executor")
  );
  const unitsPermille = workAssignments.reduce(
    (total, assignment) => total + assignment.unitsPermille,
    0
  );

  if (task.workMinutes > 0 && workAssignments.length === 0) {
    validationIssues.push({
      code: "assignment_without_resource",
      severity: "warning",
      message: "У задачи есть трудоемкость, но нет исполнителя",
      entity: { type: "Task", id: task.id }
    });
  }

  if (task.workMinutes < 0 || (task.durationMinutes !== null && task.durationMinutes <= 0) || unitsPermille < 0) {
    validationIssues.push({
      code: "invalid_work_model",
      severity: "error",
      message: "Некорректная модель Work/Duration/Units",
      entity: { type: "Task", id: task.id }
    });
  }

  if (unitsPermille > 0 && task.workMinutes > 0) {
    try {
      return recalculateWorkModel({
        taskType: task.taskType,
        effortDriven: task.effortDriven,
        workMinutes: task.workMinutes,
        durationMinutes: task.durationMinutes ?? Math.max(1, task.workMinutes),
        unitsPermille,
        changedField: "workMinutes"
      }).durationMinutes;
    } catch {
      validationIssues.push({
        code: "invalid_work_model",
        severity: "error",
        message: "Некорректная модель Work/Duration/Units",
        entity: { type: "Task", id: task.id }
      });
    }
  }

  return Math.max(1, task.durationMinutes ?? task.workMinutes);
}

function resolveAuthoredStart(
  task: PlanTask,
  snapshot: PlanSnapshot,
  calendar: PlanCalendar,
  exceptions: PlanSnapshot["calendarExceptions"]
): WorkingInstant {
  if (task.plannedStartInstant) return task.plannedStartInstant;
  return startOfWorkingDate(task.plannedStart ?? snapshot.project.plannedStart, calendar, exceptions);
}

function resolveDependencyStart(
  task: PlanTask,
  durationMinutes: number,
  snapshot: PlanSnapshot,
  windows: Map<string, ScheduleWindow>,
  calendar: PlanCalendar,
  exceptions: PlanSnapshot["calendarExceptions"]
): WorkingInstant | null {
  let candidate: WorkingInstant | null = null;
  for (const dependency of snapshot.dependencies.filter((item) => item.successorTaskId === task.id)) {
    const predecessor = windows.get(dependency.predecessorTaskId);
    if (!predecessor) continue;
    const dependencyStart = getSuccessorStartCandidate({
      dependencyType: dependency.type,
      lagMinutes: dependency.lagMinutes,
      predecessorStart: predecessor.earliestStart,
      predecessorFinish: predecessor.earliestFinish,
      successorDurationMinutes: durationMinutes,
      calendar,
      calendarExceptions: exceptions
    });
    candidate = candidate ? maxWorkingInstant(candidate, dependencyStart) : dependencyStart;
  }
  return candidate;
}

function applyStartConstraint(
  task: PlanTask,
  start: WorkingInstant,
  dependencyStart: WorkingInstant | null,
  calendar: PlanCalendar,
  exceptions: PlanSnapshot["calendarExceptions"],
  validationIssues: ValidationIssue[]
): WorkingInstant {
  if (!task.constraint?.date || task.constraint.type === "as_soon_as_possible") return start;
  const constrainedStart = startOfWorkingDate(task.constraint.date, calendar, exceptions);
  if (task.constraint.type === "must_start_on") {
    if (dependencyStart && compareWorkingInstants(dependencyStart, constrainedStart) > 0) {
      validationIssues.push({
        code: "constraint_impossible",
        severity: "error",
        message: "Задача не может начаться в обязательную дату из-за зависимостей",
        entity: { type: "Task", id: task.id }
      });
    }
    return constrainedStart;
  }
  if (task.constraint.type === "start_no_earlier_than") {
    return maxWorkingInstant(start, constrainedStart);
  }
  return start;
}

function validateFinishConstraints(
  task: PlanTask,
  finish: WorkingInstant,
  calendar: PlanCalendar,
  exceptions: PlanSnapshot["calendarExceptions"],
  validationIssues: ValidationIssue[]
): void {
  if (!task.constraint?.date) return;
  if (task.constraint.type === "finish_no_later_than") {
    const latestFinish = endOfWorkingDate(task.constraint.date, calendar, exceptions);
    if (compareWorkingInstants(finish, latestFinish) > 0) {
      validationIssues.push({
        code: "constraint_impossible",
        severity: "error",
        message: "Задача завершается позже ограничения",
        entity: { type: "Task", id: task.id }
      });
    }
  }
  if (task.constraint.type === "must_finish_on" && finish.date !== task.constraint.date) {
    validationIssues.push({
      code: "constraint_impossible",
      severity: "error",
      message: "Задача не может завершиться в обязательную дату",
      entity: { type: "Task", id: task.id }
    });
  }
}

function validateProjectBounds(
  snapshot: PlanSnapshot,
  task: PlanTask,
  start: WorkingInstant,
  finish: WorkingInstant,
  validationIssues: ValidationIssue[]
): void {
  if (
    comparePlanDates(start.date, snapshot.project.plannedStart) < 0 ||
    comparePlanDates(finish.date, snapshot.project.plannedFinish) > 0
  ) {
    validationIssues.push({
      code: "schedule_outside_project_bounds",
      severity: "warning",
      message: "Расчетные даты задачи выходят за границы проекта",
      entity: { type: "Task", id: task.id }
    });
  }
}

function latestProjectFinish(windows: ScheduleWindow[]): WorkingInstant | null {
  return windows.reduce<WorkingInstant | null>((latest, window) => {
    if (!latest) return window.earliestFinish;
    return maxWorkingInstant(latest, window.earliestFinish);
  }, null);
}

function groupSuccessors(snapshot: PlanSnapshot): Map<string, PlanSnapshot["dependencies"]> {
  const grouped = new Map<string, PlanSnapshot["dependencies"]>();
  for (const dependency of snapshot.dependencies) {
    grouped.set(dependency.predecessorTaskId, [
      ...(grouped.get(dependency.predecessorTaskId) ?? []),
      dependency
    ]);
  }
  return grouped;
}

function toCalculatedTask(
  task: PlanTask,
  window: ScheduleWindow | undefined
): CalculatedTask {
  if (!window) {
    return {
      ...task,
      calculatedStart: null,
      calculatedFinish: null,
      calculatedStartInstant: null,
      calculatedFinishInstant: null,
      earliestStart: null,
      earliestFinish: null,
      earliestStartInstant: null,
      earliestFinishInstant: null,
      latestStart: null,
      latestFinish: null,
      latestStartInstant: null,
      latestFinishInstant: null,
      totalSlackMinutes: null,
      isCritical: false
    };
  }

  const totalSlackMinutes = diffWorkingMinutes(
    window.earliestStart,
    window.latestStart,
    window.calendar,
    window.calendarExceptions
  );
  return {
    ...task,
    durationMinutes: window.durationMinutes,
    calculatedStart: window.earliestStart.date,
    calculatedFinish: window.earliestFinish.date,
    calculatedStartInstant: window.earliestStart,
    calculatedFinishInstant: window.earliestFinish,
    earliestStart: window.earliestStart.date,
    earliestFinish: window.earliestFinish.date,
    earliestStartInstant: window.earliestStart,
    earliestFinishInstant: window.earliestFinish,
    latestStart: window.latestStart.date,
    latestFinish: window.latestFinish.date,
    latestStartInstant: window.latestStart,
    latestFinishInstant: window.latestFinish,
    totalSlackMinutes,
    isCritical: totalSlackMinutes === 0
  };
}

function selectProjectCalendar(snapshot: PlanSnapshot): PlanCalendar {
  return (
    snapshot.calendars.find((calendar) => calendar.id === snapshot.project.calendarId) ??
    snapshot.calendars[0] ??
    defaultCalendar
  );
}

function selectTaskCalendar(snapshot: PlanSnapshot, task: PlanTask): PlanCalendar {
  return (
    snapshot.calendars.find((calendar) => calendar.id === task.calendarId) ??
    selectProjectCalendar(snapshot)
  );
}

function selectTaskCalendarExceptions(
  snapshot: PlanSnapshot,
  calendar: PlanCalendar
): PlanSnapshot["calendarExceptions"] {
  return snapshot.calendarExceptions.filter(
    (exception) =>
      exception.calendarId === calendar.id &&
      exception.resourceId === null
  );
}

function compareTasksForStableOutput(left: CalculatedTask, right: CalculatedTask): number {
  return left.wbsCode.localeCompare(right.wbsCode, undefined, { numeric: true });
}

function toScheduleTraceEntry(
  task: CalculatedTask,
  window: ScheduleWindow | undefined,
  validationIssues: ValidationIssue[]
): ScheduleTraceEntry {
  return {
    taskId: task.id,
    calendarId: window?.calendar.id ?? task.calendarId ?? "default-calendar",
    authoredStart: window?.authoredStart ?? task.plannedStartInstant ?? null,
    dependencyStart: window?.dependencyStart ?? null,
    earliestStart: task.earliestStartInstant,
    earliestFinish: task.earliestFinishInstant,
    latestStart: task.latestStartInstant,
    latestFinish: task.latestFinishInstant,
    durationMinutes: task.durationMinutes,
    appliedConstraintType: task.constraint?.type ?? null,
    issueCodes: validationIssues
      .filter((issue) => issue.entity?.type === "Task" && issue.entity.id === task.id)
      .map((issue) => issue.code)
  };
}

function isCalendarNoWorkingTimeError(error: unknown): boolean {
  return error instanceof Error && error.message === "calendar_has_no_working_time";
}
