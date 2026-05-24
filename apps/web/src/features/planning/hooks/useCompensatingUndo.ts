"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { buildCompensatingCommands, type PlanningReadModel } from "@kiss-pm/planning-client";
import { useCallback, useState } from "react";

export type AppliedUndoEntry = {
  command: PlanningCommand;
  before: PlanningReadModel;
};

export function useCompensatingUndo() {
  const [appliedStack, setAppliedStack] = useState<AppliedUndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<AppliedUndoEntry[]>([]);

  const pushApplied = useCallback((entry: AppliedUndoEntry) => {
    setAppliedStack((current) => [...current, entry]);
    setRedoStack([]);
  }, []);

  const popUndo = useCallback((): PlanningCommand[] => {
    const entry = appliedStack[appliedStack.length - 1];
    if (!entry) return [];
    setAppliedStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, entry]);
    return buildCompensatingCommands(entry.command, entry.before);
  }, [appliedStack]);

  const popRedo = useCallback((): PlanningCommand[] => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return [];
    setRedoStack((current) => current.slice(0, -1));
    setAppliedStack((current) => [...current, entry]);
    return [entry.command];
  }, [redoStack]);

  return { pushApplied, popUndo, popRedo, canUndo: appliedStack.length > 0, canRedo: redoStack.length > 0 };
}
