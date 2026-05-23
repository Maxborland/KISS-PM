"use client";

import { useEffect } from "react";

import type { WbsColumnId } from "./wbsColumns";
import type { GridCellAddress } from "./useGridSelection";

const columnOrder: WbsColumnId[] = [
  "wbsIndex",
  "title",
  "durationLabel",
  "finish",
  "percentComplete",
  "assignmentsLabel",
  "validation"
];

export function useGridKeyboard(options: {
  rowCount: number;
  activeCell: GridCellAddress | null;
  setActiveCell: (cell: GridCellAddress) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDeleteSelection: () => void;
  onUndo: () => void;
  onUndoApplied?: () => void;
  onRedoApplied?: () => void;
  onSelectAll: () => void;
  onInsertRow?: () => void;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!options.enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!options.activeCell) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (event.key === "F2" || event.key === "Enter") {
        event.preventDefault();
        if (event.key === "Enter") options.onCommitEdit();
        else options.onStartEdit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        options.onCancelEdit();
        return;
      }
      if (event.key === "Insert") {
        event.preventDefault();
        options.onInsertRow?.();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        options.onDeleteSelection();
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        options.onUndoApplied?.();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        options.onUndo();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        options.onRedoApplied?.();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        options.onSelectAll();
        return;
      }

      const columnIndex = columnOrder.indexOf(options.activeCell.columnId as WbsColumnId);
      if (columnIndex < 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        options.setActiveCell({
          rowIndex: Math.min(options.rowCount - 1, options.activeCell.rowIndex + 1),
          columnId: options.activeCell.columnId
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        options.setActiveCell({
          rowIndex: Math.max(0, options.activeCell.rowIndex - 1),
          columnId: options.activeCell.columnId
        });
      } else if (event.key === "ArrowRight" || (event.key === "Tab" && !event.shiftKey)) {
        event.preventDefault();
        const nextColumn = columnOrder[Math.min(columnOrder.length - 1, columnIndex + 1)]!;
        options.setActiveCell({ rowIndex: options.activeCell.rowIndex, columnId: nextColumn });
      } else if (event.key === "ArrowLeft" || (event.key === "Tab" && event.shiftKey)) {
        event.preventDefault();
        const prevColumn = columnOrder[Math.max(0, columnIndex - 1)]!;
        options.setActiveCell({ rowIndex: options.activeCell.rowIndex, columnId: prevColumn });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options]);
}
