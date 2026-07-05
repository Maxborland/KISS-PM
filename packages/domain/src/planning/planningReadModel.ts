import { diffCalendarDays } from "./calendar";
import type { ResourceLoadMatrix } from "./resourcePlanning";
import type {
  CalculatedPlan,
  PlanAssignment,
  PlanAssignmentAllocation,
  PlanBaseline,
  PlanCalendar,
  PlanCalendarException,
  PlanDate,
  PlanDateTime,
  PlanDependency,
  PlanProject,
  PlanSnapshot,
  PlanTask,
  ValidationIssue
} from "./types";

/** Дельты одной задачи: baseline ↔ текущий расчёт. */
export type BaselineComparisonTask = {
  taskId: string;
  baselineStart: PlanDate | null;
  baselineFinish: PlanDate | null;
  baselineWorkMinutes: number;
  currentStart: PlanDate | null;
  currentFinish: PlanDate | null;
  currentWorkMinutes: number | null;
  startDeltaDays: number | null;
  finishDeltaDays: number | null;
  workDeltaMinutes: number | null;
};

export type BaselineComparison = {
  baselineId: string | null;
  capturedAt: PlanDateTime | null;
  tasks: BaselineComparisonTask[];
};

/**
 * Единый типизированный контракт read-model плана — то, что ПРОИЗВОДЯТ боевой api
 * (createPlanningReadModel) и web-мок, и что ПОТРЕБЛЯЮТ все delivery-поверхности через planning-client.
 * Раньше planning-client типизировал каждое поле как Record<string,unknown>, а web восстанавливал форму
 * через `as unknown as {…}` (40+ мест, 9 surface); переименование поля проекции падало молча в рантайме.
 * Теперь это одна доменная форма: дрейф проекции = ошибка компиляции у потребителей.
 */
export type PlanningReadModel = {
  project: PlanProject;
  authored: {
    tasks: PlanTask[];
    dependencies: PlanDependency[];
    assignments: PlanAssignment[];
    assignmentAllocations: PlanAssignmentAllocation[];
    baselines: PlanBaseline[];
  };
  calculatedPlan: CalculatedPlan;
  baselineComparison: BaselineComparison;
  resourceLoad: ResourceLoadMatrix;
  calendars: PlanCalendar[];
  calendarExceptions: PlanCalendarException[];
  validationIssues: ValidationIssue[];
  planVersion: number;
  engineVersion: string;
};

function dateDeltaDays(baselineDate: PlanDate | null, currentDate: PlanDate | null): number | null {
  if (!baselineDate || !currentDate) return null;
  return diffCalendarDays(baselineDate, currentDate);
}

/**
 * Сравнение с последним baseline: join baseline.tasks ↔ calculatedPlan + дельты start/finish/work.
 * Живёт в домене (владельце PlanBaseline и CalculatedTask), чтобы api-проекция и web-мок не деривили
 * её раздельно (раньше это была чистая доменная логика, застрявшая в транспортном слое api).
 */
export function buildBaselineComparison(
  snapshot: PlanSnapshot,
  calculatedPlan: CalculatedPlan
): BaselineComparison {
  const baseline = [...snapshot.baselines].sort(
    (left, right) =>
      right.capturedAt.localeCompare(left.capturedAt) || right.id.localeCompare(left.id)
  )[0];
  if (!baseline) {
    return { baselineId: null, capturedAt: null, tasks: [] };
  }

  const calculatedTasksById = new Map(calculatedPlan.tasks.map((task) => [task.id, task]));
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
    })
  };
}
