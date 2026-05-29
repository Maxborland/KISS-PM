import { describe, expect, it } from "vitest";

import { parseTsvPaste, rangeToTsv } from "./gantt-clipboard";
import type { GanttRow } from "./types";

const rows: GanttRow[] = [
  {
    id: "a",
    level: 0,
    kind: "task",
    name: "A",
    startDay: 0,
    durationDays: 2,
    progress: 0.5
  },
  {
    id: "b",
    level: 0,
    kind: "task",
    name: "B",
    startDay: 2,
    durationDays: 3,
    progress: 0
  }
];

describe("gantt clipboard", () => {
  it("exports TSV range", () => {
    const tsv = rangeToTsv(
      rows,
      ["a", "b"],
      { rowId: "a", field: "name" },
      { rowId: "b", field: "duration" }
    );
    expect(tsv).toContain("A");
    expect(tsv).toContain("3");
  });

  it("maps paste targets from anchor", () => {
    const targets = parseTsvPaste("99\t50", { rowId: "a", field: "progress" }, ["a", "b"]);
    expect(targets[0]).toEqual({ rowId: "a", field: "progress", value: "99" });
    expect(targets[1]).toEqual({ rowId: "a", field: "start", value: "50" });
  });
});
