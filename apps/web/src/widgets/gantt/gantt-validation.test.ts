import { describe, expect, it } from "vitest";

import { validateCell, validateDuration, validateProgress } from "./gantt-validation";
import type { GanttRow } from "./types";

const task: GanttRow = {
  id: "t",
  level: 1,
  kind: "task",
  name: "T",
  startDay: 0,
  durationDays: 3
};

const milestone: GanttRow = { ...task, kind: "milestone", durationDays: 0 };

describe("validateDuration", () => {
  it("rejects negative duration", () => {
    expect(validateDuration("-1", task)).toBeDefined();
  });

  it("requires zero for milestone", () => {
    expect(validateDuration("2", milestone)).toMatch(/вех/i);
  });
});

describe("validateProgress", () => {
  it("rejects out of range", () => {
    expect(validateProgress("120")).toBeDefined();
    expect(validateProgress("50")).toBeUndefined();
  });
});

describe("validateCell dates", () => {
  it("flags invalid date format", () => {
    expect(validateCell("start", "32.13.2026", task)).toMatch(/формат/i);
    expect(validateCell("start", "12.05.2026", task)).toBeUndefined();
  });
});
