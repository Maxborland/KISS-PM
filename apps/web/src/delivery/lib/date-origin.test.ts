import { describe, expect, it } from "vitest";

import {
  buildProjectMonthKeys,
  currentPlanDate,
  deriveScheduleTimeline,
  formatWeekLabel,
  isPlanItemOverdue,
  monthGridDays
} from "./date-origin";
import { dayToIso, isoToDay } from "./planning-demo-data";

describe("delivery date-origin helpers", () => {
  it("anchors schedule timeline to the project range and positions Today from injected current date", () => {
    const timeline = deriveScheduleTimeline({
      projectStartIso: "2026-05-13",
      projectFinishDay: isoToDay("2026-06-30"),
      rowStartDays: [isoToDay("2026-05-13")],
      rowFinishDays: [isoToDay("2026-06-30")],
      deadlineDay: isoToDay("2026-07-03"),
      todayIso: "2026-07-07"
    });

    expect(dayToIso(timeline.originDay)).toBe("2026-05-11");
    expect(formatWeekLabel(0, timeline.originDay)).toBe("Май 11");
    expect(timeline.todayOffsetDays).toBe(isoToDay("2026-07-07") - isoToDay("2026-05-11"));
    expect(timeline.totalDays).toBeGreaterThanOrEqual(timeline.todayOffsetDays);
  });

  it("ignores unscheduled sentinel rows (dayStart 0) when deriving the origin", () => {
    // An optimistic task.create row carries empty calculated dates → dayStart 0 / dayFinish 0
    // (day 0 = 1970-01-01). Including it would make Math.min pick 0 and jump the timeline to 1970.
    const scheduled = isoToDay("2026-05-13");
    const timeline = deriveScheduleTimeline({
      projectStartIso: "2026-05-13",
      projectFinishDay: isoToDay("2026-06-30"),
      rowStartDays: [0, scheduled],
      rowFinishDays: [0, isoToDay("2026-06-30")],
      todayIso: "2026-05-20"
    });

    expect(timeline.originDay).toBeGreaterThan(0);
    expect(dayToIso(timeline.originDay)).toBe("2026-05-11");
  });

  it("starts calendar month choices from the calculated project range, not March 2026", () => {
    expect(buildProjectMonthKeys({
      projectStartIso: "2026-05-13",
      projectFinishIso: "2026-06-30",
      calculatedStarts: ["2026-05-13", "2026-06-01"],
      calculatedFinishes: ["2026-05-29", "2026-06-30"],
      fallbackIso: "2026-07-07"
    })).toEqual(["2026-05", "2026-06"]);

    expect(monthGridDays("2026-05").slice(0, 7).map(dayToIso)).toEqual([
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
      "2026-05-03"
    ]);
  });

  it("checks overview overdue status against injected/current date", () => {
    expect(isPlanItemOverdue("2026-07-06", "2026-07-07")).toBe(true);
    expect(isPlanItemOverdue("2026-07-06", "2026-06-23")).toBe(false);
    expect(currentPlanDate(new Date(Date.UTC(2026, 6, 7, 12)))).toBe("2026-07-07");
  });
});
