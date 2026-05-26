"use client";

import { useCallback, useMemo, useState } from "react";

import type { MatrixRow } from "./types";

export type MatrixVisibleRow = {
  row: MatrixRow;
  depth: number;
  expanded: boolean;
};

function rowDepth(row: MatrixRow): number {
  if (row.kind === "workshop") return 0;
  if (row.kind === "role" || row.kind === "sub") return 1;
  if (row.kind === "person") return 2;
  return row.indent ?? 0;
}

export function filterVisibleMatrixRows(
  rows: MatrixRow[],
  collapsed: ReadonlySet<string>
): MatrixVisibleRow[] {
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const out: MatrixVisibleRow[] = [];
  for (const row of rows) {
    if (isRowHidden(row, rowsById, collapsed)) continue;
    out.push({
      row,
      depth: rowDepth(row),
      expanded: row.collapsible ? !collapsed.has(row.id) : true
    });
  }
  return out;
}

function isRowHidden(
  row: MatrixRow,
  rowsById: Map<string, MatrixRow>,
  collapsed: ReadonlySet<string>
): boolean {
  let parentId = row.parentId;
  while (parentId) {
    if (collapsed.has(parentId)) return true;
    parentId = rowsById.get(parentId)?.parentId;
  }
  return false;
}

/** Видимые строки матрицы с учётом свёрнутых групп. */
export function useMatrixVisibleRows(rows: MatrixRow[]) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const visible = useMemo<MatrixVisibleRow[]>(
    () => filterVisibleMatrixRows(rows, collapsed),
    [rows, collapsed]
  );

  const toggle = useCallback((rowId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  return { visible, toggle };
}
