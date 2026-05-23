"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import {
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";

import { WbsContextMenu } from "./contextMenu/WbsContextMenu";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { SavedViewsDropdown } from "../savedViews/SavedViewsDropdown";
import { useSavedViews, type SavedView } from "../savedViews/useSavedViews";
import { useWbsGridActions } from "./useWbsGridActions";
import { useGridEdit } from "./useGridEdit";
import { useGridKeyboard } from "./useGridKeyboard";
import { useGridSelection } from "./useGridSelection";
import { buildWbsColumns, type WbsCustomFieldColumn } from "./wbsColumns";
import { buildPreviewCommandFromCell, getWbsCellTextValue } from "./wbsGridCellValue";
import { buildIndentMoveCommand, buildOutdentMoveCommand } from "./wbsIndentOutdent";
import { buildWbsRows } from "./wbsRows";
import type { PlanningReadModel } from "@kiss-pm/planning-client";

const ROW_HEIGHT = 36;

export function WbsGrid(props: {
  readModel: PlanningReadModel | undefined;
  projectId: string;
  defaultStatusId: string;
  permissions: PlanningPermissions;
  previewPending: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
  onApplyBatch: (commands: PlanningCommand[]) => Promise<unknown>;
  onDeleteRows: (taskIds: string[]) => Promise<void>;
  onUndoPending: () => void;
  onUndoApplied?: () => void;
  onRedoApplied?: () => void;
  customFieldColumns?: readonly WbsCustomFieldColumn[];
}) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const savedViews = useSavedViews(props.projectId, true);
  const activeView: SavedView | null = useMemo(
    () => savedViews.views.find((view) => view.id === activeViewId) ?? null,
    [savedViews.views, activeViewId]
  );
  const rows = useMemo(() => buildWbsRows(props.readModel), [props.readModel]);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const columns = useMemo(
    () =>
      buildWbsColumns({
        visibleColumnIds: activeView?.payload.visibleColumnIds,
        customFieldColumns: props.customFieldColumns
      }),
    [activeView, props.customFieldColumns]
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });
  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });
  const selection = useGridSelection(tableRows.length);
  const edit = useGridEdit();
  const canEdit =
    props.permissions.canManageProjectPlan && !props.previewPending;
  const hierarchyTaskId =
    props.selectedTaskId ??
    (selection.activeCell !== null ? (rows[selection.activeCell.rowIndex]?.id ?? null) : null);
  const canIndent = hierarchyTaskId
    ? buildIndentMoveCommand(rows, hierarchyTaskId) !== null
    : false;
  const canOutdent = hierarchyTaskId
    ? buildOutdentMoveCommand(rows, hierarchyTaskId) !== null
    : false;

  const gridActions = useWbsGridActions({
    readModel: props.readModel,
    projectId: props.projectId,
    defaultStatusId: props.defaultStatusId,
    permissions: props.permissions,
    rows,
    selectedTaskId: props.selectedTaskId,
    selectedRowIds: selection.selectedRowIds,
    activeRowIndex: selection.activeCell?.rowIndex ?? null,
    activeColumnId: selection.activeCell?.columnId ?? null,
    onPreviewCommand: props.onPreviewCommand,
    onApplyBatch: props.onApplyBatch,
    onDeleteRows: props.onDeleteRows
  });

  const commitActiveCell = async () => {
    if (!selection.activeCell || !props.readModel) return;
    const row = tableRows[selection.activeCell.rowIndex];
    if (!row) return;
    const columnId = selection.activeCell.columnId;
    const value = edit.editingCell
      ? edit.editValue
      : getWbsCellTextValue(row.original, columnId);
    const command = buildPreviewCommandFromCell(row.original, columnId, value);
    if (command) await props.onPreviewCommand(command);
    edit.clearEdit();
  };

  useGridKeyboard({
    rowCount: tableRows.length,
    activeCell: selection.activeCell,
    setActiveCell: selection.setActiveCell,
    onStartEdit: () => {
      if (!selection.activeCell || !canEdit) return;
      const row = tableRows[selection.activeCell.rowIndex];
      if (!row) return;
      edit.startEdit(
        selection.activeCell,
        getWbsCellTextValue(row.original, selection.activeCell.columnId)
      );
    },
    onCommitEdit: () => void commitActiveCell(),
    onCancelEdit: edit.cancelEdit,
    onDeleteSelection: () => {
      void props.onDeleteRows([...selection.selectedRowIds]);
    },
    onUndo: props.onUndoPending,
    ...(props.onUndoApplied ? { onUndoApplied: () => void props.onUndoApplied?.() } : {}),
    ...(props.onRedoApplied ? { onRedoApplied: () => void props.onRedoApplied?.() } : {}),
    onSelectAll: () => selection.selectAllRows(rows.map((row) => row.id)),
    onInsertRow: () => void gridActions.createTaskBelow(props.selectedTaskId),
    onIndentRow: () => {
      if (!hierarchyTaskId) return;
      void gridActions.applyWbsHierarchyMove(hierarchyTaskId, "indent");
    },
    onOutdentRow: () => {
      if (!hierarchyTaskId) return;
      void gridActions.applyWbsHierarchyMove(hierarchyTaskId, "outdent");
    },
    enabled: true
  });

  return (
    <WbsContextMenu
      open={contextMenuOpen}
      onOpenChange={setContextMenuOpen}
      permissions={props.permissions}
      onInsertAbove={() => void gridActions.handleContextMenuAction("insert-above")}
      onInsertBelow={() => void gridActions.handleContextMenuAction("insert-below")}
      onInsertChild={() => void gridActions.handleContextMenuAction("insert-child")}
      onCopy={() => void gridActions.handleContextMenuAction("copy")}
      onPaste={() => void gridActions.handleContextMenuAction("paste")}
      onFillDown={() => void gridActions.handleContextMenuAction("fill-down")}
      onIndent={() => void gridActions.handleContextMenuAction("indent")}
      onOutdent={() => void gridActions.handleContextMenuAction("outdent")}
      canIndent={canIndent}
      canOutdent={canOutdent}
      onDelete={() => void gridActions.handleContextMenuAction("delete")}
      trigger={
        <div className="planning-wbs-pane-wrapper">
        <div className="planning-toolbar">
          <SavedViewsDropdown
            activeViewId={activeViewId}
            views={savedViews.views}
            canManage={canEdit}
            onSelect={(view) => setActiveViewId(view?.id ?? null)}
            onCreate={async () => {
              if (!canEdit) return;
              const name = window.prompt("Название представления", "Мой вид");
              if (!name) return;
              const created = await savedViews
                .createSavedView({
                  id: `view-${Date.now()}`,
                  scope: "user",
                  name,
                  payload: {
                    visibleColumnIds: table.getAllColumns().map((column) => column.id)
                  }
                })
                .catch(() => null);
              if (created) setActiveViewId(created.id);
            }}
            onDelete={async (view) => {
              if (!canEdit) return;
              await savedViews.deleteSavedView(view.id).catch(() => undefined);
              if (activeViewId === view.id) setActiveViewId(null);
            }}
          />
        </div>
        <div
          className="planning-wbs-pane"
          ref={parentRef}
          data-testid="planning-wbs-grid"
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenuOpen(true);
          }}
        >
      <table className="planning-wbs-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ width: header.getSize() }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            if (!row) return null;
            const isSelected = props.selectedTaskId === row.original.id;
            const isRowSelected = selection.selectedRowIds.has(row.original.id);
            return (
              <tr
                key={row.id}
                data-wbs-row-index={virtualRow.index}
                data-row-id={row.original.id}
                className={[
                  isSelected ? "is-task-selected" : "",
                  isRowSelected ? "is-row-selected" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  height: ROW_HEIGHT
                }}
                onClick={() => {
                  selection.selectRow(virtualRow.index, row.original.id, false);
                  props.onSelectTask(row.original.id);
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const columnId = cell.column.id;
                  const isActive =
                    selection.activeCell?.rowIndex === virtualRow.index &&
                    selection.activeCell.columnId === columnId;
                  const isEditing =
                    edit.editingCell?.rowIndex === virtualRow.index &&
                    edit.editingCell.columnId === columnId;
                  const editable =
                    canEdit &&
                    (cell.column.columnDef.meta as { editable?: boolean } | undefined)?.editable;
                  return (
                    <td
                      key={cell.id}
                      className={[
                        isActive ? "is-active-cell" : "",
                        row.original.hasValidation && columnId === "validation"
                          ? "has-validation"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onDoubleClick={() => {
                        if (!editable) return;
                        selection.setActiveCell({ rowIndex: virtualRow.index, columnId });
                        edit.startEdit(
                          { rowIndex: virtualRow.index, columnId },
                          getWbsCellTextValue(row.original, columnId)
                        );
                      }}
                    >
                      {isEditing ? (
                        <input
                          className="planning-cell-input"
                          autoFocus
                          value={edit.editValue}
                          onChange={(event) => edit.setEditValue(event.target.value)}
                          onBlur={() => void commitActiveCell()}
                        />
                      ) : (
                        <>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          {isActive &&
                          canEdit &&
                          (columnId === "finish" || columnId === "title") ? (
                            <button
                              type="button"
                              className="planning-drag-fill-handle"
                              data-testid="planning-drag-fill-handle"
                              aria-label="Заполнить вниз"
                              onMouseDown={() => gridActions.dragFill.setIsDragging(true)}
                              onMouseUp={() => {
                                if (!selection.activeCell) return;
                                void gridActions.handleDragFillRelease(
                                  selection.activeCell.rowIndex,
                                  virtualRow.index,
                                  selection.activeCell.columnId
                                );
                              }}
                            />
                          ) : null}
                        </>
                      )}
                      {columnId === "validation" && row.original.hasValidation && !isEditing ? (
                        <span className="planning-validation-mark">!</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
        </div>
        </div>
      }
    />
  );
}

