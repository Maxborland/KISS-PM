import {
  buildBaselineComparison,
  buildResourceLoadMatrix,
  calculatePlan,
  comparePlanDates,
  type PlanningReadModel,
  type PlanSnapshot
} from "@kiss-pm/domain";

import { PLANNING_ENGINE_VERSION } from "./planningConstants";

export type PlanningReadModelOptions = {
  // Доступ к ресурсным исключениям календаря (персональные отсутствия resourceId!=null).
  // false → план-ридер без права на ресурсы; отдаём только общепроектные праздники.
  includeResourceExceptions?: boolean;
};

export function createPlanningReadModel(
  snapshot: PlanSnapshot,
  options: PlanningReadModelOptions = {}
): PlanningReadModel {
  // Fail-closed: по умолчанию НЕ раскрываем персональные ресурсные исключения (чужие отсутствия).
  // Актор-фейсинг роуты (read-model/preview/apply) передают флаг по фактическому праву на ресурсы;
  // матрица загрузки ниже всё равно считается по полному snapshot.calendarExceptions (ёмкость не зависит от права).
  const includeResourceExceptions = options.includeResourceExceptions ?? false;
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
    baselineComparison: buildBaselineComparison(snapshot, calculatedPlan),
    resourceLoad,
    // Производственный календарь(и) проекта + исключения (праздники resourceId=null / отсутствия).
    // Поверхности Календари/Настройки читают их top-level — раньше отдавал только mock,
    // теперь и боевой read-model (инвариант «смена apiOrigin без правок UI»).
    calendars: snapshot.calendars,
    // Ресурсные исключения (resourceId!=null) — персональные отсутствия (date+reason).
    // План-ридеру без права на ресурсы отдаём только общепроектные записи (resourceId=null),
    // чтобы не раскрывать чужие отсутствия. Матрица загрузки выше считается по полному
    // snapshot.calendarExceptions (ёмкость нужна независимо от права на чтение).
    calendarExceptions: includeResourceExceptions
      ? snapshot.calendarExceptions
      : snapshot.calendarExceptions.filter((exception) => exception.resourceId === null),
    validationIssues: calculatedPlan.validationIssues,
    planVersion: snapshot.planVersion,
    engineVersion: PLANNING_ENGINE_VERSION
  };
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
