import { describe, expect, it } from "vitest";

import { isValidOpportunityProbability } from "./deals-surface";

describe("new opportunity validation", () => {
  it.each(["0", "40", "100"])("accepts integer probability %s", (value) => {
    expect(isValidOpportunityProbability(value)).toBe(true);
  });

  it.each(["", "-1", "100.5", "101", "Infinity", "not-a-number"])(
    "rejects invalid probability %s before submit",
    (value) => {
      expect(isValidOpportunityProbability(value)).toBe(false);
    }
  );
});
