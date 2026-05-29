import { describe, expect, it } from "vitest";

import { formatPlanDate } from "./task-api-validation";

describe("formatPlanDate", () => {
  it("formats local date parts instead of UTC date parts", () => {
    const date = new Date(2026, 5, 1);
    expect(formatPlanDate(date)).toBe("2026-06-01");
  });
});
