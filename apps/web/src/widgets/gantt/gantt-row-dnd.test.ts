import { describe, expect, it } from "vitest";

import { reorderRowsByDrag, rowSubtreeIds } from "./gantt-row-dnd";
import type { GanttRow } from "./types";

const rows: GanttRow[] = [
  { id: "s", level: 0, kind: "summary", name: "S", startDay: 0, durationDays: 5, collapsible: true },
  { id: "c1", level: 1, kind: "task", name: "C1", startDay: 0, durationDays: 2 },
  { id: "c2", level: 1, kind: "task", name: "C2", startDay: 2, durationDays: 2 },
  { id: "t", level: 0, kind: "task", name: "T", startDay: 4, durationDays: 1 }
];

describe("rowSubtreeIds", () => {
  it("includes summary children", () => {
    expect(rowSubtreeIds(rows, "s")).toEqual(["s", "c1", "c2"]);
  });
});

describe("reorderRowsByDrag", () => {
  it("moves row before target", () => {
    const next = reorderRowsByDrag(rows, "t", "s");
    expect(next?.map((r) => r.id)).toEqual(["t", "s", "c1", "c2"]);
  });

  it("blocks drop into own subtree", () => {
    expect(reorderRowsByDrag(rows, "s", "c1")).toBeNull();
  });

  it("moves child rows only within the same summary parent", () => {
    const next = reorderRowsByDrag(rows, "c2", "c1");
    expect(next?.map((r) => r.id)).toEqual(["s", "c2", "c1", "t"]);
  });

  it("blocks top-level rows from dropping before another summary child", () => {
    expect(reorderRowsByDrag(rows, "t", "c1")).toBeNull();
  });

  it("blocks child rows from appending outside their summary parent", () => {
    expect(reorderRowsByDrag(rows, "c1", null)).toBeNull();
  });
});
