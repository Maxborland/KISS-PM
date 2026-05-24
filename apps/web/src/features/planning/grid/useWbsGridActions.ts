"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { detectFillSeries } from "@kiss-pm/planning-client";
import { useCallback, useState } from "react";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { buildCommandsFromTsvPaste } from "./clipboard/planningClipboard";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import {
  buildFillCommandsForRange,
  getWbsCellTextValue
} from "./wbsGridCellValue";
import { buildIndentMoveCommand, buildOutdentMoveCommand } from "./wbsIndentOutdent";
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
  const [isDragging, setIsDragging] = useState(false);
  const canEdit = props.permissions.canManageProjectPlan;

  const buildFillValues = useCallback((seed: string, count: number) => {
    const series = detectFillSeries(seed, count);
    return series.ok ? series.values : [];
  }, []);

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

  const applyFillRange = useCallback(
    async (startRowIndex: number, endRowIndex: number, columnId: string) => {
      if (!canEdit || endRowIndex <= startRowIndex) return;
      const startRow = props.rows[startRowIndex];
      if (!startRow) return;
      const seed = getWbsCellTextValue(startRow, columnId);
      if (!seed) return;
      const values = buildFillValues(seed, endRowIndex - startRowIndex);
      const commands = buildFillCommandsForRange({
        rows: props.rows,
        startRowIndex,
        endRowIndex,
        columnId,
        values
      });
      if (commands.length > 0) await props.onApplyBatch(commands);
    },
    [buildFillValues, canEdit, props]
  );

  const applyWbsHierarchyMove = useCallback(
    async (taskId: string | null, direction: "indent" | "outdent") => {
      if (!canEdit || !taskId) return;
      const command =
        direction === "indent"
          ? buildIndentMoveCommand(props.rows, taskId)
          : buildOutdentMoveCommand(props.rows, taskId);
      if (command) await props.onPreviewCommand(command);
    },
    [canEdit, props]
  );

  const fillDownActiveColumn = useCallback(async () => {
    if (props.activeRowIndex === null || !props.activeColumnId) return;
    const endRowIndex = Math.min(
      props.activeRowIndex + Math.min(4, props.rows.length - props.activeRowIndex - 1),
      props.rows.length - 1
    );
    await applyFillRange(props.activeRowIndex, endRowIndex, props.activeColumnId);
  }, [applyFillRange, props.activeColumnId, props.activeRowIndex, props.rows.length]);

  const handleContextMenuAction = useCallback(
    async (action: string) => {
      const anchorId = props.selectedTaskId ?? props.rows[props.activeRowIndex ?? 0]?.id ?? null;
      switch (action) {
        case "insert-above":
        case "insert-below":
        case "insert-child": {
          const anchorRow =
            props.rows.find((row) => row.id === anchorId) ??
            (props.activeRowIndex !== null ? props.rows[props.activeRowIndex] : undefined);
          const parentTaskId =
            action === "insert-child"
              ? anchorId
              : typeof anchorRow?.task.parentTaskId === "string" && anchorRow.task.parentTaskId.length > 0
                ? anchorRow.task.parentTaskId
                : null;
          await createTaskBelow(parentTaskId);
          break;
        }
        case "delete":
          await props.onDeleteRows([...props.selectedRowIds]);
          break;
        case "fill-down":
          await fillDownActiveColumn();
          break;
        case "indent":
          await applyWbsHierarchyMove(anchorId, "indent");
          break;
        case "outdent":
          await applyWbsHierarchyMove(anchorId, "outdent");
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
    [applyWbsHierarchyMove, createTaskBelow, fillDownActiveColumn, props]
  );

  const handleDragFillRelease = useCallback(
    async (startRowIndex: number, endRowIndex: number, columnId: string) => {
      await applyFillRange(startRowIndex, endRowIndex, columnId);
      setIsDragging(false);
    },
    [applyFillRange]
  );

  return {
    canEdit,
    dragFill: { isDragging, setIsDragging },
    createTaskBelow,
    fillDownActiveColumn,
    applyWbsHierarchyMove,
    handleContextMenuAction,
    handleDragFillRelease
  };
}
