"use client";

import { useCallback, useState } from "react";

export type GridCellAddress = { rowIndex: number; columnId: string };

export function useGridSelection(rowCount: number) {
  const [activeCell, setActiveCell] = useState<GridCellAddress | null>(
    rowCount > 0 ? { rowIndex: 0, columnId: "title" } : null
  );
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [anchorRowIndex, setAnchorRowIndex] = useState<number | null>(null);

  const selectRow = useCallback((rowIndex: number, rowId: string, extend: boolean) => {
    if (extend && anchorRowIndex !== null) {
      const start = Math.min(anchorRowIndex, rowIndex);
      const end = Math.max(anchorRowIndex, rowIndex);
      const next = new Set<string>();
      for (let index = start; index <= end; index += 1) {
        const id = document
          .querySelector(`[data-wbs-row-index="${index}"]`)
          ?.getAttribute("data-row-id");
        if (id) next.add(id);
      }
      setSelectedRowIds(next);
      return;
    }
    setAnchorRowIndex(rowIndex);
    setSelectedRowIds(new Set([rowId]));
  }, [anchorRowIndex]);

  const selectAllRows = useCallback((rowIds: string[]) => {
    setSelectedRowIds(new Set(rowIds));
  }, []);

  return {
    activeCell,
    setActiveCell,
    selectedRowIds,
    selectRow,
    selectAllRows,
    clearSelection: () => setSelectedRowIds(new Set())
  };
}
