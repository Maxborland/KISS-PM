import { describe, expect, it } from "vitest";

import {
  formatPredecessorText,
  parsePredecessorText,
  parsePredecessorTextError
} from "./predecessor-text";

describe("parsePredecessorText", () => {
  it("parses FS with lag", () => {
    expect(parsePredecessorText("3FS+2d")).toEqual([
      { rowNumber: 3, type: "FS", lagDays: 2 }
    ]);
  });

  it("parses SS with lead", () => {
    expect(parsePredecessorText("4SS-1d")).toEqual([
      { rowNumber: 4, type: "SS", lagDays: -1 }
    ]);
  });

  it("rejects invalid token", () => {
    expect(parsePredecessorTextError("foo")).toMatch(/Формат/i);
  });
});

describe("formatPredecessorText", () => {
  it("formats lag suffix", () => {
    expect(formatPredecessorText(3, "FS", 2)).toBe("3+2d");
    expect(formatPredecessorText(3, "SS", -1)).toBe("3SS-1d");
  });
});
