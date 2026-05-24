"use client";

import { useCallback, useState } from "react";

import type { GridCellAddress } from "./useGridSelection";

export function useGridEdit() {
  const [editingCell, setEditingCell] = useState<GridCellAddress | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = useCallback((cell: GridCellAddress, value: string) => {
    setEditingCell(cell);
    setEditValue(value);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  return {
    editingCell,
    editValue,
    setEditValue,
    startEdit,
    cancelEdit,
    clearEdit: cancelEdit
  };
}
