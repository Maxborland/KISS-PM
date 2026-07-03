import { describe, expect, it } from "vitest";

import {
  classifyOccupancyForDate,
  maskOccupancyWindow,
  occupancyMinutesForDate,
  type OccupancyWindow
} from "./occupancy";

describe("occupancy", () => {
  it("calculates minute overlap per UTC day", () => {
    const window = createWindow({
      startsAt: "2026-06-01T23:30:00.000Z",
      finishesAt: "2026-06-02T00:45:00.000Z"
    });

    expect(occupancyMinutesForDate(window, "2026-06-01")).toBe(30);
    expect(occupancyMinutesForDate(window, "2026-06-02")).toBe(45);
    expect(occupancyMinutesForDate(window, "2026-06-03")).toBe(0);
  });

  it("pro-rates explicit work minutes across an interval", () => {
    const window = createWindow({
      startsAt: "2026-06-01T09:00:00.000Z",
      finishesAt: "2026-06-01T11:00:00.000Z",
      workMinutes: 60
    });

    expect(occupancyMinutesForDate(window, "2026-06-01")).toBe(60);
  });

  it("masks private and busy-only metadata", () => {
    const privateWindow = createWindow({
      visibility: "private",
      title: "Личная встреча",
      entityType: "meeting",
      entityId: "meeting-secret"
    });

    expect(maskOccupancyWindow(privateWindow, "full")).toMatchObject({
      title: "Занято",
      entityType: null,
      entityId: null
    });
  });

  describe("classifyOccupancyForDate (KPI-006 policy)", () => {
    it("treats busy windows as load-bearing", () => {
      const window = createWindow({
        startsAt: "2026-06-01T09:00:00.000Z",
        finishesAt: "2026-06-01T10:00:00.000Z",
        capacityImpact: "busy"
      });

      expect(classifyOccupancyForDate(window, "2026-06-01")).toEqual({
        kind: "load",
        workMinutes: 60
      });
    });

    it("treats unavailable windows as capacity reduction, not load", () => {
      const window = createWindow({
        startsAt: "2026-06-01T09:00:00.000Z",
        finishesAt: "2026-06-01T10:00:00.000Z",
        capacityImpact: "unavailable"
      });

      expect(classifyOccupancyForDate(window, "2026-06-01")).toEqual({
        kind: "unavailable",
        workMinutes: 60
      });
    });

    it("ignores tentative windows entirely", () => {
      const window = createWindow({
        startsAt: "2026-06-01T09:00:00.000Z",
        finishesAt: "2026-06-01T10:00:00.000Z",
        capacityImpact: "tentative"
      });

      expect(classifyOccupancyForDate(window, "2026-06-01")).toEqual({
        kind: "ignored",
        workMinutes: 0
      });
    });

    it("ignores windows that do not overlap the date", () => {
      const window = createWindow({
        startsAt: "2026-06-01T09:00:00.000Z",
        finishesAt: "2026-06-01T10:00:00.000Z",
        capacityImpact: "busy"
      });

      expect(classifyOccupancyForDate(window, "2026-06-05")).toEqual({
        kind: "ignored",
        workMinutes: 0
      });
    });
  });
});

function createWindow(overrides: Partial<OccupancyWindow> = {}): OccupancyWindow {
  return {
    id: "occupancy-a",
    tenantId: "tenant-alpha",
    resourceId: "resource-alpha",
    sourceType: "personal_calendar_event",
    sourceId: "event-a",
    startsAt: "2026-06-01T09:00:00.000Z",
    finishesAt: "2026-06-01T09:30:00.000Z",
    workMinutes: null,
    capacityImpact: "busy",
    visibility: "busy_only",
    title: "Busy",
    entityType: null,
    entityId: null,
    ...overrides
  };
}
