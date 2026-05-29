import { attachPlanningIssues } from "./gantt-planning-issues";
import { withAutoEffort } from "./gantt-effort";
import { syncPredecessorLabels } from "./gantt-dependency-rules";
import type { GanttControllerState, GanttData } from "./types";

export const MAX_UNDO = 40;

export type History = { past: GanttData[]; future: GanttData[] };

export type InternalState = GanttControllerState & { history: History };

export type ControllerAction =
  | { type: "patch"; patch: Partial<GanttControllerState>; record?: boolean }
  | { type: "set-data"; data: GanttData; record?: boolean }
  | { type: "undo" }
  | { type: "redo" };

export function cloneData(data: GanttData): GanttData {
  return structuredClone(data);
}

export function enrichData(data: GanttData): GanttData {
  const deps = data.dependencies ?? [];
  const rows = attachPlanningIssues(
    data.rows.map((r) => withAutoEffort(r)),
    deps
  );
  return { ...data, rows: syncPredecessorLabels(rows, deps) };
}

export function withHistory(state: InternalState, nextData: GanttData, record: boolean): InternalState {
  const enriched = enrichData(nextData);
  if (!record) return { ...state, data: enriched };
  const past = [...state.history.past, cloneData(state.data)].slice(-MAX_UNDO);
  return { ...state, data: enriched, history: { past, future: [] } };
}

export function controllerReducer(state: InternalState, action: ControllerAction): InternalState {
  switch (action.type) {
    case "patch": {
      const next = { ...state, ...action.patch };
      if (action.patch.data) {
        return { ...next, data: enrichData(action.patch.data) };
      }
      return next;
    }
    case "set-data": {
      return withHistory(state, action.data, action.record ?? true);
    }
    case "undo": {
      const prev = state.history.past.at(-1);
      if (!prev) return state;
      return {
        ...state,
        data: prev,
        history: {
          past: state.history.past.slice(0, -1),
          future: [cloneData(state.data), ...state.history.future]
        },
        edit: null,
        drag: null,
        link: null
      };
    }
    case "redo": {
      const next = state.history.future[0];
      if (!next) return state;
      return {
        ...state,
        data: next,
        history: {
          past: [...state.history.past, cloneData(state.data)],
          future: state.history.future.slice(1)
        },
        edit: null,
        drag: null,
        link: null
      };
    }
    default:
      return state;
  }
}
