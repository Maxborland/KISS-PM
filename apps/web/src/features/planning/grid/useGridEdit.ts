"use client";

import { useCallback, useState } from "react";

import type { GridCellAddress } from "./useGridSelection";

export function useGridEdit() {
  const [editingCell, setEditingCell] = useState<GridCellAddress | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");

  const startEdit = useCallback((cell: GridCellAddress, value: string) => {
    setEditingCell(cell);
    setEditValue(value);
    setOriginalValue(value);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
    setOriginalValue("");
  }, []);

  return {
    editingCell,
    editValue,
    originalValue,
    setEditValue,
    startEdit,
    cancelEdit,
    clearEdit: cancelEdit
  };
}
