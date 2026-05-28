import { describe, expect, it } from "vitest";

import { tokensToDependencies } from "./gantt-predecessor-text";
import type { GanttRow } from "./types";

const rows: GanttRow[] = [
  { id: "a", level: 0, kind: "task", name: "A", startDay: 0, durationDays: 2 },
  { id: "b", level: 0, kind: "task", name: "B", startDay: 2, durationDays: 2 },
  { id: "c", level: 0, kind: "task", name: "C", startDay: 4, durationDays: 2 }
];

describe("tokensToDependencies", () => {
  it("does not reuse ids from replaced predecessor dependencies", () => {
    const result = tokensToDependencies(
      "b",
      [{ rowNumber: 1, type: "FS", lagDays: 0 }],
      rows,
      [{ id: "dep-a-b-FS-0", fromId: "a", toId: "b", type: "SS" }]
    );

    expect(result.error).toBeUndefined();
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]?.id).not.toBe("dep-a-b-FS-0");
    expect(result.dependencies[0]?.id).toMatch(/^dep-a-b-FS-0-/);
  });

  it("resolves row numbers against the visible rows passed by the grid", () => {
    const result = tokensToDependencies(
      "a",
      [{ rowNumber: 2, type: "FS", lagDays: 0 }],
      [rows[0]!, rows[2]!],
      []
    );

    expect(result.error).toBeUndefined();
    expect(result.dependencies[0]).toMatchObject({ fromId: "c", toId: "a" });
  });

  it("rejects cycles from text edits", () => {
    const result = tokensToDependencies(
      "a",
      [{ rowNumber: 3, type: "FS", lagDays: 0 }],
      rows,
      [
        { id: "dep-a-b", fromId: "a", toId: "b", type: "FS" },
        { id: "dep-b-c", fromId: "b", toId: "c", type: "FS" }
      ]
    );

    expect(result.error).toBe("Такая связь создаёт циклическую зависимость");
  });
});
