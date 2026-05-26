import { describe, expect, it } from "vitest";

import {
  dateToX,
  generateTimelineTiers,
  getDayWidth,
  getProjectDateRange,
  getTimelineWidth,
  xToDate
} from "./timelineScale";
import type { PlanningGanttTaskRow } from "../types/viewModel";

describe("timeline scale helpers", () => {
  it("keeps BR2-compatible day widths", () => {
    expect(getDayWidth("hour")).toBe(120);
    expect(getDayWidth("day")).toBe(30);
    expect(getDayWidth("week")).toBe(8);
    expect(getDayWidth("month")).toBe(3);
  });

  it("converts dates to pixels and back from the range start", () => {
    expect(dateToX("2026-06-06", "2026-06-01", 30)).toBe(150);
    expect(xToDate(150, "2026-06-01", 30)).toBe("2026-06-06");
  });

  it("derives padded project range from planned and baseline dates", () => {
    const tasks = [
      task({ plannedStart: "2026-06-10", plannedFinish: "2026-06-12" }),
      task({ plannedStart: "2026-06-15", plannedFinish: "2026-06-18", baselineFinish: "2026-06-20" })
    ];

    expect(getProjectDateRange(tasks, "2026-06-01")).toEqual({
      start: "2026-06-03",
      finish: "2026-07-04"
    });
  });

  it("generates Russian month tier, day cells, weekend markers and width", () => {
    const tiers = generateTimelineTiers("2026-06-01", "2026-06-08", 30, "2026-06-03");

    expect(tiers.top).toEqual([{ label: "июнь 2026 г.", x: 0, width: 210 }]);
    expect(tiers.bottom).toHaveLength(7);
    expect(tiers.bottom.filter((cell) => cell.isWeekend).map((cell) => cell.label)).toEqual(["6", "7"]);
    expect(tiers.todayX).toBe(60);
    expect(getTimelineWidth("2026-06-01", "2026-06-08", 30)).toBe(210);
  });
});

function task(patch: Partial<PlanningGanttTaskRow>): PlanningGanttTaskRow {
  return {
    id: "task",
    parentTaskId: null,
    wbsCode: "1",
    title: "Task",
    statusId: "todo",
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart: null,
    plannedFinish: null,
    durationMinutes: null,
    workMinutes: 0,
    percentComplete: 0,
    baselineStart: null,
    baselineFinish: null,
    baselineWorkMinutes: null,
    startVarianceDays: null,
    finishVarianceDays: null,
    workVarianceMinutes: null,
    isSummary: false,
    isMilestone: false,
    isCritical: false,
    slackMinutes: null,
    validationIssueIds: [],
    ...patch
  };
}
