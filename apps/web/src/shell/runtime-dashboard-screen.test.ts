import { describe, expect, it } from "vitest";

import { getScheduledTaskDailyWorkMinutes } from "@/shell/runtime-dashboard-screen";

describe("getScheduledTaskDailyWorkMinutes", () => {
  it("uses the full scheduled work for a single-day task", () => {
    expect(
      getScheduledTaskDailyWorkMinutes(
        {
          plannedStart: "2026-05-30",
          plannedFinish: "2026-05-30",
          workMinutes: 480
        },
        "2026-05-30"
      )
    ).toBe(480);
  });

  it("uses only the daily slice for a task spanning multiple days", () => {
    expect(
      getScheduledTaskDailyWorkMinutes(
        {
          plannedStart: "2026-05-30",
          plannedFinish: "2026-06-03",
          workMinutes: 2400
        },
        "2026-05-30"
      )
    ).toBe(480);
  });

  it("ignores tasks outside the selected day", () => {
    expect(
      getScheduledTaskDailyWorkMinutes(
        {
          plannedStart: "2026-05-30",
          plannedFinish: "2026-06-03",
          workMinutes: 2400
        },
        "2026-06-04"
      )
    ).toBe(0);
  });
});
