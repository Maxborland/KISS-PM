import type { PlanningReadModel } from "@kiss-pm/planning-client";

type JsonRecord = Record<string, unknown>;

export function readCalculatedTasks(readModel: PlanningReadModel | undefined): JsonRecord[] {
  if (!readModel) return [];
  const tasks = readModel.calculatedPlan.tasks;
  return Array.isArray(tasks) ? (tasks as JsonRecord[]) : [];
}

export function readResourceOverloads(readModel: PlanningReadModel | undefined): JsonRecord[] {
  if (!readModel) return [];
  const overloads = readModel.resourceLoad.overloads;
  return Array.isArray(overloads) ? (overloads as JsonRecord[]) : [];
}

export function readProjectPlannedStart(readModel: PlanningReadModel | undefined): string | undefined {
  const value = readModel?.project.plannedStart;
  return typeof value === "string" ? value : undefined;
}

export function readProjectPlannedFinish(readModel: PlanningReadModel | undefined): string | undefined {
  const value = readModel?.project.plannedFinish;
  return typeof value === "string" ? value : undefined;
}

export function readCalculatedProjectFinish(readModel: PlanningReadModel | undefined): string | null {
  const finish = readModel?.calculatedPlan.projectFinish;
  return typeof finish === "string" ? finish : null;
}

export function readProjectCalendarId(readModel: PlanningReadModel | undefined): string | null {
  const value = readModel?.project.calendarId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readBaselineComparisonTasks(
  readModel: PlanningReadModel | undefined
): Array<{ taskId: string; finishDeltaDays: number | null }> {
  const tasks = readModel?.baselineComparison.tasks;
  if (!Array.isArray(tasks)) return [];
  return tasks.map((row) => {
    const record = row as JsonRecord;
    return {
      taskId: String(record.taskId ?? ""),
      finishDeltaDays: typeof record.finishDeltaDays === "number" ? record.finishDeltaDays : null
    };
  });
}

export function readAssignmentRole(assignment: JsonRecord): "executor" | "controller" {
  return assignment.role === "controller" ? "controller" : "executor";
}

export function readAssignmentWorkMinutes(assignment: JsonRecord): number | null {
  const value = assignment.workMinutes;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
