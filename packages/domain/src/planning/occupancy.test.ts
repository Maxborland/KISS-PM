import { describe, expect, it } from "vitest";

import { maskOccupancyWindow, occupancyMinutesForDate, type OccupancyWindow } from "./occupancy";

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
