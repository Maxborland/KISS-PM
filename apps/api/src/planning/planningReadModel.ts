import {
  buildResourceLoadMatrix,
  calculatePlan,
  comparePlanDates,
  resolveEffectiveAssignmentWork,
  diffCalendarDays,
  type PlanSnapshot
} from "@kiss-pm/domain";

import { PLANNING_ENGINE_VERSION } from "./planningConstants";

export function createPlanningReadModel(snapshot: PlanSnapshot) {
  const calculatedPlan = calculatePlan(snapshot, {
    calculatedAt: snapshot.capturedAt,
    engineVersion: PLANNING_ENGINE_VERSION
  });
  const resourceLoad = buildResourceLoadMatrix({
    plan: calculatedPlan,
    resources: snapshot.resources,
    assignments: snapshot.assignments,
    assignmentAllocations: snapshot.assignmentAllocations,
    calendars: snapshot.calendars,
    calendarExceptions: snapshot.calendarExceptions,
    reservations: snapshot.reservations,
    occupancyWindows: snapshot.occupancyWindows,
    rangeStart: snapshot.project.plannedStart,
    rangeFinish: latestDate([
      calculatedPlan.projectFinish,
      snapshot.project.plannedFinish,
      snapshot.project.deadline
    ])
  });

  return {
    project: snapshot.project,
    authored: {
      tasks: snapshot.tasks,
      dependencies: snapshot.dependencies,
      assignments: snapshot.assignments,
      assignmentAllocations: snapshot.assignmentAllocations ?? [],
      baselines: snapshot.baselines
    },
    calculatedPlan,
    baselineComparison: createBaselineComparison(snapshot, calculatedPlan),
    resourceLoad,
    validationIssues: calculatedPlan.validationIssues,
    planVersion: snapshot.planVersion,
    engineVersion: PLANNING_ENGINE_VERSION
  };
}

export function createBaselineComparison(
  snapshot: PlanSnapshot,
  calculatedPlan: ReturnType<typeof calculatePlan>
) {
  const baseline = [...snapshot.baselines].sort((left, right) =>
    right.capturedAt.localeCompare(left.capturedAt) || right.id.localeCompare(left.id)
  )[0];
  if (!baseline) {
    return {
      baselineId: null,
      capturedAt: null,
      tasks: [],
      assignments: [],
      resources: []
    };
  }

  const calculatedTasksById = new Map(calculatedPlan.tasks.map((task) => [task.id, task]));
  const baselineTasksById = new Map(baseline.tasks.map((task) => [task.taskId, task]));
  return {
    baselineId: baseline.id,
    capturedAt: baseline.capturedAt,
    tasks: baseline.tasks.map((baselineTask) => {
      const current = calculatedTasksById.get(baselineTask.taskId);
      const currentStart = current?.calculatedStart ?? null;
      const currentFinish = current?.calculatedFinish ?? null;
      const currentWorkMinutes = current?.workMinutes ?? null;
      return {
        taskId: baselineTask.taskId,
        baselineStart: baselineTask.plannedStart,
        baselineFinish: baselineTask.plannedFinish,
        baselineWorkMinutes: baselineTask.workMinutes,
        currentStart,
        currentFinish,
        currentWorkMinutes,
        startDeltaDays: dateDeltaDays(baselineTask.plannedStart, currentStart),
        finishDeltaDays: dateDeltaDays(baselineTask.plannedFinish, currentFinish),
        workDeltaMinutes:
          currentWorkMinutes === null ? null : currentWorkMinutes - baselineTask.workMinutes
      };
    }),
    assignments: createBaselineAssignmentComparison(baseline.assignments, snapshot.assignments),
    resources: createBaselineResourceComparison(
      baseline.assignments,
      snapshot.assignments,
      baselineTasksById,
      calculatedTasksById
    )
  };
}

export function dateDeltaDays(baselineDate: string | null, currentDate: string | null): number | null {
  if (!baselineDate || !currentDate) return null;
  return diffCalendarDays(baselineDate, currentDate);
}

function latestDate(dates: Array<string | null>): string {
  const latest = dates.reduce<string | null>((currentLatest, date) => {
    if (!date) return currentLatest;
    if (!currentLatest) return date;
    return comparePlanDates(date, currentLatest) > 0 ? date : currentLatest;
  }, null);
  if (!latest) throw new Error("planning_read_model_missing_range_finish");
  return latest;
}


type BaselineAssignmentSnapshot = PlanSnapshot["baselines"][number]["assignments"][number];
type CurrentAssignmentSnapshot = PlanSnapshot["assignments"][number];
type BaselineComparisonStatus = "added" | "removed" | "changed" | "unchanged";

function createBaselineAssignmentComparison(
  baselineAssignments: BaselineAssignmentSnapshot[],
  currentAssignments: CurrentAssignmentSnapshot[]
) {
  const baselineById = new Map(baselineAssignments.map((assignment) => [assignment.assignmentId, assignment]));
  const currentById = new Map(currentAssignments.map((assignment) => [assignment.id, assignment]));
  return [...new Set([...baselineById.keys(), ...currentById.keys()])]
    .sort()
    .map((assignmentId) => {
      const baseline = baselineById.get(assignmentId) ?? null;
      const current = currentById.get(assignmentId) ?? null;
      return {
        assignmentId,
        status: assignmentComparisonStatus(baseline, current),
        baselineTaskId: baseline?.taskId ?? null,
        currentTaskId: current?.taskId ?? null,
        baselineResourceId: baseline?.resourceId ?? null,
        currentResourceId: current?.resourceId ?? null,
        baselineWorkMinutes: baseline?.workMinutes ?? null,
        currentWorkMinutes: current?.workMinutes ?? null,
        workDeltaMinutes: workDeltaMinutes(baseline?.workMinutes ?? null, current?.workMinutes ?? null)
      };
    });
}

function createBaselineResourceComparison(
  baselineAssignments: BaselineAssignmentSnapshot[],
  currentAssignments: CurrentAssignmentSnapshot[],
  baselineTasksById: Map<string, PlanSnapshot["baselines"][number]["tasks"][number]>,
  calculatedTasksById: Map<string, ReturnType<typeof calculatePlan>["tasks"][number]>
) {
  const baselineWorkByResource = aggregateWorkByResource(
    baselineAssignments.map((assignment) => ({
      resourceId: assignment.resourceId,
      workMinutes: resolveBaselineAssignmentWork(
        assignment,
        baselineAssignments,
        baselineTasksById.get(assignment.taskId)?.workMinutes ?? 0
      )
    }))
  );
  const currentWorkByResource = aggregateWorkByResource(
    currentAssignments.map((assignment) => ({
      resourceId: assignment.resourceId,
      workMinutes: resolveEffectiveAssignmentWork(
        currentAssignments,
        assignment,
        calculatedTasksById.get(assignment.taskId)?.workMinutes ?? 0
      )
    }))
  );
  return [...new Set([...baselineWorkByResource.keys(), ...currentWorkByResource.keys()])]
    .sort()
    .map((resourceId) => {
      const baselineWorkMinutes = baselineWorkByResource.has(resourceId) ? baselineWorkByResource.get(resourceId)! : 0;
      const currentWorkMinutes = currentWorkByResource.has(resourceId) ? currentWorkByResource.get(resourceId)! : 0;
      return {
        resourceId,
        status: workComparisonStatus(baselineWorkMinutes, currentWorkMinutes),
        baselineWorkMinutes,
        currentWorkMinutes,
        workDeltaMinutes: workDeltaMinutes(baselineWorkMinutes, currentWorkMinutes)
      };
    });
}

function assignmentComparisonStatus(
  baseline: BaselineAssignmentSnapshot | null,
  current: CurrentAssignmentSnapshot | null
): BaselineComparisonStatus {
  if (!baseline) return "added";
  if (!current) return "removed";
  if (
    baseline.taskId !== current.taskId ||
    baseline.resourceId !== current.resourceId ||
    baseline.workMinutes !== current.workMinutes
  ) {
    return "changed";
  }
  return "unchanged";
}

function workComparisonStatus(
  baselineWorkMinutes: number | null,
  currentWorkMinutes: number | null
): BaselineComparisonStatus {
  if (baselineWorkMinutes === 0 && currentWorkMinutes !== 0) return "added";
  if (baselineWorkMinutes !== 0 && currentWorkMinutes === 0) return "removed";
  return baselineWorkMinutes === currentWorkMinutes ? "unchanged" : "changed";
}

function resolveBaselineAssignmentWork(
  assignment: BaselineAssignmentSnapshot,
  baselineAssignments: BaselineAssignmentSnapshot[],
  baselineTaskWorkMinutes: number
): number {
  if (assignment.workMinutes !== null) return assignment.workMinutes;

  const baselineTaskAssignments = baselineAssignments
    .filter((candidate) => candidate.taskId === assignment.taskId)
    .map((candidate) => ({
      id: candidate.assignmentId,
      taskId: candidate.taskId,
      resourceId: candidate.resourceId,
      role: "executor" as const,
      unitsPermille: 1000,
      workMinutes: candidate.workMinutes,
      calendarId: null
    }));
  const baselineAssignment = baselineTaskAssignments.find((candidate) => candidate.id === assignment.assignmentId);
  if (!baselineAssignment) return baselineTaskWorkMinutes;

  return resolveEffectiveAssignmentWork(
    baselineTaskAssignments,
    baselineAssignment,
    baselineTaskWorkMinutes
  );
}

function aggregateWorkByResource(assignments: Array<{ resourceId: string; workMinutes: number }>) {
  const workByResource = new Map<string, number>();
  for (const assignment of assignments) {
    const existing = workByResource.has(assignment.resourceId) ? workByResource.get(assignment.resourceId)! : 0;
    workByResource.set(
      assignment.resourceId,
      existing + assignment.workMinutes
    );
  }
  return workByResource;
}

function workDeltaMinutes(
  baselineWorkMinutes: number | null,
  currentWorkMinutes: number | null
): number | null {
  if (baselineWorkMinutes === null || currentWorkMinutes === null) return null;
  return currentWorkMinutes - baselineWorkMinutes;
}
