import type { GanttRow } from "./types";

export type RowSubtreeRange = {
  start: number;
  end: number;
};

/** Row index range including the root row and all deeper descendants. */
export function rowSubtreeRange(rows: GanttRow[], rowId: string): RowSubtreeRange | null {
  const start = rows.findIndex((r) => r.id === rowId);
  if (start < 0) return null;

  const level = rows[start]!.level;
  let end = start + 1;
  while (end < rows.length && rows[end]!.level > level) end += 1;

  return { start, end };
}

export function rowSubtreeIds(rows: GanttRow[], rowId: string): string[] {
  const range = rowSubtreeRange(rows, rowId);
  if (!range) return [];
  return rows.slice(range.start, range.end).map((row) => row.id);
}
