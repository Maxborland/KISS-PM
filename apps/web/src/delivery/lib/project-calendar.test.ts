import { describe, expect, it } from "vitest";

import {
  isCalendarWorkingWeekday,
  isProjectWorkingDate,
  resolveProjectCalendar
} from "./project-calendar";

const first = {
  id: "calendar-first",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};
const selected = {
  id: "calendar-selected",
  workingWeekdays: [2, 3, 4, 5, 6],
  workingMinutesPerDay: 360
};

describe("project calendar resolution", () => {
  it("uses only project.calendarId and supports a non-5x8 working week", () => {
    expect(
      resolveProjectCalendar({
        project: { calendarId: selected.id },
        calendars: [first, selected]
      })
    ).toEqual(selected);
    expect(isCalendarWorkingWeekday(selected, 1)).toBe(false);
    expect(isCalendarWorkingWeekday(selected, 6)).toBe(true);
    expect(isProjectWorkingDate(selected, "2026-07-04")).toBe(true);
    expect(isProjectWorkingDate(selected, "2026-07-06")).toBe(false);
    expect(
      isProjectWorkingDate(selected, "2026-07-04", new Set(["2026-07-04"]))
    ).toBe(false);
  });

  it("does not fabricate or fall back to the first calendar", () => {
    expect(
      resolveProjectCalendar({
        project: { calendarId: "calendar-missing" },
        calendars: [first]
      })
    ).toBeNull();
    expect(
      resolveProjectCalendar({
        project: { calendarId: null },
        calendars: [first]
      })
    ).toBeNull();
  });
});
