import { describe, expect, it } from "vitest";

import { recalculateWorkModel } from "./workModel";

describe("work model", () => {
  it("keeps units fixed and recalculates duration", () => {
    expect(
      recalculateWorkModel({
        taskType: "fixed_units",
        effortDriven: false,
        workMinutes: 960,
        durationMinutes: 480,
        unitsPermille: 1000,
        changedField: "workMinutes"
      })
    ).toMatchObject({ workMinutes: 960, durationMinutes: 960, unitsPermille: 1000 });
  });

  it("keeps work fixed and recalculates duration for effort-driven unit changes", () => {
    expect(
      recalculateWorkModel({
        taskType: "fixed_work",
        effortDriven: true,
        workMinutes: 960,
        durationMinutes: 960,
        unitsPermille: 2000,
        changedField: "unitsPermille"
      })
    ).toMatchObject({ workMinutes: 960, durationMinutes: 480, unitsPermille: 2000 });
  });

  it("keeps duration fixed and recalculates units", () => {
    expect(
      recalculateWorkModel({
        taskType: "fixed_duration",
        effortDriven: false,
        workMinutes: 960,
        durationMinutes: 480,
        unitsPermille: 1000,
        changedField: "workMinutes"
      })
    ).toMatchObject({ workMinutes: 960, durationMinutes: 480, unitsPermille: 2000 });
  });
});
