import type { PlanSnapshot } from "./planning/types";

export type ClosureLessonCategory =
  | "schedule"
  | "scope"
  | "resource"
  | "quality"
  | "communication"
  | "commercial"
  | "process";

export type ClosureLessonImpact = "positive" | "negative" | "neutral";

export type RetrospectiveLesson = {
  id: string;
  tenantId: string;
  projectId: string;
  snapshotId: string;
  category: ClosureLessonCategory;
  title: string;
  body: string;
  impact: ClosureLessonImpact;
  createdByUserId: string;
  createdAt: string;
};

export type TemplateImprovementImpact = {
  plannedWorkDeltaMinutes: number;
  plannedDurationDeltaDays: number;
  confidence: "low" | "medium" | "high";
  sourceMetric: string;
};

export type TemplateImprovementActionStatus = "proposed" | "applied" | "rejected";

export type TemplateImprovementAction = {
  id: string;
  tenantId: string;
  projectId: string;
  snapshotId: string;
  templateId: string;
  status: TemplateImprovementActionStatus;
  title: string;
  description: string;
  impact: TemplateImprovementImpact;
  createdByUserId: string;
  appliedByUserId: string | null;
  createdAt: string;
  appliedAt: string | null;
  auditEventId: string | null;
};

export type ClosureFactTask = {
  id: string;
  actualWorkMinutes: number;
  progress: number;
  statusCategory: string;
};

export type ClosurePlanFactSummary = {
  planVersion: number;
  plannedStart: string;
  plannedFinish: string;
  actualStart: string | null;
  actualFinish: string | null;
  plannedWorkMinutes: number;
  actualWorkMinutes: number;
  workVarianceMinutes: number;
  scheduleVarianceDays: number;
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
  baselineId: string | null;
};

export type ProjectClosureSnapshot = {
  id: string;
  tenantId: string;
  projectId: string;
  projectStatusBefore: string;
  planVersion: number;
  snapshotPayload: Record<string, unknown>;
  planFactSummary: ClosurePlanFactSummary;
  closedByUserId: string;
  closedAt: string;
  closeReason: string;
  auditEventId: string | null;
};

export type RetrospectiveReadModel = {
  snapshot: ProjectClosureSnapshot | null;
  lessons: RetrospectiveLesson[];
  templateImprovementActions: TemplateImprovementAction[];
};

export function buildClosurePlanFactSummary(input: {
  snapshot: PlanSnapshot;
  factTasks: ClosureFactTask[];
}): ClosurePlanFactSummary {
  const factByTaskId = new Map(input.factTasks.map((task) => [task.id, task]));
  const plannedWorkMinutes = input.snapshot.tasks.reduce(
    (sum, task) => sum + task.workMinutes,
    0
  );
  const actualWorkMinutes = input.snapshot.tasks.reduce((sum, task) => {
    const fact = factByTaskId.get(task.id);
    if (fact) return sum + Math.max(0, fact.actualWorkMinutes);
    return sum + Math.round((task.workMinutes * task.percentComplete) / 100);
  }, 0);
  const completedTaskCount = input.snapshot.tasks.filter((task) => {
    const fact = factByTaskId.get(task.id);
    return fact?.statusCategory === "done" || (fact?.progress ?? task.percentComplete) >= 100;
  }).length;
  const actualFinish = latestTaskFinish(input.snapshot, factByTaskId);
  return {
    planVersion: input.snapshot.planVersion,
    plannedStart: input.snapshot.project.plannedStart,
    plannedFinish: input.snapshot.project.plannedFinish,
    actualStart: earliestTaskStart(input.snapshot),
    actualFinish,
    plannedWorkMinutes,
    actualWorkMinutes,
    workVarianceMinutes: actualWorkMinutes - plannedWorkMinutes,
    scheduleVarianceDays: actualFinish
      ? daysBetween(input.snapshot.project.plannedFinish, actualFinish)
      : 0,
    taskCount: input.snapshot.tasks.length,
    completedTaskCount,
    openTaskCount: input.snapshot.tasks.length - completedTaskCount,
    baselineId: input.snapshot.baselines.at(-1)?.id ?? null
  };
}

export function buildClosureSnapshotPayload(snapshot: PlanSnapshot): Record<string, unknown> {
  return {
    capturedAt: snapshot.capturedAt,
    project: snapshot.project,
    taskCount: snapshot.tasks.length,
    assignmentCount: snapshot.assignments.length,
    dependencyCount: snapshot.dependencies.length,
    baselineCount: snapshot.baselines.length,
    tasks: snapshot.tasks.map((task) => ({
      id: task.id,
      parentTaskId: task.parentTaskId,
      wbsCode: task.wbsCode,
      title: task.title,
      statusId: task.statusId,
      plannedStart: task.plannedStart,
      plannedFinish: task.plannedFinish,
      workMinutes: task.workMinutes,
      percentComplete: task.percentComplete
    })),
    assignments: snapshot.assignments,
    assignmentAllocations: snapshot.assignmentAllocations ?? [],
    dependencies: snapshot.dependencies,
    baselines: snapshot.baselines
  };
}

export function buildTemplateImprovementImpact(
  summary: ClosurePlanFactSummary
): TemplateImprovementImpact {
  return {
    plannedWorkDeltaMinutes: summary.workVarianceMinutes,
    plannedDurationDeltaDays: summary.scheduleVarianceDays,
    confidence:
      summary.completedTaskCount === summary.taskCount
        ? "high"
        : summary.completedTaskCount > 0
          ? "medium"
          : "low",
    sourceMetric: "closure_plan_fact"
  };
}

function earliestTaskStart(snapshot: PlanSnapshot): string | null {
  return snapshot.tasks
    .map((task) => task.plannedStart)
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => left.localeCompare(right))[0] ?? null;
}

function latestTaskFinish(
  snapshot: PlanSnapshot,
  factByTaskId: Map<string, ClosureFactTask>
): string | null {
  const finishedTasks = snapshot.tasks.filter((task) => {
    const fact = factByTaskId.get(task.id);
    return fact?.statusCategory === "done" || (fact?.progress ?? task.percentComplete) >= 100;
  });
  const source = finishedTasks.length > 0 ? finishedTasks : snapshot.tasks;
  return source
    .map((task) => task.plannedFinish)
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function daysBetween(start: string, finish: string): number {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const finishDate = new Date(`${finish}T00:00:00.000Z`);
  return Math.round((finishDate.getTime() - startDate.getTime()) / 86_400_000);
}
