import { describe, expect, it } from "vitest";

import { clampDayIndex, dateLabelToDayIndex, dayIndexToDateLabel, finishDayIndex, snapDayFromPointer } from "./gantt-dates";
import type { GanttRow } from "./types";

describe("gantt-dates", () => {
  it("converts day index to label", () => {
    expect(dayIndexToDateLabel(11)).toBe("12.05.2026");
  });

  it("parses valid label", () => {
    expect(dateLabelToDayIndex("01.05.2026")).toBe(0);
    expect(dateLabelToDayIndex("bad")).toBeNull();
  });

  it("computes finish day for task and milestone", () => {
    const task: GanttRow = { id: "t", level: 0, kind: "task", name: "T", startDay: 2, durationDays: 4 };
    expect(finishDayIndex(task)).toBe(6);
    const mile: GanttRow = { ...task, kind: "milestone", durationDays: 0 };
    expect(finishDayIndex(mile)).toBe(2);
  });

  it("snaps pointer to day grid", () => {
    expect(snapDayFromPointer(140, 100, 28, 35)).toBe(1);
    expect(clampDayIndex(99, 35)).toBe(34);
  });
});
