import { describe, expect, it } from "vitest";

import { addWorkingMinutesToInstant, diffWorkingMinutes, workingMinutesForDate } from "./workingTime";
import type { PlanCalendar } from "./types";

const calendar: PlanCalendar = {
  id: "calendar-default",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};

describe("working time", () => {
  it("adds working minutes across non-working days with minute precision", () => {
    expect(
      addWorkingMinutesToInstant(
        { date: "2026-06-05", minuteOfDay: 240 },
        480,
        calendar,
        []
      )
    ).toEqual({ date: "2026-06-08", minuteOfDay: 240 });
  });

  it("supports negative lag as working-time lead", () => {
    expect(
      addWorkingMinutesToInstant(
        { date: "2026-06-02", minuteOfDay: 120 },
        -600,
        calendar,
        []
      )
    ).toEqual({ date: "2026-06-01", minuteOfDay: 0 });
  });

  it("uses calendar exceptions when calculating capacity", () => {
    expect(
      workingMinutesForDate("2026-06-01", calendar, [
        {
          id: "exception-1",
          calendarId: "calendar-default",
          resourceId: null,
          date: "2026-06-01",
          workingMinutes: 0,
          reason: "holiday"
        }
      ])
    ).toBe(0);
  });

  it("calculates working-time diff across a weekend", () => {
    expect(
      diffWorkingMinutes(
        { date: "2026-06-05", minuteOfDay: 240 },
        { date: "2026-06-08", minuteOfDay: 240 },
        calendar,
        []
      )
    ).toBe(480);
  });
});
