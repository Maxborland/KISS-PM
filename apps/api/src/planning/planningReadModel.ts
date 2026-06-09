import {
  buildResourceLoadMatrix,
  calculatePlan,
  comparePlanDates,
  type PlanSnapshot
} from "@kiss-pm/domain";

import { createBaselineComparison } from "./planningBaselineComparison";
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

function latestDate(dates: Array<string | null>): string {
  const latest = dates.filter((date): date is string => Boolean(date)).reduce<string | null>(
    (currentLatest, date) =>
      !currentLatest || comparePlanDates(date, currentLatest) > 0 ? date : currentLatest,
    null
  );
  if (!latest) throw new Error("planning_read_model_date_range_missing");
  return latest;
}
