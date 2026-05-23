import type { PlanningCommand } from "@kiss-pm/domain";

import type { WbsGridRow } from "./wbsRows";

function readParentTaskId(row: WbsGridRow): string | null {
  const parentTaskId = row.task.parentTaskId;
  return typeof parentTaskId === "string" && parentTaskId.length > 0 ? parentTaskId : null;
}

function siblingRows(rows: WbsGridRow[], parentTaskId: string | null, excludeTaskId?: string) {
  return rows.filter((row) => readParentTaskId(row) === parentTaskId && row.id !== excludeTaskId);
}

function sortOrderAfterSibling(rows: WbsGridRow[], parentTaskId: string | null, afterTaskId: string) {
  const siblings = siblingRows(rows, parentTaskId);
  const afterIndex = siblings.findIndex((row) => row.id === afterTaskId);
  return afterIndex >= 0 ? afterIndex + 1 : siblings.length;
}

export function buildIndentMoveCommand(rows: WbsGridRow[], taskId: string): PlanningCommand | null {
  const rowIndex = rows.findIndex((row) => row.id === taskId);
  if (rowIndex <= 0) return null;

  const taskRow = rows[rowIndex];
  const parentRow = rows[rowIndex - 1];
  if (!taskRow || !parentRow) return null;
  const newParentId = parentRow.id;
  if (readParentTaskId(taskRow) === newParentId) return null;

  const sortOrder = siblingRows(rows, newParentId, taskId).length;
  return {
    type: "task.move_wbs",
    payload: { taskId, parentTaskId: newParentId, sortOrder }
  };
}

export function buildOutdentMoveCommand(rows: WbsGridRow[], taskId: string): PlanningCommand | null {
  const rowIndex = rows.findIndex((row) => row.id === taskId);
  if (rowIndex < 0) return null;

  const taskRow = rows[rowIndex];
  if (!taskRow) return null;
  const parentId = readParentTaskId(taskRow);
  if (!parentId) return null;

  const parentRow = rows.find((row) => row.id === parentId);
  const newParentId = parentRow ? readParentTaskId(parentRow) : null;
  const sortOrder = sortOrderAfterSibling(rows, newParentId, parentId);

  return {
    type: "task.move_wbs",
    payload: { taskId, parentTaskId: newParentId, sortOrder }
  };
}
