"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";

import { clearValueForField, parseTsvPaste, rangeToTsv } from "./gantt-clipboard";
import { controllerReducer, type InternalState } from "./gantt-controller-reducer";
import { patchGanttData } from "./gantt-data-patch";
import { syncPredecessorLabels } from "./gantt-dependency-rules";
import { applyCellCommit, cellDraft } from "./gantt-edit-session";
import {
  barDragHasChanges,
  computeBarDragPreview,
  createBarDragSession,
  rowAfterBarDragCommit
} from "./gantt-drag-session";
import { fieldIndex, GANTT_GRID_FIELDS, isGridField } from "./gantt-grid-fields";
import { createLinkSession, patchLinkPointer, tryCompleteLink } from "./gantt-link-session";
import { parsePredecessorText, tokensToDependencies } from "./gantt-predecessor-text";
import type { GanttResource } from "./gantt-resources";
import { reorderRowsByDrag } from "./gantt-row-dnd";
import { moveFocusCell, normalizeRange, singleCellRange } from "./gantt-selection";
import { buildGanttToolbarApi, runGanttContextAction } from "./gantt-toolbar-actions";
import { validateCell } from "./gantt-validation";
import {
  deleteRow,
  indentRow,
  outdentRow,
  renumberWbs,
  toggleRowCollapsed,
  visibleDependencies,
  visibleRows
} from "./gantt-wbs";
import type {
  GanttCellField,
  GanttChangeEvent,
  GanttContextAction,
  GanttContextTarget,
  GanttData,
  GanttDependency,
  GanttDependencyEndpoint,
  GanttDragKind,
  GanttFocusCell,
  GanttPreviewState,
  GanttRow,
  GanttToolbarApi,
  GanttViewFlags
} from "./types";

export type UseGanttControllerOptions = {
  initialData: GanttData;
  initialPreviewState?: GanttPreviewState;
  initialFlags?: Partial<GanttViewFlags>;
  onChange?: (data: GanttData, event: GanttChangeEvent) => void;
};

export function useGanttController(options: UseGanttControllerOptions) {
  const onChangeRef = useRef(options.onChange);
  onChangeRef.current = options.onChange;

  const [state, dispatch] = useReducer(controllerReducer, null, () => {
    const deps = options.initialData.dependencies ?? [];
    const data: GanttData = {
      ...options.initialData,
      rows: syncPredecessorLabels(options.initialData.rows, deps)
    };
    return {
      data,
      previewState: options.initialPreviewState ?? "idle",
      edit: null,
      focus: null,
      drag: null,
      link: null,
      flags: {
        showDependencies: options.initialFlags?.showDependencies ?? true,
        showBaseline: options.initialFlags?.showBaseline ?? false,
        showCriticalPath: options.initialFlags?.showCriticalPath ?? true
      },
      pendingDeleteRowId: null,
      detailsDrawerOpen: false,
      selection: null,
      rowDrag: null,
      contextMenu: null,
      clipboardBuffer: null,
      history: { past: [], future: [] }
    } satisfies InternalState;
  });

  const emit = useCallback((data: GanttData, event: GanttChangeEvent, record = true) => {
    dispatch({ type: "set-data", data, record });
    onChangeRef.current?.(data, event);
  }, []);

  const rowsVisible = useMemo(() => visibleRows(state.data.rows), [state.data.rows]);

  const selectedRow = useMemo(
    () => state.data.rows.find((r) => r.id === state.data.selectedRowId),
    [state.data.rows, state.data.selectedRowId]
  );

  const displayRows = useMemo(() => {
    if (state.flags.showCriticalPath) return rowsVisible;
    return rowsVisible.map((r) => ({ ...r, critical: false }));
  }, [rowsVisible, state.flags.showCriticalPath]);

  const displayDependencies = useMemo(
    () => visibleDependencies(state.data.dependencies ?? [], rowsVisible),
    [rowsVisible, state.data.dependencies]
  );

  const displayData: GanttData = useMemo(
    () => ({
      ...state.data,
      rows: displayRows,
      dependencies: displayDependencies
    }),
    [displayDependencies, state.data, displayRows]
  );

  const commitRows = useCallback(
    (rows: GanttRow[], event: GanttChangeEvent) => {
      const deps = state.data.dependencies ?? [];
      emit({ ...state.data, rows: syncPredecessorLabels(rows, deps) }, event);
    },
    [emit, state.data]
  );

  const selectRow = useCallback(
    (rowId: string | undefined, openDrawer = false) => {
      const data = patchGanttData(state.data, { selectedRowId: rowId ?? null, selectedDependencyId: null });
      dispatch({
        type: "patch",
        patch: {
          data,
          ...(openDrawer && rowId ? { detailsDrawerOpen: true } : {})
        }
      });
      onChangeRef.current?.(data, { type: "select-row", rowId });
    },
    [state.data]
  );

  const selectTaskBar = useCallback(
    (rowId: string) => {
      const data = patchGanttData(state.data, { selectedRowId: rowId, selectedDependencyId: null });
      dispatch({ type: "patch", patch: { data } });
      onChangeRef.current?.(data, { type: "select-row", rowId });
    },
    [state.data]
  );

  const openTaskDetails = useCallback(
    (rowId: string) => {
      const data = patchGanttData(state.data, { selectedRowId: rowId, selectedDependencyId: null });
      dispatch({ type: "patch", patch: { data, detailsDrawerOpen: true } });
      onChangeRef.current?.(data, { type: "select-row", rowId });
    },
    [state.data]
  );

  const toggleRowCollapse = useCallback(
    (rowId: string) => {
      const rows = toggleRowCollapsed(state.data.rows, rowId);
      emit({ ...state.data, rows }, { type: "collapse-toggle", rowId });
    },
    [emit, state.data]
  );

  const toggleTaskDetails = useCallback(() => {
    dispatch({ type: "patch", patch: { detailsDrawerOpen: !state.detailsDrawerOpen } });
  }, [state.detailsDrawerOpen]);

  const closeTaskDetails = useCallback(() => {
    dispatch({ type: "patch", patch: { detailsDrawerOpen: false } });
  }, []);

  const rowOrder = useMemo(() => rowsVisible.map((r) => r.id), [rowsVisible]);

  const commitField = useCallback(
    (rowId: string, field: GanttCellField, draft: string): string | undefined => {
      const row = state.data.rows.find((r) => r.id === rowId);
      if (!row) return "Строка не найдена";
      const error = validateCell(field, draft, row);
      if (error) return error;

      if (field === "predecessors") {
        const tokens = parsePredecessorText(draft);
        const { dependencies, error: depErr } = tokensToDependencies(
          rowId,
          tokens,
          state.data.rows,
          state.data.dependencies ?? []
        );
        if (depErr) return depErr;
        emit(
          {
            ...state.data,
            dependencies,
            rows: syncPredecessorLabels(state.data.rows, dependencies)
          },
          { type: "edit-commit", rowId, field }
        );
        if (state.edit?.rowId === rowId && state.edit.field === field) {
          dispatch({ type: "patch", patch: { edit: null, previewState: "editing-local" } });
        }
        return undefined;
      }

      const nextRow = applyCellCommit(row, field, draft);
      const rows = renumberWbs(state.data.rows.map((r) => (r.id === row.id ? nextRow : r)));
      emit(
        { ...state.data, rows: syncPredecessorLabels(rows, state.data.dependencies ?? []) },
        { type: "edit-commit", rowId: row.id, field }
      );
      if (state.edit?.rowId === rowId && state.edit.field === field) {
        dispatch({ type: "patch", patch: { edit: null, previewState: "editing-local" } });
      }
      return undefined;
    },
    [emit, state.data, state.edit]
  );

  const assignResource = useCallback(
    (rowId: string, resource: GanttResource | null) => {
      const row = state.data.rows.find((r) => r.id === rowId);
      if (!row || row.kind !== "task") return;
      const draft = resource?.initials ?? "";
      commitField(rowId, "resource", draft);
    },
    [commitField, state.data.rows]
  );

  const focusCell = useCallback(
    (cell: GanttFocusCell, extend = false) => {
      if (!isGridField(cell.field)) return;
      const selection = extend && state.selection
        ? normalizeRange({ anchor: state.selection.anchor, focus: cell }, rowOrder)
        : singleCellRange(cell);
      dispatch({
        type: "patch",
        patch: { focus: cell, selection, data: patchGanttData(state.data, { selectedRowId: cell.rowId }) }
      });
      onChangeRef.current?.(patchGanttData(state.data, { selectedRowId: cell.rowId }), {
        type: "select-row",
        rowId: cell.rowId
      });
    },
    [rowOrder, state.data, state.selection]
  );

  const navigateCell = useCallback(
    (direction: "up" | "down" | "left" | "right", extend: boolean) => {
      const current = state.focus ?? state.selection?.focus;
      if (!current) {
        const first = rowOrder[0];
        if (!first) return;
        focusCell({ rowId: first, field: "name" });
        return;
      }
      const next = moveFocusCell(current, direction, rowOrder);
      focusCell(next, extend);
    },
    [focusCell, rowOrder, state.focus, state.selection]
  );

  const copyCells = useCallback(async () => {
    const range = state.selection ?? (state.focus ? singleCellRange(state.focus) : null);
    if (!range) return;
    const tsv = rangeToTsv(state.data.rows, rowOrder, range.anchor, range.focus);
    dispatch({ type: "patch", patch: { clipboardBuffer: tsv } });
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      /* fallback: internal buffer */
    }
    onChangeRef.current?.(state.data, { type: "cells-copy" });
  }, [rowOrder, state.data, state.focus, state.selection]);

  const pasteCells = useCallback(async () => {
    const anchor = state.focus ?? state.selection?.anchor;
    if (!anchor) return;
    let tsv = state.clipboardBuffer ?? "";
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) tsv = clip;
    } catch {
      /* use buffer */
    }
    if (!tsv.trim()) return;

    const targets = parseTsvPaste(tsv, anchor, rowOrder);
    let rows = [...state.data.rows];
    let deps = [...(state.data.dependencies ?? [])];
    let lastError: string | undefined;

    for (const target of targets) {
      const row = rows.find((r) => r.id === target.rowId);
      if (!row) continue;
      const err = validateCell(target.field, target.value, row);
      if (err) {
        lastError = err;
        continue;
      }
      if (target.field === "predecessors") {
        const tokens = parsePredecessorText(target.value);
        const result = tokensToDependencies(target.rowId, tokens, rows, deps);
        if (result.error) {
          lastError = result.error;
          continue;
        }
        deps = result.dependencies;
        rows = syncPredecessorLabels(rows, deps);
        continue;
      }
      const nextRow = applyCellCommit(row, target.field, target.value);
      rows = rows.map((r) => (r.id === row.id ? nextRow : r));
    }

    rows = renumberWbs(rows);
    emit({ ...state.data, rows, dependencies: deps }, { type: "cells-paste" });
    dispatch({
      type: "patch",
      patch: lastError
        ? { previewState: "error", previewMessage: lastError }
        : { previewState: "editing-local" }
    });
  }, [emit, rowOrder, state.clipboardBuffer, state.data, state.focus, state.selection]);

  const clearCells = useCallback(() => {
    const range = state.selection ?? (state.focus ? singleCellRange(state.focus) : null);
    if (!range) return;
    const norm = normalizeRange(range, rowOrder);
    const r0 = rowOrder.indexOf(norm.anchor.rowId);
    const r1 = rowOrder.indexOf(norm.focus.rowId);
    const c0 = fieldIndex(norm.anchor.field);
    const c1 = fieldIndex(norm.focus.field);
    if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return;

    let rows = [...state.data.rows];
    let deps = [...(state.data.dependencies ?? [])];

    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 1) {
      const row = rows.find((item) => item.id === rowOrder[r]);
      if (!row) continue;
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c += 1) {
        const field = GANTT_GRID_FIELDS[c]!;
        if (row.kind === "summary" && (field === "duration" || field === "progress" || field === "resource")) continue;
        if (row.kind === "milestone" && field === "duration") continue;
        if (field === "predecessors") {
          deps = deps.filter((d) => d.toId !== row.id);
          continue;
        }
        const draft = clearValueForField(field);
        rows = rows.map((item) => (item.id === row.id ? applyCellCommit(item, field, draft) : item));
      }
    }

    emit(
      { ...state.data, rows: renumberWbs(syncPredecessorLabels(rows, deps)), dependencies: deps },
      { type: "cells-clear" }
    );
  }, [emit, rowOrder, state.data, state.focus, state.selection]);

  const updateDependency = useCallback(
    (dependencyId: string, patch: Partial<Pick<GanttDependency, "type" | "lagDays">>) => {
      const dependencies = (state.data.dependencies ?? []).map((d) =>
        d.id === dependencyId ? { ...d, ...patch } : d
      );
      emit(
        {
          ...state.data,
          dependencies,
          rows: syncPredecessorLabels(state.data.rows, dependencies)
        },
        { type: "dependency-update", dependencyId }
      );
    },
    [emit, state.data]
  );

  const startEdit = useCallback(
    (rowId: string, field: GanttCellField) => {
      const row = state.data.rows.find((r) => r.id === rowId);
      if (!row) return;
      dispatch({
        type: "patch",
        patch: {
          edit: { rowId, field, draft: cellDraft(row, field) },
          focus: { rowId, field },
          previewState: "editing-local"
        }
      });
    },
    [state.data.rows]
  );

  const setEditDraft = useCallback(
    (draft: string) => {
      if (!state.edit) return;
      const row = state.data.rows.find((r) => r.id === state.edit!.rowId);
      const error = row ? validateCell(state.edit.field, draft, row) : undefined;
      dispatch({
        type: "patch",
        patch: {
          edit: error
            ? { ...state.edit, draft, error }
            : { rowId: state.edit.rowId, field: state.edit.field, draft }
        }
      });
    },
    [state.edit, state.data.rows]
  );

  const commitEdit = useCallback((draftOverride?: string) => {
    if (!state.edit) return;
    const draft = draftOverride ?? state.edit.draft;
    const error = commitField(state.edit.rowId, state.edit.field, draft);
    if (error) {
      dispatch({ type: "patch", patch: { edit: { ...state.edit, draft, error } } });
    }
  }, [commitField, state.edit]);

  const cancelEdit = useCallback(() => {
    dispatch({ type: "patch", patch: { edit: null } });
  }, []);

  const chartRectRef = useRef<DOMRect | null>(null);

  const startDrag = useCallback(
    (rowId: string, kind: GanttDragKind, clientX: number, rect: DOMRect, _dayW: number) => {
      const row = state.data.rows.find((r) => r.id === rowId);
      if (!row || row.kind === "summary") return;
      chartRectRef.current = rect;
      dispatch({
        type: "patch",
        patch: {
          drag: createBarDragSession(row, kind, clientX),
          previewState: "preview-pending",
          schedulingHint: "Пересчёт сроков — только предпросмотр, серверный движок ещё не подключён"
        }
      });
    },
    [state.data.rows]
  );

  const moveDrag = useCallback(
    (clientX: number, dayW: number) => {
      if (!state.drag || !chartRectRef.current) return;
      const row = state.data.rows.find((r) => r.id === state.drag!.rowId);
      if (!row) return;
      const preview = computeBarDragPreview(
        state.drag,
        row,
        clientX,
        chartRectRef.current.left,
        dayW,
        state.data.days.length
      );
      dispatch({
        type: "patch",
        patch: {
          drag: { ...state.drag, ...preview },
          previewState: "preview-ready"
        }
      });
    },
    [state.data.days.length, state.data.rows, state.drag]
  );

  const endDrag = useCallback(() => {
    if (!state.drag) return;
    const row = state.data.rows.find((r) => r.id === state.drag!.rowId);
    if (!row) {
      dispatch({ type: "patch", patch: { drag: null } });
      return;
    }

    if (!barDragHasChanges(state.drag)) {
      dispatch({ type: "patch", patch: { drag: null, previewState: "idle", schedulingHint: "" } });
      return;
    }

    const nextRow = rowAfterBarDragCommit(row, state.drag);
    const rows = state.data.rows.map((r) => (r.id === row.id ? nextRow : r));
    emit(
      { ...state.data, rows: syncPredecessorLabels(rows, state.data.dependencies ?? []) },
      { type: "drag-commit", rowId: row.id, kind: state.drag.kind }
    );
    dispatch({
      type: "patch",
      patch: {
        drag: null,
        previewState: "preview-ready",
        schedulingHint: "Зависимые задачи не пересчитаны — серверный пересчёт ещё не подключён"
      }
    });
  }, [emit, state.data, state.drag]);

  const deleteSelectedRow = useCallback(() => {
    const id = state.data.selectedRowId;
    if (!id) return;
    const { rows, dependencies } = deleteRow(state.data.rows, id, state.data.dependencies ?? []);
    emit(
      patchGanttData(state.data, {
        rows: syncPredecessorLabels(rows, dependencies),
        dependencies,
        selectedRowId: null
      }),
      { type: "rows-reorder" }
    );
  }, [emit, state.data]);

  const toolbarApi: GanttToolbarApi = useMemo(
    () =>
      buildGanttToolbarApi({
        state,
        emit,
        dispatch,
        commitRows,
        deleteSelectedRow,
        toggleTaskDetails,
        ...(onChangeRef.current ? { onChange: onChangeRef.current } : {})
      }),
    [commitRows, deleteSelectedRow, emit, state, toggleTaskDetails]
  );

  const openContextMenu = useCallback((x: number, y: number, target: GanttContextTarget) => {
    dispatch({ type: "patch", patch: { contextMenu: { x, y, target } } });
  }, []);

  const closeContextMenu = useCallback(() => {
    dispatch({ type: "patch", patch: { contextMenu: null } });
  }, []);

  const runContextAction = useCallback(
    (action: GanttContextAction) => {
      runGanttContextAction(action, {
        state,
        emit,
        dispatch,
        commitRows,
        deleteSelectedRow,
        toggleTaskDetails,
        contextMenu: state.contextMenu,
        openTaskDetails,
        copyCells,
        pasteCells,
        clearCells,
        closeContextMenu
      });
    },
    [
      clearCells,
      closeContextMenu,
      commitRows,
      copyCells,
      deleteSelectedRow,
      emit,
      openTaskDetails,
      pasteCells,
      state,
      toggleTaskDetails
    ]
  );

  const startRowDrag = useCallback((rowId: string) => {
    dispatch({ type: "patch", patch: { rowDrag: { rowId, dropBeforeRowId: null, invalid: false } } });
  }, []);

  const updateRowDrag = useCallback(
    (targetRowId: string) => {
      if (!state.rowDrag) return;
      const invalid = state.rowDrag.rowId === targetRowId;
      dispatch({
        type: "patch",
        patch: { rowDrag: { ...state.rowDrag, dropBeforeRowId: targetRowId, invalid } }
      });
    },
    [state.rowDrag]
  );

  const endRowDrag = useCallback(() => {
    if (!state.rowDrag?.dropBeforeRowId) {
      dispatch({ type: "patch", patch: { rowDrag: null } });
      return;
    }
    const next = reorderRowsByDrag(state.data.rows, state.rowDrag.rowId, state.rowDrag.dropBeforeRowId);
    if (next) {
      const rows = renumberWbs(next);
      emit(
        { ...state.data, rows: syncPredecessorLabels(rows, state.data.dependencies ?? []) },
        { type: "row-drag-commit", rowId: state.rowDrag.rowId }
      );
    }
    dispatch({ type: "patch", patch: { rowDrag: null } });
  }, [emit, state.data, state.rowDrag]);

  const cancelDragSession = useCallback(() => {
    if (state.drag) {
      dispatch({ type: "patch", patch: { drag: null, previewState: "editing-local" } });
    }
  }, [state.drag]);

  const startLink = useCallback(
    (fromId: string, fromEndpoint: GanttDependencyEndpoint, pointerX: number, pointerY: number) => {
      dispatch({
        type: "patch",
        patch: { link: createLinkSession(fromId, fromEndpoint, pointerX, pointerY) }
      });
    },
    []
  );

  const moveLink = useCallback(
    (
      pointerX: number,
      pointerY: number,
      hover?: { rowId: string; endpoint: GanttDependencyEndpoint }
    ) => {
      if (!state.link) return;
      dispatch({ type: "patch", patch: { link: patchLinkPointer(state.link, pointerX, pointerY, hover) } });
    },
    [state.link]
  );

  const completeLink = useCallback(
    (toId: string, toEndpoint: GanttDependencyEndpoint) => {
      if (!state.link) return;
      const visibleRowIds = new Set(rowsVisible.map((r) => r.id));
      const result = tryCompleteLink({
        link: state.link,
        data: state.data,
        visibleRowIds,
        toId,
        toEndpoint
      });
      if (!result.ok) {
        dispatch({
          type: "patch",
          patch: { previewState: "error", previewMessage: result.message, link: null }
        });
        return;
      }
      const dependencies = [...(state.data.dependencies ?? []), result.dependency];
      emit(
        {
          ...state.data,
          dependencies,
          rows: syncPredecessorLabels(state.data.rows, dependencies)
        },
        { type: "dependency-add", dependencyId: result.dependency.id }
      );
      dispatch({ type: "patch", patch: { link: null, previewState: "editing-local" } });
    },
    [emit, rowsVisible, state.data, state.link]
  );

  return {
    displayData,
    state,
    selectedRow,
    rowsVisible,
    rowOrder,
    selectRow,
    selectTaskBar,
    openTaskDetails,
    toggleRowCollapse,
    toggleTaskDetails,
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
    toolbarApi,
    dispatch,
    emit
  };
}
