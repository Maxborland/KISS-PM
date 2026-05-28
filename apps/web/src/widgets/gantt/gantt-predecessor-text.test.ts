import { describe, expect, it } from "vitest";

import { tokensToDependencies } from "./gantt-predecessor-text";
import type { GanttRow } from "./types";

const rows: GanttRow[] = [
  { id: "a", level: 0, kind: "task", name: "A", startDay: 0, durationDays: 2 },
  { id: "b", level: 0, kind: "task", name: "B", startDay: 2, durationDays: 2 }
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
});
