import { describe, expect, it } from "vitest";

import { distribute, presetWeights } from "./assignments-editors";
import { parseResourceAssignmentHours } from "../resources/resource-load-matrix";
import {
  assignmentHoursInputValue,
  formatAssignmentHours,
  parseAssignmentHours,
  parseAssignmentUnits
} from "./assignments-surface";

describe("assignment distribution", () => {
  it("uses Hamilton allocation to preserve the exact rounded minute total", () => {
    const allocation = distribute(61.4, [1, 1, 1]);

    expect(allocation).toEqual([21, 20, 20]);
    expect(allocation.reduce((sum, minutes) => sum + minutes, 0)).toBe(61);
  });

  it("clamps negative work and weights without producing negative allocations", () => {
    expect(distribute(-30, [1, 1])).toEqual([0, 0]);
    expect(distribute(90, [1, -4, 2])).toEqual([30, 0, 60]);
  });

  it("provides even and mirrored front/back presets", () => {
    expect(presetWeights(4, "even")).toEqual([1, 1, 1, 1]);

    const front = presetWeights(4, "front");
    const back = presetWeights(4, "back");

    expect(front[0]).toBeCloseTo(1.4);
    expect(front.at(-1)).toBeCloseTo(0.6);
    expect(back).toEqual([...front].reverse());
  });

  it("distributes flat work over working days only and keeps the exact sum", () => {
    const workingDays = ["2026-07-06", "2026-07-07", "2026-07-09"];
    const minutes = distribute(125, presetWeights(workingDays.length, "even"));
    const byDay = new Map(workingDays.map((day, index) => [day, minutes[index]]));

    expect([...byDay.entries()]).toEqual([
      ["2026-07-06", 42],
      ["2026-07-07", 42],
      ["2026-07-09", 41]
    ]);
    expect(byDay.has("2026-07-08")).toBe(false);
    expect(minutes.reduce((sum, value) => sum + value, 0)).toBe(125);
  });
});

describe("assignment numeric fields", () => {
  it("preserves fractional hours in cells and inputs", () => {
    expect(formatAssignmentHours(216)).toBe("3,6");
    expect(assignmentHoursInputValue(90)).toBe(1.5);
    expect(parseAssignmentHours("1.5")).toBe(90);
  });

  it("rejects invalid numeric input and clamps valid boundaries", () => {
    expect(parseAssignmentHours("")).toBeNull();
    expect(parseAssignmentHours("not-a-number")).toBeNull();
    expect(parseAssignmentHours("-2")).toBe(0);
    expect(parseAssignmentUnits("0")).toBe(10);
    expect(parseAssignmentUnits("not-a-number")).toBeNull();
    expect(parseResourceAssignmentHours("1.5")).toBe(1.5);
    expect(parseResourceAssignmentHours("")).toBeNull();
    expect(parseResourceAssignmentHours("-1")).toBeNull();
  });
});
