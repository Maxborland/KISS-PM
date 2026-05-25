import { describe, expect, it } from "vitest";

import {
  DEFAULT_GANTT_COLUMNS,
  loadGanttColumnSettings,
  reorderColumns,
  resizeColumn,
  saveGanttColumnSettings
} from "./gantt-column-settings";

describe("gantt column settings", () => {
  it("resizeColumn clamps width", () => {
    const next = resizeColumn(DEFAULT_GANTT_COLUMNS, "name", 999);
    const name = next.find((c) => c.id === "name");
    expect(name?.width).toBe(480);
  });

  it("reorderColumns swaps order indices", () => {
    const next = reorderColumns(DEFAULT_GANTT_COLUMNS, "duration", "start");
    const duration = next.find((c) => c.id === "duration");
    const start = next.find((c) => c.id === "start");
    expect(duration).toBeDefined();
    expect(start).toBeDefined();
    expect(duration!.order).not.toBe(
      DEFAULT_GANTT_COLUMNS.find((c) => c.id === "duration")!.order
    );
  });

  it("persists via localStorage when available", () => {
    if (typeof localStorage === "undefined") return;
    const key = "kiss-pm-gantt-column-settings-v1";
    const prev = localStorage.getItem(key);
    try {
      const resized = resizeColumn(DEFAULT_GANTT_COLUMNS, "wbs", 120);
      saveGanttColumnSettings(resized);
      expect(loadGanttColumnSettings().find((c) => c.id === "wbs")?.width).toBe(120);
    } finally {
      if (prev === null) localStorage.removeItem(key);
      else localStorage.setItem(key, prev);
    }
  });
});
