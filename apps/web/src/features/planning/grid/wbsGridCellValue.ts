import type { PlanningCommand } from "@kiss-pm/domain";
import { parseDurationOrWork } from "@kiss-pm/planning-client";

import type { WbsGridRow } from "./wbsRows";

export function getWbsCellTextValue(row: WbsGridRow, columnId: string): string {
  if (columnId === "title") return row.title;
  if (columnId === "durationLabel") return row.durationLabel;
  if (columnId === "finish") return row.finish ?? "";
  if (columnId === "percentComplete") return String(row.percentComplete);
  return "";
}

export function buildFillCommand(
  taskId: string,
  columnId: string,
  value: string,
  row: WbsGridRow
): PlanningCommand | null {
  if (columnId === "title") {
    return { type: "task.update_identity", payload: { taskId, title: value } };
  }
  if (columnId === "finish") {
    return {
      type: "task.update_schedule",
      payload: {
        taskId,
        plannedStart: (row.task.plannedStart as string | null) ?? null,
        plannedFinish: value || null
      }
    };
  }
  if (columnId === "percentComplete") {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return null;
    return { type: "task.update_progress", payload: { taskId, percentComplete: percent } };
  }
  return null;
}

export function buildPreviewCommandFromCell(
  row: WbsGridRow,
  columnId: string,
  value: string
): PlanningCommand | null {
  if (columnId === "title") {
    if (value === row.title) return null;
    return { type: "task.update_identity", payload: { taskId: row.id, title: value } };
  }
  if (columnId === "finish") {
    return {
      type: "task.update_schedule",
      payload: {
        taskId: row.id,
        plannedStart: (row.task.plannedStart as string | null) ?? null,
        plannedFinish: value || null
      }
    };
  }
  if (columnId === "percentComplete") {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return null;
    return { type: "task.update_progress", payload: { taskId: row.id, percentComplete: percent } };
  }
  if (columnId === "durationLabel") {
    const parsed = parseDurationOrWork(value, 8 * 60);
    if (!parsed.ok) return null;
    return {
      type: "task.update_work_model",
      payload: {
        taskId: row.id,
        taskType: String(row.task.taskType ?? "fixed_duration") as "fixed_duration",
        effortDriven: Boolean(row.task.effortDriven),
        durationMinutes: parsed.minutes,
        workMinutes: Number(row.task.workMinutes ?? parsed.minutes)
      }
    };
  }
  return null;
}

export function buildFillCommandsForRange(input: {
  rows: WbsGridRow[];
  startRowIndex: number;
  endRowIndex: number;
  columnId: string;
  values: string[];
}): PlanningCommand[] {
  const commands: PlanningCommand[] = [];
  const rowSpan = input.endRowIndex - input.startRowIndex;
  for (let offset = 1; offset <= input.values.length && offset <= rowSpan; offset += 1) {
    const row = input.rows[input.startRowIndex + offset];
    const value = input.values[offset - 1];
    if (!row || !value) continue;
    const command = buildFillCommand(row.id, input.columnId, value, row);
    if (command) commands.push(command);
  }
  return commands;
}
