import type { GanttRow } from "./types";
import { rowSubtreeIds } from "./gantt-row-tree";

export { rowSubtreeIds } from "./gantt-row-tree";

export function canDropRowBefore(
  rows: GanttRow[],
  dragRootId: string,
  targetRowId: string
): boolean {
  if (dragRootId === targetRowId) return false;
  const dragIndex = rows.findIndex((row) => row.id === dragRootId);
  const targetIndex = rows.findIndex((row) => row.id === targetRowId);
  if (dragIndex < 0 || targetIndex < 0) return false;
  const subtree = new Set(rowSubtreeIds(rows, dragRootId));
  if (subtree.has(targetRowId)) return false;
  return rows[dragIndex]!.level === rows[targetIndex]!.level &&
    rowParentId(rows, dragIndex) === rowParentId(rows, targetIndex);
}

/**
 * Move subtree rooted at dragRootId to insert before targetRowId.
 * If targetRowId is null, append at end.
 */
export function reorderRowsByDrag(
  rows: GanttRow[],
  dragRootId: string,
  targetRowId: string | null
): GanttRow[] | null {
  const dragIndex = rows.findIndex((r) => r.id === dragRootId);
  if (dragIndex < 0) return null;

  const subtreeIds = rowSubtreeIds(rows, dragRootId);
  const subtree = rows.filter((r) => subtreeIds.includes(r.id));
  const rest = rows.filter((r) => !subtreeIds.includes(r.id));

  let insertAt = rest.length;
  if (targetRowId) {
    if (!canDropRowBefore(rows, dragRootId, targetRowId)) return null;
    const targetIndex = rest.findIndex((r) => r.id === targetRowId);
    if (targetIndex < 0) return null;
    insertAt = targetIndex;
  } else if (rows[dragIndex]!.level > 0) {
    return null;
  }

  const next = [...rest.slice(0, insertAt), ...subtree, ...rest.slice(insertAt)];
  return next;
}

function rowParentId(rows: GanttRow[], index: number): string | null {
  const level = rows[index]!.level;
  if (level === 0) return null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (rows[cursor]!.level < level) return rows[cursor]!.id;
  }
  return null;
}

export function shiftRowDates(row: GanttRow, deltaDays: number): GanttRow {
  const startDay = Math.max(0, row.startDay + deltaDays);
  if (row.kind === "milestone") return { ...row, startDay, durationDays: 0 };
  return { ...row, startDay };
}
