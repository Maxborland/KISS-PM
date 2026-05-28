import type { GanttFocusCell } from "./types";

export type GanttKeyboardKeyInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type GanttKeyboardContext = {
  edit: unknown | null;
  link: unknown | null;
  drag: unknown | null;
  contextMenu: unknown | null;
  detailsDrawerOpen: boolean;
  focus: GanttFocusCell | null;
  activeGrid: boolean;
};

export type GanttKeyboardAction =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "copyCells" }
  | { type: "pasteCells" }
  | { type: "clearCells" }
  | { type: "cancelLink" }
  | { type: "cancelEdit" }
  | { type: "cancelDrag" }
  | { type: "closeContextMenu" }
  | { type: "closeTaskDetails" }
  | { type: "startEdit" }
  | { type: "navigateCell"; direction: "up" | "down" | "left" | "right"; extend: boolean };

export function resolveGanttKeyboardAction(
  input: GanttKeyboardKeyInput,
  ctx: GanttKeyboardContext
): GanttKeyboardAction | null {
  const mod = input.ctrlKey || input.metaKey;

  if (mod && input.key === "z" && ctx.activeGrid && !ctx.edit) {
    return { type: "undo" };
  }
  if (mod && (input.key === "y" || (input.shiftKey && input.key === "Z")) && ctx.activeGrid && !ctx.edit) {
    return { type: "redo" };
  }
  if (mod && input.key === "c" && ctx.activeGrid) {
    return { type: "copyCells" };
  }
  if (mod && input.key === "v" && ctx.activeGrid) {
    return { type: "pasteCells" };
  }

  if (input.key === "Delete" && ctx.activeGrid) {
    if (ctx.edit) return null;
    return { type: "clearCells" };
  }

  if (input.key === "Escape") {
    if (ctx.link) return { type: "cancelLink" };
    if (ctx.edit) return { type: "cancelEdit" };
    if (ctx.drag) return { type: "cancelDrag" };
    if (ctx.contextMenu) return { type: "closeContextMenu" };
    if (ctx.detailsDrawerOpen) return { type: "closeTaskDetails" };
    return null;
  }

  if (input.key === "Enter" && ctx.activeGrid && ctx.focus && !ctx.edit) {
    return { type: "startEdit" };
  }

  if (input.shiftKey && input.key === "ArrowDown") {
    return { type: "navigateCell", direction: "down", extend: true };
  }
  if (input.shiftKey && input.key === "ArrowUp") {
    return { type: "navigateCell", direction: "up", extend: true };
  }
  if (input.shiftKey && input.key === "ArrowLeft") {
    return { type: "navigateCell", direction: "left", extend: true };
  }
  if (input.shiftKey && input.key === "ArrowRight") {
    return { type: "navigateCell", direction: "right", extend: true };
  }

  return null;
}

/** Escape priority: link → edit → drag → menu → drawer */
export function escapeActionPriority(ctx: GanttKeyboardContext): GanttKeyboardAction["type"] | null {
  if (ctx.link) return "cancelLink";
  if (ctx.edit) return "cancelEdit";
  if (ctx.drag) return "cancelDrag";
  if (ctx.contextMenu) return "closeContextMenu";
  if (ctx.detailsDrawerOpen) return "closeTaskDetails";
  return null;
}
