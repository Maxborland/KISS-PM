import { describe, expect, it } from "vitest";

import { detectFillSeries } from "./detectFillSeries";

describe("detectFillSeries", () => {
  it("fills day increments for dd.mm dates", () => {
    const result = detectFillSeries("26.05", 4);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values).toEqual(["26.05", "27.05", "28.05", "29.05"]);
    }
  });

  it("fills number increments", () => {
    const result = detectFillSeries("5", 4);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values).toEqual(["5", "6", "7", "8"]);
    }
  });

  it("repeats text seeds", () => {
    const result = detectFillSeries("Sprint", 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values).toEqual(["Sprint", "Sprint", "Sprint"]);
    }
  });
});
