import type { PlanningReadModel } from "@kiss-pm/planning-client";

import type { WbsGridRow } from "../grid/wbsRows";
import { readCalculatedTasks } from "../planningReadModelAccess";

export type GanttBarKind = "task" | "summary" | "milestone";

export type GanttBarModel = {
  taskId: string;
  rowIndex: number;
  title: string;
  kind: GanttBarKind;
  start: string | null;
  finish: string | null;
  isCritical: boolean;
  baselineFinish: string | null;
};

function readBaselineFinishByTaskId(readModel: PlanningReadModel | undefined): Map<string, string> {
  const map = new Map<string, string>();
  const comparison = readModel?.baselineComparison;
  if (!comparison || typeof comparison !== "object") return map;
  const tasks = (comparison as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return map;
  for (const item of tasks) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const taskId = typeof record.taskId === "string" ? record.taskId : "";
    const baselineFinish = typeof record.baselineFinish === "string" ? record.baselineFinish : "";
    if (taskId && baselineFinish) map.set(taskId, baselineFinish);
  }
  return map;
}

function childCountByParent(readModel: PlanningReadModel | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!readModel) return map;
  for (const task of readModel.authored.tasks) {
    const parentId = typeof task.parentTaskId === "string" ? task.parentTaskId : null;
    if (!parentId) continue;
    map.set(parentId, (map.get(parentId) ?? 0) + 1);
  }
  return map;
}

export function buildGanttBarModels(
  rows: WbsGridRow[],
  readModel: PlanningReadModel | undefined
): GanttBarModel[] {
  const children = childCountByParent(readModel);
  const calculatedById = new Map(
    readCalculatedTasks(readModel).map((task) => [String(task.id), task])
  );
  const baselineByTaskId = readBaselineFinishByTaskId(readModel);

  return rows.map((row, rowIndex) => {
    const calculated = calculatedById.get(row.id);
    const start = row.start;
    const finish = row.finish ?? row.start;
    const durationMinutes = Number(row.task.durationMinutes ?? calculated?.durationMinutes ?? 0);
    const hasChildren = (children.get(row.id) ?? 0) > 0;
    const kind: GanttBarKind =
      durationMinutes === 0 && start && finish && start === finish
        ? "milestone"
        : hasChildren
          ? "summary"
          : "task";
    const baselineFinish = baselineByTaskId.get(row.id) ?? null;
    return {
      taskId: row.id,
      rowIndex,
      title: row.title,
      kind,
      start,
      finish,
      isCritical: row.isCritical,
      baselineFinish
    };
  });
}
