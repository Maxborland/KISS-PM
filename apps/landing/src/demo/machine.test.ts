import { describe, expect, it } from "vitest";
import { ORDER, goTo, initialState, next, reset } from "./machine";

describe("demo machine", () => {
  it("starts at crm-list with one visited step", () => {
    const s = initialState();
    expect(s.step).toBe("crm-list");
    expect(s.visited).toEqual(["crm-list"]);
  });

  it("walks the full contour through next()", () => {
    let s = initialState();
    for (const step of ORDER.slice(1)) {
      s = next(s);
      expect(s.step).toBe(step);
    }
    expect(s.visited).toEqual(ORDER);
  });

  it("clamps next() at the last step", () => {
    let s = initialState();
    for (let i = 0; i < ORDER.length + 3; i += 1) s = next(s);
    expect(s.step).toBe("audit");
  });

  it("goTo records visited but stays idempotent", () => {
    const s1 = goTo(initialState(), "signal");
    expect(s1.step).toBe("signal");
    expect(s1.visited).toContain("signal");
    const s2 = goTo(s1, "signal");
    expect(s2).toBe(s1);
  });

  it("reset returns to initial state", () => {
    expect(reset()).toEqual(initialState());
  });
});
