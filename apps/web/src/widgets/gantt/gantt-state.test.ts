import { describe, expect, it } from "vitest";

import { parseProgressPercent } from "./gantt-validation";
import { toggleRowCollapsed, visibleRows } from "./gantt-wbs";
import type { GanttRow } from "./types";

describe("collapse local state", () => {
  const rows: GanttRow[] = [
    { id: "s", level: 0, kind: "summary", name: "S", startDay: 0, durationDays: 5, collapsible: true },
    { id: "t", level: 1, kind: "task", name: "T", startDay: 0, durationDays: 2 }
  ];

  it("toggleRowCollapsed reduces visible count", () => {
    const collapsed = toggleRowCollapsed(rows, "s");
    expect(visibleRows(collapsed)).toHaveLength(1);
    const expanded = toggleRowCollapsed(collapsed, "s");
    expect(visibleRows(expanded)).toHaveLength(2);
  });
});

describe("progress parsing for drawer/grid", () => {
  it("parses percent for commit", () => {
    expect(parseProgressPercent("75")).toBeCloseTo(0.75);
  });
});
