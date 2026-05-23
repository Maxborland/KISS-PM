import { describe, expect, it } from "vitest";

import {
  buildGanttTimelineScale,
  dateToTimelineX,
  diffUtcDaysBetween,
  timelineXToDate
} from "./ganttTimelineScale";

describe("ganttTimelineScale", () => {
  it("maps dates with 2-day padding on day zoom", () => {
    const scale = buildGanttTimelineScale({
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-10",
      zoom: "day"
    });
    expect(scale).not.toBeNull();
    if (!scale) return;
    expect(dateToTimelineX(scale, "2026-06-01")).toBe(80);
    expect(dateToTimelineX(scale, "2026-06-03")).toBe(160);
    expect(timelineXToDate(scale, 80)).toBe("2026-06-01");
  });

  it("diffUtcDaysBetween is non-negative", () => {
    expect(diffUtcDaysBetween("2026-06-01", "2026-05-01")).toBe(0);
    expect(diffUtcDaysBetween("2026-06-01", "2026-06-05")).toBe(4);
  });
});
