import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOURS_PER_DAY,
  deriveHoursPerDay,
  deriveWorkHours,
  updateTaskDuration,
  updateTaskFinishDate,
  updateTaskStartDate,
  updateTaskWorkHours
} from "./gantt-effort";
import type { GanttRow } from "./types";

const base: GanttRow = {
  id: "t1",
  level: 1,
  kind: "task",
  name: "Test",
  startDay: 0,
  durationDays: 5,
  effortMode: "auto"
};

describe("gantt effort", () => {
  it("derives 40h for 5 days auto", () => {
    const row = updateTaskDuration(base, 5);
    expect(deriveWorkHours(row)).toBe(5 * DEFAULT_HOURS_PER_DAY);
  });

  it("custom 20h over 5 days => 4h/day", () => {
    const row = updateTaskWorkHours(base, 20);
    expect(row.effortMode).toBe("custom");
    expect(deriveHoursPerDay(row)).toBe(4);
  });

  it("finish date change recalculates duration in auto mode", () => {
    const row = updateTaskFinishDate(base, "10.05.2026");
    expect(row?.durationDays).toBe(10);
    expect(deriveWorkHours(row!)).toBe(80);
  });

  it("start date commit preserves the inclusive finish date", () => {
    const row = updateTaskStartDate({ ...base, startDay: 0, durationDays: 3 }, "01.05.2026");
    expect(row?.durationDays).toBe(3);
  });
});
