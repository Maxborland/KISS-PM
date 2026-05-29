import { fieldIndex, GANTT_GRID_FIELDS } from "./gantt-grid-fields";
import type { GanttCellField, GanttFocusCell } from "./types";

export type GanttCellRange = {
  anchor: GanttFocusCell;
  focus: GanttFocusCell;
};

export function normalizeRange(range: GanttCellRange, rowOrder: string[]): GanttCellRange {
  const r0 = rowOrder.indexOf(range.anchor.rowId);
  const r1 = rowOrder.indexOf(range.focus.rowId);
  const c0 = fieldIndex(range.anchor.field);
  const c1 = fieldIndex(range.focus.field);
  if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return range;

  const rowMin = Math.min(r0, r1);
  const rowMax = Math.max(r0, r1);
  const colMin = Math.min(c0, c1);
  const colMax = Math.max(c0, c1);

  return {
    anchor: { rowId: rowOrder[rowMin]!, field: GANTT_GRID_FIELDS[colMin]! },
    focus: { rowId: rowOrder[rowMax]!, field: GANTT_GRID_FIELDS[colMax]! }
  };
}

export function isCellInRange(
  cell: GanttFocusCell,
  range: GanttCellRange | null | undefined,
  rowOrder: string[]
): boolean {
  if (!range) return false;
  const norm = normalizeRange(range, rowOrder);
  const r = rowOrder.indexOf(cell.rowId);
  const c = fieldIndex(cell.field);
  const r0 = rowOrder.indexOf(norm.anchor.rowId);
  const r1 = rowOrder.indexOf(norm.focus.rowId);
  const c0 = fieldIndex(norm.anchor.field);
  const c1 = fieldIndex(norm.focus.field);
  if (r < 0 || c < 0 || r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return false;
  return r >= Math.min(r0, r1) && r <= Math.max(r0, r1) && c >= Math.min(c0, c1) && c <= Math.max(c0, c1);
}

export function moveFocusCell(
  current: GanttFocusCell,
  direction: "up" | "down" | "left" | "right",
  rowOrder: string[]
): GanttFocusCell {
  const rowIndex = rowOrder.indexOf(current.rowId);
  const colIndex = fieldIndex(current.field);
  if (rowIndex < 0 || colIndex < 0) return current;

  let nextRow = rowIndex;
  let nextCol = colIndex;

  if (direction === "up") nextRow = Math.max(0, rowIndex - 1);
  if (direction === "down") nextRow = Math.min(rowOrder.length - 1, rowIndex + 1);
  if (direction === "left") nextCol = Math.max(0, colIndex - 1);
  if (direction === "right") nextCol = Math.min(GANTT_GRID_FIELDS.length - 1, colIndex + 1);

  return {
    rowId: rowOrder[nextRow] ?? current.rowId,
    field: GANTT_GRID_FIELDS[nextCol] ?? current.field
  };
}

export function singleCellRange(cell: GanttFocusCell): GanttCellRange {
  return { anchor: cell, focus: cell };
}
