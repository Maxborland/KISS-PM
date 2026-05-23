import { describe, expect, it } from "vitest";

import { parseMonthIso } from "./monthIso";

describe("parseMonthIso", () => {
  it("accepts valid months", () => {
    expect(parseMonthIso("2026-05")).toBe("2026-05");
    expect(parseMonthIso("2026-12")).toBe("2026-12");
  });

  it("rejects invalid month numbers", () => {
    expect(parseMonthIso("2026-00")).toBeNull();
    expect(parseMonthIso("2026-13")).toBeNull();
    expect(parseMonthIso("2026-99")).toBeNull();
  });
});
