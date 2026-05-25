import { describe, expect, it } from "vitest";

import { escapeActionPriority, resolveGanttKeyboardAction } from "./gantt-keyboard-policy";

const emptyCtx = {
  edit: null,
  link: null,
  drag: null,
  contextMenu: null,
  detailsDrawerOpen: false,
  focus: null
};

describe("gantt keyboard policy", () => {
  it("Escape cancels link before edit", () => {
    const action = resolveGanttKeyboardAction(
      { key: "Escape", ctrlKey: false, metaKey: false, shiftKey: false },
      { ...emptyCtx, link: {}, edit: { rowId: "a", field: "name", draft: "" } }
    );
    expect(action).toEqual({ type: "cancelLink" });
  });

  it("Escape closes drawer only when nothing else active", () => {
    const action = resolveGanttKeyboardAction(
      { key: "Escape", ctrlKey: false, metaKey: false, shiftKey: false },
      { ...emptyCtx, detailsDrawerOpen: true }
    );
    expect(action).toEqual({ type: "closeTaskDetails" });
  });

  it("escapeActionPriority matches resolve order", () => {
    expect(escapeActionPriority({ ...emptyCtx, link: {}, detailsDrawerOpen: true })).toBe("cancelLink");
    expect(escapeActionPriority({ ...emptyCtx, edit: {}, detailsDrawerOpen: true })).toBe("cancelEdit");
    expect(escapeActionPriority({ ...emptyCtx, detailsDrawerOpen: true })).toBe("closeTaskDetails");
  });

  it("Delete ignored while editing", () => {
    const action = resolveGanttKeyboardAction(
      { key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false },
      { ...emptyCtx, edit: { rowId: "a", field: "name", draft: "" } }
    );
    expect(action).toBeNull();
  });

  it("Ctrl+Z maps to undo", () => {
    const action = resolveGanttKeyboardAction(
      { key: "z", ctrlKey: true, metaKey: false, shiftKey: false },
      emptyCtx
    );
    expect(action).toEqual({ type: "undo" });
  });

  it("Shift+ArrowDown extends selection navigation", () => {
    const action = resolveGanttKeyboardAction(
      { key: "ArrowDown", ctrlKey: false, metaKey: false, shiftKey: true },
      { ...emptyCtx, focus: { rowId: "t1", field: "name" } }
    );
    expect(action).toEqual({ type: "navigateCell", direction: "down", extend: true });
  });
});
