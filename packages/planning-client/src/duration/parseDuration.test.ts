import { describe, expect, it } from "vitest";

import { formatDurationMinutes, parseDurationOrWork } from "./parseDuration";

describe("parseDurationOrWork", () => {
  const workingMinutesPerDay = 8 * 60;

  it("parses RU and EN day/hour forms", () => {
    expect(parseDurationOrWork("5 дн", workingMinutesPerDay)).toEqual({
      ok: true,
      minutes: 5 * workingMinutesPerDay,
      unit: "day"
    });
    expect(parseDurationOrWork("40 ч", workingMinutesPerDay)).toEqual({
      ok: true,
      minutes: 40 * 60,
      unit: "hour"
    });
    expect(parseDurationOrWork("5d", workingMinutesPerDay)).toEqual({
      ok: true,
      minutes: 5 * workingMinutesPerDay,
      unit: "day"
    });
    expect(parseDurationOrWork("40h", workingMinutesPerDay)).toEqual({
      ok: true,
      minutes: 40 * 60,
      unit: "hour"
    });
  });

  it("formats minutes back to RU units", () => {
    expect(formatDurationMinutes(5 * workingMinutesPerDay, workingMinutesPerDay)).toBe("5 дн");
    expect(formatDurationMinutes(40 * 60, workingMinutesPerDay)).toBe("5 дн");
  });
});
