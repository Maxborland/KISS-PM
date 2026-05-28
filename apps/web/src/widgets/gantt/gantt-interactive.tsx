"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";

import { GanttApplyBar } from "./gantt-apply-bar";
import { buildContextMenuItems, GanttContextMenu } from "./gantt-context-menu";
import {
  loadGanttColumnSettings,
  reorderColumns,
  resizeColumn,
  saveGanttColumnSettings
} from "./gantt-column-settings";
import type { GanttColumnConfig } from "./types";
import { resolveGanttKeyboardAction } from "./gantt-keyboard-policy";
import { linkPreviewDependencyType, linkReadoutLabel } from "./gantt-link-interaction";
import { patchGanttData } from "./gantt-data-patch";
import { findResourceByInitials } from "./gantt-resources";
import { useGanttController } from "./gantt-state";
import { TaskDetailsDrawer } from "./task-details-drawer";
import { GanttView } from "./gantt-view";
import type {
  GanttCellField,
  GanttColumnId,
  GanttContextTarget,
  GanttDependencyEndpoint,
  GanttInteractiveProps,
  GanttPreviewState
} from "./types";

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}

function isGridKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(".gantt2"));
}

export function GanttInteractive({
  initialData,
  className,
  zoom = "day",
  interactionMode = "interactive",
  initialPreviewState,
  initialFlags,
  showInspector,
  showTaskDetailsDrawer,
  showApplyBar = true,
  toolbarSlot,
  onChange,
  onOpenTaskCard
}: GanttInteractiveProps) {
  const showDrawer = showTaskDetailsDrawer ?? showInspector ?? true;
  const [columns, setColumns] = useState<GanttColumnConfig[]>(() => loadGanttColumnSettings());

  const controller = useGanttController({
    initialData,
    ...(initialPreviewState !== undefined ? { initialPreviewState } : {}),
    ...(initialFlags !== undefined ? { initialFlags } : {}),
    ...(onChange !== undefined ? { onChange } : {})
  });

  const {
    displayData,
    state,
    selectedRow,
    selectRow,
    selectTaskBar,
    openTaskDetails,
    toggleRowCollapse,
    closeTaskDetails,
    commitField,
    assignResource,
    updateDependency,
    focusCell,
    navigateCell,
    copyCells,
    pasteCells,
    clearCells,
    startEdit,
    setEditDraft,
    commitEdit,
    cancelEdit,
    startDrag,
    moveDrag,
    endDrag,
    cancelDragSession,
    startRowDrag,
    updateRowDrag,
    endRowDrag,
    openContextMenu,
    closeContextMenu,
    runContextAction,
    startLink,
    moveLink,
    completeLink,
    dispatch
  } = controller;

  const dirty = state.history.past.length > 0 || state.previewState === "editing-local";

  const handleColumnResize = useCallback((id: GanttColumnId, width: number) => {
    setColumns((prev) => {
      const next = resizeColumn(prev, id, width);
      saveGanttColumnSettings(next);
      return next;
    });
  }, []);

  const handleColumnReorder = useCallback((fromId: GanttColumnId, toId: GanttColumnId) => {
    setColumns((prev) => {
      const next = reorderColumns(prev, fromId, toId);
      saveGanttColumnSettings(next);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, target: GanttContextTarget) => {
      if (target.kind === "cell" || target.kind === "row" || target.kind === "bar") {
        selectTaskBar(target.rowId);
        if (target.kind === "cell") focusCell({ rowId: target.rowId, field: target.field });
      }
      if (target.kind === "dependency") {
        dispatch({
          type: "patch",
          patch: {
            data: patchGanttData(state.data, { selectedDependencyId: target.dependencyId, selectedRowId: null })
          }
        });
      }
      openContextMenu(event.clientX, event.clientY, target);
    },
    [dispatch, focusCell, openContextMenu, selectTaskBar, state.data]
  );

  const handleCellClick = useCallback(
    (cell: { rowId: string; field: GanttCellField }, extend: boolean) => {
      focusCell(cell, extend);
    },
    [focusCell]
  );

  const handleRowHeaderClick = useCallback(
    (rowId: string) => {
      selectTaskBar(rowId);
      dispatch({ type: "patch", patch: { selection: null, focus: null } });
    },
    [dispatch, selectTaskBar]
  );

  const navigateRow = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (direction === "left" || direction === "right") {
        navigateCell(direction, false);
        return;
      }
      const ids = controller.rowsVisible.map((r) => r.id);
      const current = state.data.selectedRowId;
      const index = current ? ids.indexOf(current) : -1;
      const nextIndex = direction === "down" ? Math.min(index + 1, ids.length - 1) : Math.max(index - 1, 0);
      selectTaskBar(ids[nextIndex]!);
    },
    [controller.rowsVisible, navigateCell, selectTaskBar, state.data.selectedRowId]
  );

  useEffect(() => {
    if (!state.rowDrag) return;
    const onUp = () => endRowDrag();
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [endRowDrag, state.rowDrag]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = resolveGanttKeyboardAction(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey
        },
        {
          edit: state.edit,
          link: state.link,
          drag: state.drag,
          contextMenu: state.contextMenu,
          detailsDrawerOpen: state.detailsDrawerOpen,
          focus: state.focus,
          activeGrid: isGridKeyboardTarget(event.target) && !isEditableKeyboardTarget(event.target)
        }
      );
      if (!action) return;

      event.preventDefault();

      switch (action.type) {
        case "undo":
          controller.toolbarApi.undo();
          break;
        case "redo":
          controller.toolbarApi.redo();
          break;
        case "copyCells":
          void copyCells();
          break;
        case "pasteCells":
          void pasteCells();
          break;
        case "clearCells":
          clearCells();
          break;
        case "cancelLink":
          dispatch({ type: "patch", patch: { link: null } });
          break;
        case "cancelEdit":
          cancelEdit();
          break;
        case "cancelDrag":
          cancelDragSession();
          break;
        case "closeContextMenu":
          closeContextMenu();
          break;
        case "closeTaskDetails":
          closeTaskDetails();
          break;
        case "startEdit":
          if (state.focus) startEdit(state.focus.rowId, state.focus.field);
          break;
        case "navigateCell":
          navigateCell(action.direction, action.extend);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cancelDragSession,
    cancelEdit,
    clearCells,
    closeContextMenu,
    closeTaskDetails,
    controller.toolbarApi,
    copyCells,
    dispatch,
    navigateCell,
    pasteCells,
    startEdit,
    state.contextMenu,
    state.detailsDrawerOpen,
    state.drag,
    state.edit,
    state.focus,
    state.link
  ]);

  const handleLinkMove = useCallback(
    (clientX: number, clientY: number, hover?: { rowId: string; endpoint: GanttDependencyEndpoint }) => {
      if (!state.link) return;
      moveLink(clientX, clientY, hover);
    },
    [moveLink, state.link]
  );

  const linkPreviewType = state.link
    ? linkPreviewDependencyType(
        state.link.fromEndpoint,
        state.link.hoverToEndpoint
          ? { endpoint: state.link.hoverToEndpoint }
          : undefined
      )
    : null;
  const linkReadout = linkReadoutLabel(linkPreviewType);

  const setPreviewState = useCallback(
    (previewState: GanttPreviewState, previewMessage?: string) => {
      dispatch({
        type: "patch",
        patch: previewMessage !== undefined ? { previewState, previewMessage } : { previewState }
      });
    },
    [dispatch]
  );

  const contextItems = state.contextMenu
    ? buildContextMenuItems(state.contextMenu, {
        hasSelection: Boolean(state.selection || state.focus),
        canPaste: Boolean(state.clipboardBuffer),
        hasRow: Boolean(state.data.selectedRowId),
        hasDependency: Boolean(state.data.selectedDependencyId),
        linkModeAvailable: interactionMode === "interactive"
      })
    : [];

  return (
    <div
      className={cn(
        "gantt2__shell",
        state.link && "gantt2__shell--link-mode",
        selectedRow && "gantt2__shell--has-selection"
      )}
    >
      <div className="gantt2__main">
        {toolbarSlot ? toolbarSlot(controller.toolbarApi) : null}
        <GanttView
          data={displayData}
          {...(className ? { className } : {})}
          zoom={zoom}
          interactionMode={interactionMode}
          previewState={state.previewState}
          {...(state.previewMessage ? { previewMessage: state.previewMessage } : {})}
          showDependencies={state.flags.showDependencies}
          showBaseline={state.flags.showBaseline}
          showCriticalPath={state.flags.showCriticalPath}
          edit={state.edit}
          focus={state.focus}
          selection={state.selection}
          rowDrag={state.rowDrag}
          drag={state.drag}
          link={state.link}
          columnConfig={columns}
          onColumnResize={handleColumnResize}
          onColumnReorder={handleColumnReorder}
          {...(state.schedulingHint ? { schedulingHint: state.schedulingHint } : {})}
          onBarClick={selectTaskBar}
          onBarDoubleClick={openTaskDetails}
          onRowHeaderClick={handleRowHeaderClick}
          onCellClick={handleCellClick}
          onCellFocus={(cell) => focusCell(cell, false)}
          onContextMenu={handleContextMenu}
          onRowDragStart={startRowDrag}
          onRowDragOver={updateRowDrag}
          onRowDragEnd={endRowDrag}
          onAssignResource={(rowId, initials) => {
            const resource = initials
              ? findResourceByInitials(initials) ?? {
                  id: `custom-${initials}`,
                  name: initials,
                  initials,
                  color: "c1" as const
                }
              : null;
            assignResource(rowId, resource);
          }}
          onStartEdit={(rowId, field: GanttCellField) => startEdit(rowId, field)}
          onEditDraft={setEditDraft}
          onCommitEdit={commitEdit}
          onCancelEdit={cancelEdit}
          onToggleCollapse={toggleRowCollapse}
          onChartPointerDown={(rowId, kind, clientX, rect, dayW) => startDrag(rowId, kind, clientX, rect, dayW)}
          onChartPointerMove={(clientX) => moveDrag(clientX, DAY_W(zoom))}
          onChartPointerUp={endDrag}
          onLinkStart={(rowId, endpoint, clientX, clientY) => startLink(rowId, endpoint, clientX, clientY)}
          onLinkMove={handleLinkMove}
          onLinkComplete={completeLink}
          onLinkCancel={() => dispatch({ type: "patch", patch: { link: null } })}
          onDependencySelect={(id) =>
            dispatch({
              type: "patch",
              patch: {
                data: patchGanttData(state.data, { selectedDependencyId: id, selectedRowId: null })
              }
            })
          }
          onKeyNavigate={navigateRow}
        />
        {showApplyBar ? (
          <GanttApplyBar
            state={state.previewState}
            {...(state.previewMessage ? { message: state.previewMessage } : {})}
            {...(state.schedulingHint ? { schedulingHint: state.schedulingHint } : {})}
            onApply={() => setPreviewState("applied", "Изменения применены локально (mock)")}
            onCancel={() => {
              dispatch({ type: "patch", patch: { drag: null, previewState: "idle" } });
            }}
          />
        ) : null}
        {state.link && linkReadout ? (
          <div className="gantt2__link-readout" role="status" aria-live="polite">
            {linkReadout}
          </div>
        ) : null}
      </div>

      {showDrawer && state.detailsDrawerOpen ? (
        <button
          type="button"
          className="gantt2__drawer-backdrop"
          aria-label="Закрыть панель свойств"
          onClick={closeTaskDetails}
        />
      ) : null}

      {showDrawer ? (
        <TaskDetailsDrawer
          open={state.detailsDrawerOpen}
          row={selectedRow}
          dependencies={state.data.dependencies ?? []}
          dirty={dirty}
          onClose={closeTaskDetails}
          onCommitField={commitField}
          onUpdateDependency={updateDependency}
          onAssignResource={assignResource}
          {...(onOpenTaskCard && selectedRow
            ? { onOpenTaskCard: () => onOpenTaskCard(selectedRow.id) }
            : {})}
        />
      ) : null}

      <GanttContextMenu
        menu={state.contextMenu}
        items={contextItems}
        onAction={runContextAction}
        onClose={closeContextMenu}
      />
    </div>
  );
}

function DAY_W(zoom: GanttInteractiveProps["zoom"]) {
  return zoom === "month" ? 12 : zoom === "week" ? 18 : zoom === "hour" ? 44 : 20;
}

export { useGanttController } from "./gantt-state";
export type { GanttToolbarApi } from "./types";
