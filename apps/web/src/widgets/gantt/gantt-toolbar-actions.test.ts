import { describe, expect, it, vi } from "vitest";

import { buildGanttToolbarApi } from "./gantt-toolbar-actions";
import type { GanttData } from "./types";

type ToolbarContext = Parameters<typeof buildGanttToolbarApi>[0];

const data = (): GanttData => ({
  days: [{ day: 1, weekdayShort: "Пн" }],
  rows: [
    { id: "a", level: 0, kind: "summary", name: "A", startDay: 0, durationDays: 3 },
    { id: "b", level: 1, kind: "task", name: "B", startDay: 0, durationDays: 1 },
    { id: "c", level: 1, kind: "task", name: "C", startDay: 1, durationDays: 1 }
  ],
  selectedRowId: "b"
});

function ctx(overrides: Partial<ToolbarContext> = {}): ToolbarContext {
  const current = data();
  return {
    state: {
      data: current,
      previewState: "idle" as const,
      edit: null,
      focus: null,
      selection: null,
      drag: null,
      link: null,
      rowDrag: null,
      contextMenu: null,
      clipboardBuffer: null,
      flags: { showDependencies: true, showBaseline: false, showCriticalPath: true },
      pendingDeleteRowId: null,
      detailsDrawerOpen: false,
      history: { past: [], future: [] }
    },
    emit: vi.fn(),
    dispatch: vi.fn(),
    commitRows: vi.fn(),
    deleteSelectedRow: vi.fn(),
    toggleTaskDetails: vi.fn(),
    ...overrides
  };
}

describe("buildGanttToolbarApi", () => {
  it("selects the inserted task when adding after a middle row", () => {
    const emit = vi.fn<ToolbarContext["emit"]>();
    const context = ctx({ emit });
    buildGanttToolbarApi(context).addTask();

    const [nextData] = emit.mock.calls[0]!;
    expect(nextData.rows.map((row) => row.id)).toHaveLength(4);
    expect(nextData.rows[2]?.name).toBe("Новая задача");
    expect(nextData.selectedRowId).toBe(nextData.rows[2]?.id);
  });

  it("emits the post-undo data to external onChange", () => {
    const previous = { ...data(), selectedRowId: "a" };
    const onChange = vi.fn<NonNullable<ToolbarContext["onChange"]>>();
    const context = ctx({
      state: { ...ctx().state, history: { past: [previous], future: [] } },
      onChange
    });

    buildGanttToolbarApi(context).undo();

    expect(onChange).toHaveBeenCalledWith(previous, { type: "undo" });
  });

  it("emits the post-redo data to external onChange", () => {
    const next = { ...data(), selectedRowId: "c" };
    const onChange = vi.fn<NonNullable<ToolbarContext["onChange"]>>();
    const context = ctx({
      state: { ...ctx().state, history: { past: [], future: [next] } },
      onChange
    });

    buildGanttToolbarApi(context).redo();

    expect(onChange).toHaveBeenCalledWith(next, { type: "redo" });
  });
});
