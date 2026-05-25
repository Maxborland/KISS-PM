import { describe, expect, it } from "vitest";

import { barEndpointX, barFinishX, barStartX, buildDependencyPaths } from "./gantt-dependency-paths";
import type { GanttRow } from "./types";

const row = (id: string, startDay: number, durationDays: number, kind: GanttRow["kind"] = "task"): GanttRow => ({
  id,
  level: 1,
  kind,
  name: id,
  startDay,
  durationDays
});

describe("buildDependencyPaths", () => {
  it("FS no overlap: 5-segment via target-adjacent channel, arrow right", () => {
    const rows = [row("a", 0, 3), row("b", 5, 2)];
    const [p] = buildDependencyPaths(rows, [{ id: "d", fromId: "a", toId: "b", type: "FS" }], 28);
    expect(p?.d).toMatch(/^M \d+ \d+ H \d+ V \d+ H \d+ V \d+ H \d+$/);
    expect(p?.arrowDir).toBe("right");
  });

  it("FS overlap: 5-segment via row-gap channel", () => {
    const rows = [row("a", 0, 5), row("b", 2, 3)];
    const [p] = buildDependencyPaths(rows, [{ id: "d", fromId: "a", toId: "b", type: "FS" }], 28);
    expect(p?.d).toMatch(/^M \d+ \d+ H \d+ V \d+ H \d+ V \d+ H \d+$/);
    expect(p?.arrowDir).toBe("right");
  });

  it("SS: arrow points right (into target.start from left)", () => {
    const rows = [row("a", 5, 3), row("b", 5, 3)];
    const [p] = buildDependencyPaths(rows, [{ id: "d", fromId: "a", toId: "b", type: "SS" }], 28);
    expect(p?.arrowDir).toBe("right");
  });

  it("FF: arrow points left (into target.finish from right)", () => {
    const rows = [row("a", 0, 3), row("b", 0, 3)];
    const [p] = buildDependencyPaths(rows, [{ id: "d", fromId: "a", toId: "b", type: "FF" }], 28);
    expect(p?.arrowDir).toBe("left");
  });

  it("SF: arrow points left (into target.finish from right)", () => {
    const rows = [row("a", 5, 3), row("b", 0, 3)];
    const [p] = buildDependencyPaths(rows, [{ id: "d", fromId: "a", toId: "b", type: "SF" }], 28);
    expect(p?.arrowDir).toBe("left");
  });

  it("milestone endpoint: start=left edge, finish=left+12px", () => {
    const m = row("m", 4, 0, "milestone");
    expect(barEndpointX(m, "start", 28)).toBe(4 * 28);
    expect(barEndpointX(m, "finish", 28)).toBe(4 * 28 + 12);
    expect(barFinishX(m, 28)).toBe(4 * 28);
    expect(barStartX(m, 28)).toBe(4 * 28);
  });
});
