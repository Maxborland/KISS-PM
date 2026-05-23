"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { useCallback } from "react";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { buildCommandsFromTsvPaste } from "./clipboard/planningClipboard";
import { useDragFill } from "./clipboard/useDragFill";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import type { WbsGridRow } from "./wbsRows";

export function useWbsGridActions(props: {
  readModel: PlanningReadModel | undefined;
  projectId: string;
  defaultStatusId: string;
  permissions: PlanningPermissions;
  rows: WbsGridRow[];
  selectedTaskId: string | null;
  selectedRowIds: Set<string>;
  activeRowIndex: number | null;
  activeColumnId: string | null;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
  onApplyBatch: (commands: PlanningCommand[]) => Promise<unknown>;
  onDeleteRows: (taskIds: string[]) => Promise<void>;
}) {
  const dragFill = useDragFill();
  const canEdit = props.permissions.canManageProjectPlan;

  const createTaskBelow = useCallback(
    async (anchorTaskId: string | null) => {
      if (!canEdit || !props.defaultStatusId) return;
      const taskId = `task-${Date.now()}`;
      await props.onPreviewCommand({
        type: "task.create",
        payload: {
          id: taskId,
          projectId: props.projectId,
          parentTaskId: anchorTaskId,
          title: "Новая задача",
          statusId: props.defaultStatusId,
          plannedStart: null,
          plannedFinish: null,
          durationMinutes: null,
          workMinutes: 480,
          assignments: []
        }
      });
    },
    [canEdit, props]
  );

  const fillDownActiveColumn = useCallback(async () => {
    if (!canEdit || props.activeRowIndex === null || !props.activeColumnId) return;
    const startRow = props.rows[props.activeRowIndex];
    if (!startRow) return;
    const seed = getSeedValue(startRow, props.activeColumnId);
    if (!seed) return;
    const targetCount = Math.min(4, props.rows.length - props.activeRowIndex - 1);
    if (targetCount <= 0) return;
    const values = dragFill.buildFillValues(seed, targetCount);
    const commands: PlanningCommand[] = [];
    for (let offset = 1; offset <= values.length; offset += 1) {
      const row = props.rows[props.activeRowIndex + offset];
      const value = values[offset - 1];
      if (!row || !value) continue;
      const command = buildFillCommand(row.id, props.activeColumnId, value, row);
      if (command) commands.push(command);
    }
    if (commands.length > 0) await props.onApplyBatch(commands);
  }, [canEdit, dragFill, props]);

  const handleContextMenuAction = useCallback(
    async (action: string) => {
      const anchorId = props.selectedTaskId ?? props.rows[props.activeRowIndex ?? 0]?.id ?? null;
      switch (action) {
        case "insert-above":
        case "insert-below":
        case "insert-child":
          await createTaskBelow(action === "insert-child" ? anchorId : null);
          break;
        case "delete":
          await props.onDeleteRows([...props.selectedRowIds]);
          break;
        case "fill-down":
          await fillDownActiveColumn();
          break;
        case "copy":
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            const payload = {
              tasks: props.rows
                .filter((row) => props.selectedRowIds.has(row.id))
                .map((row) => ({ title: row.title }))
            };
            await navigator.clipboard.writeText(JSON.stringify(payload));
          }
          break;
        case "paste": {
          const tsv = typeof navigator !== "undefined" ? await navigator.clipboard.readText() : "";
          if (!tsv.includes("\t")) return;
          const wbsIndexToTaskId = new Map(
            props.rows.map((row, index) => [index + 1, row.id] as const)
          );
          const commands = buildCommandsFromTsvPaste(
            tsv,
            props.projectId,
            props.defaultStatusId,
            wbsIndexToTaskId
          );
          if (commands.length > 0) await props.onApplyBatch(commands);
          break;
        }
        default:
          break;
      }
    },
    [createTaskBelow, fillDownActiveColumn, props]
  );

  const handleDragFillRelease = useCallback(
    async (startRowIndex: number, endRowIndex: number, columnId: string) => {
      if (!canEdit || endRowIndex <= startRowIndex) return;
      const startRow = props.rows[startRowIndex];
      if (!startRow) return;
      const seed = getSeedValue(startRow, columnId);
      if (!seed) return;
      const count = endRowIndex - startRowIndex;
      const values = dragFill.buildFillValues(seed, count);
      const commands: PlanningCommand[] = [];
      for (let offset = 1; offset <= values.length; offset += 1) {
        const row = props.rows[startRowIndex + offset];
        const value = values[offset - 1];
        if (!row || !value) continue;
        const command = buildFillCommand(row.id, columnId, value, row);
        if (command) commands.push(command);
      }
      if (commands.length > 0) await props.onApplyBatch(commands);
      dragFill.setIsDragging(false);
    },
    [canEdit, dragFill, props]
  );

  return {
    canEdit,
    dragFill,
    createTaskBelow,
    fillDownActiveColumn,
    handleContextMenuAction,
    handleDragFillRelease
  };
}

function getSeedValue(row: WbsGridRow, columnId: string): string {
  if (columnId === "title") return row.title;
  if (columnId === "finish") return row.finish ?? "";
  if (columnId === "durationLabel") return row.durationLabel;
  if (columnId === "percentComplete") return String(row.percentComplete);
  return "";
}

function buildFillCommand(
  taskId: string,
  columnId: string,
  value: string,
  row: WbsGridRow
): PlanningCommand | null {
  if (columnId === "title") {
    return { type: "task.update_identity", payload: { taskId, title: value } };
  }
  if (columnId === "finish") {
    return {
      type: "task.update_schedule",
      payload: {
        taskId,
        plannedStart: (row.task.plannedStart as string | null) ?? null,
        plannedFinish: value || null
      }
    };
  }
  if (columnId === "percentComplete") {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return null;
    return { type: "task.update_progress", payload: { taskId, percentComplete: percent } };
  }
  return null;
}
