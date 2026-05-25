import type { ControllerAction } from "./gantt-controller-reducer";
import { patchGanttData } from "./gantt-data-patch";
import { syncPredecessorLabels } from "./gantt-dependency-rules";
import { createLinkSession } from "./gantt-link-session";
import { shiftRowDates } from "./gantt-row-dnd";
import {
  createTaskRow,
  indentRow,
  insertTaskAbove,
  insertTaskBelow,
  moveRow,
  outdentRow
} from "./gantt-wbs";
import type {
  GanttChangeEvent,
  GanttContextAction,
  GanttContextMenuState,
  GanttControllerState,
  GanttData,
  GanttRow,
  GanttToolbarApi
} from "./types";

export type GanttToolbarContext = {
  state: GanttControllerState & { history: { past: unknown[]; future: unknown[] } };
  emit: (data: GanttData, event: GanttChangeEvent, record?: boolean) => void;
  dispatch: (action: ControllerAction) => void;
  commitRows: (rows: GanttRow[], event: GanttChangeEvent) => void;
  deleteSelectedRow: () => void;
  toggleTaskDetails: () => void;
  onChange?: (data: GanttData, event: GanttChangeEvent) => void;
};

export function buildGanttToolbarApi(ctx: GanttToolbarContext): GanttToolbarApi {
  const { state, emit, dispatch, commitRows, deleteSelectedRow, toggleTaskDetails } = ctx;

  return {
    addTask: () => {
      const rows = createTaskRow(state.data.rows, state.data.selectedRowId);
      const newId = rows.at(-1)?.id;
      emit(patchGanttData(state.data, { rows, ...(newId ? { selectedRowId: newId } : {}) }), {
        type: "rows-reorder"
      });
    },
    deleteTask: () => deleteSelectedRow(),
    indent: () => {
      if (!state.data.selectedRowId) return;
      commitRows(indentRow(state.data.rows, state.data.selectedRowId), { type: "indent" });
    },
    outdent: () => {
      if (!state.data.selectedRowId) return;
      commitRows(outdentRow(state.data.rows, state.data.selectedRowId), { type: "indent" });
    },
    moveUp: () => {
      if (!state.data.selectedRowId) return;
      commitRows(moveRow(state.data.rows, state.data.selectedRowId, -1), { type: "rows-reorder" });
    },
    moveDown: () => {
      if (!state.data.selectedRowId) return;
      commitRows(moveRow(state.data.rows, state.data.selectedRowId, 1), { type: "rows-reorder" });
    },
    linkTasks: () => {
      if (!state.data.selectedRowId) return;
      dispatch({
        type: "patch",
        patch: {
          link: createLinkSession(state.data.selectedRowId, "finish", 0, 0)
        }
      });
    },
    unlinkTasks: () => {
      const depId = state.data.selectedDependencyId;
      if (!depId) return;
      const dependencies = (state.data.dependencies ?? []).filter((d) => d.id !== depId);
      emit(
        patchGanttData(state.data, {
          dependencies,
          rows: syncPredecessorLabels(state.data.rows, dependencies),
          selectedDependencyId: null
        }),
        { type: "dependency-remove", dependencyId: depId }
      );
    },
    toggleCriticalPath: () =>
      dispatch({
        type: "patch",
        patch: { flags: { ...state.flags, showCriticalPath: !state.flags.showCriticalPath } }
      }),
    toggleBaseline: () =>
      dispatch({
        type: "patch",
        patch: { flags: { ...state.flags, showBaseline: !state.flags.showBaseline } }
      }),
    toggleDependencies: () =>
      dispatch({
        type: "patch",
        patch: { flags: { ...state.flags, showDependencies: !state.flags.showDependencies } }
      }),
    undo: () => {
      dispatch({ type: "undo" });
      ctx.onChange?.(state.data, { type: "undo" });
    },
    redo: () => {
      dispatch({ type: "redo" });
      ctx.onChange?.(state.data, { type: "redo" });
    },
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    flags: state.flags,
    previewState: state.previewState,
    ...(state.data.selectedRowId ? { selectedRowId: state.data.selectedRowId } : {}),
    ...(state.data.selectedDependencyId ? { selectedDependencyId: state.data.selectedDependencyId } : {}),
    rowCount: state.data.rows.length,
    linkMode: Boolean(state.link),
    toggleTaskDetails,
    taskDetailsOpen: state.detailsDrawerOpen
  };
}

export type GanttContextActionContext = GanttToolbarContext & {
  contextMenu: GanttContextMenuState | null;
  openTaskDetails: (rowId: string) => void;
  copyCells: () => void | Promise<void>;
  pasteCells: () => void | Promise<void>;
  clearCells: () => void;
  closeContextMenu: () => void;
};

export function runGanttContextAction(action: GanttContextAction, ctx: GanttContextActionContext): void {
  const menu = ctx.contextMenu;
  if (!menu) return;
  const rowId =
    menu.target.kind === "row" || menu.target.kind === "cell" || menu.target.kind === "bar"
      ? menu.target.rowId
      : ctx.state.data.selectedRowId;

  switch (action) {
    case "openTaskDetails":
      if (rowId) ctx.openTaskDetails(rowId);
      break;
    case "insertTaskAbove":
      if (rowId) ctx.emit({ ...ctx.state.data, rows: insertTaskAbove(ctx.state.data.rows, rowId) }, { type: "rows-reorder" });
      break;
    case "insertTaskBelow":
      if (rowId) ctx.emit({ ...ctx.state.data, rows: insertTaskBelow(ctx.state.data.rows, rowId) }, { type: "rows-reorder" });
      break;
    case "deleteTask":
      if (rowId) {
        ctx.dispatch({
          type: "patch",
          patch: { data: patchGanttData(ctx.state.data, { selectedRowId: rowId }) }
        });
      }
      ctx.deleteSelectedRow();
      break;
    case "copyCells":
      void ctx.copyCells();
      break;
    case "pasteCells":
      void ctx.pasteCells();
      break;
    case "clearCells":
      ctx.clearCells();
      break;
    case "shiftTaskRight":
      if (rowId) {
        const row = ctx.state.data.rows.find((r) => r.id === rowId);
        if (row) {
          const rows = ctx.state.data.rows.map((r) => (r.id === rowId ? shiftRowDates(r, 1) : r));
          ctx.commitRows(rows, { type: "edit-commit", rowId, field: "start" });
        }
      }
      break;
    case "shiftTaskLeft":
      if (rowId) {
        const row = ctx.state.data.rows.find((r) => r.id === rowId);
        if (row) {
          const rows = ctx.state.data.rows.map((r) => (r.id === rowId ? shiftRowDates(r, -1) : r));
          ctx.commitRows(rows, { type: "edit-commit", rowId, field: "start" });
        }
      }
      break;
    case "outdentTask":
      if (rowId) ctx.commitRows(outdentRow(ctx.state.data.rows, rowId), { type: "indent" });
      break;
    case "indentTask":
      if (rowId) ctx.commitRows(indentRow(ctx.state.data.rows, rowId), { type: "indent" });
      break;
    case "linkTasks":
      if (rowId) {
        ctx.dispatch({
          type: "patch",
          patch: { link: createLinkSession(rowId, "finish", 0, 0) }
        });
      }
      break;
    case "deleteDependency": {
      const depId =
        menu.target.kind === "dependency"
          ? menu.target.dependencyId
          : ctx.state.data.selectedDependencyId;
      if (depId) {
        const dependencies = (ctx.state.data.dependencies ?? []).filter((d) => d.id !== depId);
        ctx.emit(
          patchGanttData(ctx.state.data, {
            dependencies,
            rows: syncPredecessorLabels(ctx.state.data.rows, dependencies),
            selectedDependencyId: null
          }),
          { type: "dependency-remove", dependencyId: depId }
        );
      }
      break;
    }
    default:
      break;
  }
  ctx.closeContextMenu();
}
