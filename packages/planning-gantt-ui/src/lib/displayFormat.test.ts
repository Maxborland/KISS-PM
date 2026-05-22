import { describe, expect, it } from "vitest";

import {
  dependencyTypeFromRussianLabel,
  formatDurationMinutes,
  formatPredecessors,
  lagMinutesToDisplay,
  parseDurationToMinutes,
  parsePredecessors
} from "./displayFormat";

describe("display format helpers", () => {
  it("maps Russian dependency labels to stable command values", () => {
    expect(dependencyTypeFromRussianLabel("ОН")).toBe("FS");
    expect(dependencyTypeFromRussianLabel("НН")).toBe("SS");
    expect(dependencyTypeFromRussianLabel("ОО")).toBe("FF");
    expect(dependencyTypeFromRussianLabel("НО")).toBe("SF");
  });

  it("parses and formats predecessor labels with lag in working minutes", () => {
    const predecessors = parsePredecessors("3ОН+2д, 7НН-4ч, task-xSF");

    expect(predecessors).toEqual([
      { taskRef: "3", type: "FS", lagMinutes: 960 },
      { taskRef: "7", type: "SS", lagMinutes: -240 },
      { taskRef: "task-x", type: "SF", lagMinutes: 0 }
    ]);
    expect(formatPredecessors(predecessors)).toBe("3ОН+2д, 7НН-4ч, task-xНО");
  });

  it("formats simple FS predecessors without extra type noise", () => {
    expect(formatPredecessors([{ taskRef: "2", type: "FS", lagMinutes: 0 }])).toBe("2");
  });

  it("parses and formats Russian durations as working minutes", () => {
    expect(parseDurationToMinutes("5д")).toBe(2400);
    expect(parseDurationToMinutes("2ч")).toBe(120);
    expect(parseDurationToMinutes("1н")).toBe(2400);
    expect(formatDurationMinutes(2400)).toBe("5д");
    expect(formatDurationMinutes(120)).toBe("2ч");
    expect(lagMinutesToDisplay(-480)).toBe("-1д");
  });
});
