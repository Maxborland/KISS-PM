import type {
  CalculatedPlan,
  PlanBaseline,
  PlanDependency,
  PlanProject,
  PlanTask,
  ResourceLoadMatrix,
  ValidationIssue
} from "@kiss-pm/domain";
import type {
  PlanningGanttBaselineRow,
  PlanningGanttDependencyRow,
  PlanningGanttResourceLoadBucket,
  PlanningGanttTaskRow,
  PlanningGanttValidationIssue,
  PlanningGanttViewModel
} from "@kiss-pm/planning-gantt-ui";

export type PlanningReadModel = {
  project: PlanProject;
  authored: {
    tasks: PlanTask[];
    dependencies: PlanDependency[];
    assignments: unknown[];
    baselines: PlanBaseline[];
  };
  calculatedPlan: CalculatedPlan;
  baselineComparison: {
    baselineId: string | null;
    capturedAt: string | null;
    tasks: Array<{
      taskId: string;
      baselineStart: string | null;
      baselineFinish: string | null;
      baselineWorkMinutes: number | null;
      currentStart: string | null;
      currentFinish: string | null;
      currentWorkMinutes: number | null;
      startDeltaDays: number | null;
      finishDeltaDays: number | null;
      workDeltaMinutes: number | null;
    }>;
  };
  resourceLoad: ResourceLoadMatrix;
  validationIssues: ValidationIssue[];
  planVersion: number;
  engineVersion: string;
};

export function mapPlanningReadModelToGanttViewModel(
  readModel: PlanningReadModel
): PlanningGanttViewModel {
  const calculatedTasksById = new Map(
    readModel.calculatedPlan.tasks.map((task) => [task.id, task])
  );
  const baselineByTaskId = new Map(
    readModel.baselineComparison.tasks.map((task) => [task.taskId, task])
  );
  const childCountsByParentId = new Map<string, number>();
  for (const task of readModel.authored.tasks) {
    if (task.parentTaskId === null) continue;
    childCountsByParentId.set(
      task.parentTaskId,
      (childCountsByParentId.get(task.parentTaskId) ?? 0) + 1
    );
  }
  const issueIdsByTaskId = mapValidationIssueIdsByTaskId(readModel.validationIssues);
  const overloadMinutesByBucket = mapOverloadMinutesByBucket(readModel.resourceLoad.overloads);

  return {
    project: {
      id: readModel.project.id,
      plannedStart: readModel.project.plannedStart,
      plannedFinish: readModel.project.plannedFinish,
      deadline: readModel.project.deadline,
      calendarId: readModel.project.calendarId
    },
    tasks: readModel.authored.tasks.map<PlanningGanttTaskRow>((task) => {
      const calculatedTask = calculatedTasksById.get(task.id);
      const baselineTask = baselineByTaskId.get(task.id);

      return {
        id: task.id,
        parentTaskId: task.parentTaskId,
        wbsCode: task.wbsCode,
        title: task.title,
        statusId: task.statusId,
        schedulingMode: task.schedulingMode,
        taskType: task.taskType,
        effortDriven: task.effortDriven,
        plannedStart: calculatedTask?.calculatedStart ?? task.plannedStart,
        plannedFinish: calculatedTask?.calculatedFinish ?? task.plannedFinish,
        durationMinutes: task.durationMinutes,
        workMinutes: calculatedTask?.workMinutes ?? task.workMinutes,
        percentComplete: task.percentComplete,
        baselineStart: baselineTask?.baselineStart ?? null,
        baselineFinish: baselineTask?.baselineFinish ?? null,
        baselineWorkMinutes: baselineTask?.baselineWorkMinutes ?? null,
        startVarianceDays: baselineTask?.startDeltaDays ?? null,
        finishVarianceDays: baselineTask?.finishDeltaDays ?? null,
        workVarianceMinutes: baselineTask?.workDeltaMinutes ?? null,
        isSummary: (childCountsByParentId.get(task.id) ?? 0) > 0,
        isMilestone: task.workMinutes === 0 && task.plannedStart !== null && task.plannedStart === task.plannedFinish,
        isCritical: calculatedTask?.isCritical ?? false,
        slackMinutes: calculatedTask?.totalSlackMinutes ?? null,
        validationIssueIds: issueIdsByTaskId.get(task.id) ?? []
      };
    }),
    dependencies: readModel.calculatedPlan.dependencies.map<PlanningGanttDependencyRow>((dependency) => ({
      id: dependency.id,
      predecessorTaskId: dependency.predecessorTaskId,
      successorTaskId: dependency.successorTaskId,
      type: dependency.type,
      lagMinutes: dependency.lagMinutes,
      valid: dependency.valid,
      issueCodes: dependency.issueCodes
    })),
    baselines: readModel.authored.baselines.flatMap<PlanningGanttBaselineRow>((baseline) =>
      baseline.tasks.map((task) => ({
        baselineId: baseline.id,
        capturedAt: baseline.capturedAt,
        taskId: task.taskId,
        plannedStart: task.plannedStart,
        plannedFinish: task.plannedFinish,
        workMinutes: task.workMinutes
      }))
    ),
    validationIssues: readModel.validationIssues.map<PlanningGanttValidationIssue>((issue, index) => ({
      id: validationIssueId(issue, index),
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      entity: issue.entity
    })),
    resourceLoadBuckets: readModel.resourceLoad.buckets.map<PlanningGanttResourceLoadBucket>((bucket) => ({
      id: `${bucket.resourceId}:${bucket.granularity}:${bucket.date}`,
      resourceId: bucket.resourceId,
      resourceName: bucket.resourceId,
      bucketStart: bucket.date,
      bucketFinish: bucket.date,
      granularity: bucket.granularity,
      plannedMinutes: bucket.assignedMinutes,
      availableMinutes: bucket.capacityMinutes,
      reservedMinutes: bucket.reservedMinutes,
      freeMinutes: bucket.freeMinutes,
      overloadMinutes: overloadMinutesByBucket.get(resourceBucketKey(bucket.resourceId, bucket.granularity, bucket.date)) ?? 0,
      taskIds: bucket.taskIds
    })),
    planVersion: readModel.planVersion,
    engineVersion: readModel.engineVersion
  };
}

function mapValidationIssueIdsByTaskId(
  validationIssues: readonly ValidationIssue[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  validationIssues.forEach((issue, index) => {
    if (issue.entity?.type.toLowerCase() !== "task") return;
    result.set(issue.entity.id, [
      ...(result.get(issue.entity.id) ?? []),
      validationIssueId(issue, index)
    ]);
  });
  return result;
}

function validationIssueId(issue: ValidationIssue, index: number): string {
  return `${issue.code}:${issue.entity?.type ?? "plan"}:${issue.entity?.id ?? "global"}:${index}`;
}

function mapOverloadMinutesByBucket(
  overloads: ResourceLoadMatrix["overloads"]
): Map<string, number> {
  return new Map(
    overloads.map((overload) => [
      resourceBucketKey(overload.resourceId, overload.granularity, overload.date),
      overload.overloadMinutes
    ])
  );
}

function resourceBucketKey(
  resourceId: string,
  granularity: ResourceLoadMatrix["buckets"][number]["granularity"],
  date: string
): string {
  return `${resourceId}:${granularity}:${date}`;
}
