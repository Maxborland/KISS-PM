import { addDays } from "./calendar";
import {
  addWorkingMinutesToInstant,
  minWorkingInstant,
  startOfWorkingDate,
  workingMinutesForDate
} from "./workingTime";
import type {
  DependencyType,
  PlanCalendar,
  PlanCalendarException,
  PlanDependency,
  WorkingInstant
} from "./types";

export type DependencyCycle = {
  taskIds: string[];
  dependencyIds: string[];
};

export function detectDependencyCycles(dependencies: PlanDependency[]): DependencyCycle[] {
  const outgoing = new Map<string, PlanDependency[]>();
  for (const dependency of dependencies) {
    const current = outgoing.get(dependency.predecessorTaskId) ?? [];
    current.push(dependency);
    outgoing.set(dependency.predecessorTaskId, current);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];
  const cycles: DependencyCycle[] = [];

  function visit(taskId: string): void {
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      const taskIds = path.slice(cycleStart);
      cycles.push({
        taskIds,
        dependencyIds: dependencies
          .filter(
            (dependency) =>
              taskIds.includes(dependency.predecessorTaskId) &&
              taskIds.includes(dependency.successorTaskId)
          )
          .map((dependency) => dependency.id)
      });
      return;
    }
    if (visited.has(taskId)) return;

    visiting.add(taskId);
    path.push(taskId);
    for (const dependency of outgoing.get(taskId) ?? []) {
      visit(dependency.successorTaskId);
    }
    path.pop();
    visiting.delete(taskId);
    visited.add(taskId);
  }

  const taskIds = new Set<string>();
  for (const dependency of dependencies) {
    taskIds.add(dependency.predecessorTaskId);
    taskIds.add(dependency.successorTaskId);
  }
  for (const taskId of taskIds) visit(taskId);

  return dedupeCycles(cycles);
}

export function getTopologicalTaskOrder(
  taskIds: string[],
  dependencies: PlanDependency[]
): string[] {
  const knownTaskIds = new Set(taskIds);
  const indegree = new Map<string, number>(taskIds.map((taskId) => [taskId, 0]));
  const outgoing = new Map<string, string[]>();

  for (const dependency of dependencies) {
    if (!knownTaskIds.has(dependency.predecessorTaskId) || !knownTaskIds.has(dependency.successorTaskId)) {
      continue;
    }
    indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
    outgoing.set(dependency.predecessorTaskId, [
      ...(outgoing.get(dependency.predecessorTaskId) ?? []),
      dependency.successorTaskId
    ]);
  }

  const queue = taskIds.filter((taskId) => (indegree.get(taskId) ?? 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    ordered.push(taskId);
    for (const successorId of outgoing.get(taskId) ?? []) {
      const nextIndegree = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, nextIndegree);
      if (nextIndegree === 0) queue.push(successorId);
    }
  }

  return ordered.length === taskIds.length ? ordered : taskIds;
}

export function getSuccessorStartCandidate(input: {
  dependencyType: DependencyType;
  lagMinutes: number;
  predecessorStart: WorkingInstant;
  predecessorFinish: WorkingInstant;
  successorDurationMinutes: number;
  calendar: PlanCalendar;
  calendarExceptions: PlanCalendarException[];
}): WorkingInstant {
  const laggedPredecessorStart = addWorkingMinutesToInstant(
    input.predecessorStart,
    input.lagMinutes,
    input.calendar,
    input.calendarExceptions
  );
  const laggedPredecessorFinish = addWorkingMinutesToInstant(
    input.predecessorFinish,
    input.lagMinutes,
    input.calendar,
    input.calendarExceptions
  );

  if (input.dependencyType === "FS") {
    return normalizeStartCandidate(laggedPredecessorFinish, input.calendar, input.calendarExceptions);
  }
  if (input.dependencyType === "SS") {
    return normalizeStartCandidate(laggedPredecessorStart, input.calendar, input.calendarExceptions);
  }
  if (input.dependencyType === "FF") {
    return normalizeStartCandidate(
      addWorkingMinutesToInstant(
        laggedPredecessorFinish,
        -input.successorDurationMinutes,
        input.calendar,
        input.calendarExceptions
      ),
      input.calendar,
      input.calendarExceptions
    );
  }

  return normalizeStartCandidate(
    addWorkingMinutesToInstant(
      laggedPredecessorStart,
      -input.successorDurationMinutes,
      input.calendar,
      input.calendarExceptions
    ),
    input.calendar,
    input.calendarExceptions
  );
}

export function getPredecessorLatestWindow(input: {
  dependencyType: DependencyType;
  lagMinutes: number;
  predecessorDurationMinutes: number;
  successorLatestStart: WorkingInstant;
  successorLatestFinish: WorkingInstant;
  calendar: PlanCalendar;
  calendarExceptions: PlanCalendarException[];
}): { latestStart: WorkingInstant; latestFinish: WorkingInstant } {
  if (input.dependencyType === "FS") {
    const latestFinish = addWorkingMinutesToInstant(
      input.successorLatestStart,
      -input.lagMinutes,
      input.calendar,
      input.calendarExceptions
    );
    return {
      latestFinish,
      latestStart: addWorkingMinutesToInstant(
        latestFinish,
        -input.predecessorDurationMinutes,
        input.calendar,
        input.calendarExceptions
      )
    };
  }

  if (input.dependencyType === "SS") {
    const latestStart = addWorkingMinutesToInstant(
      input.successorLatestStart,
      -input.lagMinutes,
      input.calendar,
      input.calendarExceptions
    );
    return {
      latestStart,
      latestFinish: addWorkingMinutesToInstant(
        latestStart,
        input.predecessorDurationMinutes,
        input.calendar,
        input.calendarExceptions
      )
    };
  }

  if (input.dependencyType === "FF") {
    const latestFinish = addWorkingMinutesToInstant(
      input.successorLatestFinish,
      -input.lagMinutes,
      input.calendar,
      input.calendarExceptions
    );
    return {
      latestFinish,
      latestStart: addWorkingMinutesToInstant(
        latestFinish,
        -input.predecessorDurationMinutes,
        input.calendar,
        input.calendarExceptions
      )
    };
  }

  const latestStart = addWorkingMinutesToInstant(
    input.successorLatestFinish,
    -input.lagMinutes,
    input.calendar,
    input.calendarExceptions
  );
  return {
    latestStart,
    latestFinish: addWorkingMinutesToInstant(
      latestStart,
      input.predecessorDurationMinutes,
      input.calendar,
      input.calendarExceptions
    )
  };
}

export function minLatestWindow(
  left: { latestStart: WorkingInstant; latestFinish: WorkingInstant },
  right: { latestStart: WorkingInstant; latestFinish: WorkingInstant }
): { latestStart: WorkingInstant; latestFinish: WorkingInstant } {
  return {
    latestStart: minWorkingInstant(left.latestStart, right.latestStart),
    latestFinish: minWorkingInstant(left.latestFinish, right.latestFinish)
  };
}

function dedupeCycles(cycles: DependencyCycle[]): DependencyCycle[] {
  const seen = new Set<string>();
  return cycles.filter((cycle) => {
    const key = [...cycle.taskIds].sort().join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeStartCandidate(
  instant: WorkingInstant,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant {
  const capacity = workingMinutesForDate(instant.date, calendar, exceptions);
  if (capacity > 0 && instant.minuteOfDay >= capacity) {
    return startOfWorkingDate(addDays(instant.date, 1), calendar, exceptions);
  }
  return startOfWorkingDate(instant.date, calendar, exceptions).minuteOfDay > instant.minuteOfDay
    ? startOfWorkingDate(instant.date, calendar, exceptions)
    : instant;
}
