import type { GanttCellField } from "./types";

/** Editable WBS columns in grid order (for range selection / TSV). */
export const GANTT_GRID_FIELDS: readonly GanttCellField[] = [
  "name",
  "duration",
  "progress",
  "start",
  "finish",
  "predecessors",
  "resource",
  "work"
] as const;

export function fieldIndex(field: GanttCellField): number {
  return GANTT_GRID_FIELDS.indexOf(field);
}

export function isGridField(field: GanttCellField): boolean {
  return fieldIndex(field) >= 0;
}
