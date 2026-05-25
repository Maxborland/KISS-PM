import { dayIndexToDateLabel, finishDayIndex } from "./gantt-dates";
import { fieldIndex, GANTT_GRID_FIELDS } from "./gantt-grid-fields";
import type { GanttCellField, GanttFocusCell, GanttRow } from "./types";

export function cellValueForExport(row: GanttRow, field: GanttCellField): string {
  switch (field) {
    case "name":
      return row.name;
    case "duration":
      return row.kind === "milestone" ? "0" : String(row.durationDays);
    case "progress":
      return `${Math.round((row.progress ?? 0) * 100)}`;
    case "start":
      return dayIndexToDateLabel(row.startDay);
    case "finish":
      return dayIndexToDateLabel(finishDayIndex(row));
    case "predecessors":
      return row.predecessors === "—" ? "" : (row.predecessors ?? "");
    case "resource":
      return row.assignee?.initials ?? "";
    default:
      return "";
  }
}

export function rangeToTsv(
  rows: GanttRow[],
  rowOrder: string[],
  anchor: GanttFocusCell,
  focus: GanttFocusCell
): string {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const r0 = rowOrder.indexOf(anchor.rowId);
  const r1 = rowOrder.indexOf(focus.rowId);
  const c0 = fieldIndex(anchor.field);
  const c1 = fieldIndex(focus.field);
  if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return "";

  const lines: string[] = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 1) {
    const row = byId.get(rowOrder[r]!);
    if (!row) continue;
    const cells: string[] = [];
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c += 1) {
      const field = GANTT_GRID_FIELDS[c]!;
      cells.push(cellValueForExport(row, field));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

export type PasteCellTarget = { rowId: string; field: GanttCellField; value: string };

export function parseTsvPaste(tsv: string, start: GanttFocusCell, rowOrder: string[]): PasteCellTarget[] {
  const lines = tsv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const startRow = rowOrder.indexOf(start.rowId);
  const startCol = fieldIndex(start.field);
  if (startRow < 0 || startCol < 0) return [];

  const targets: PasteCellTarget[] = [];
  lines.forEach((line, rowOffset) => {
    const cols = line.split("\t");
    cols.forEach((value, colOffset) => {
      const rowIndex = startRow + rowOffset;
      const colIndex = startCol + colOffset;
      if (rowIndex >= rowOrder.length || colIndex >= GANTT_GRID_FIELDS.length) return;
      targets.push({
        rowId: rowOrder[rowIndex]!,
        field: GANTT_GRID_FIELDS[colIndex]!,
        value
      });
    });
  });
  return targets;
}

export function clearValueForField(field: GanttCellField): string {
  switch (field) {
    case "progress":
      return "0";
    case "duration":
      return "1";
    case "predecessors":
    case "resource":
      return "";
    case "name":
      return "";
    default:
      return "";
  }
}
