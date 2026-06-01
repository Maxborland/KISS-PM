import { describe, expect, it } from "vitest";

import {
  isBeforeDateOnly,
  isNonTerminalProjectStatus
} from "./operationsCockpitReadRepository";

describe("operations cockpit read repository", () => {
  it("does not mark work due today as overdue before the date ends", () => {
    expect(
      isBeforeDateOnly(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-01T15:00:00.000Z")
      )
    ).toBe(false);
  });

  it("marks work due on a previous date as overdue", () => {
    expect(
      isBeforeDateOnly(
        new Date("2026-05-31T00:00:00.000Z"),
        new Date("2026-06-01T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("excludes tasks from terminal or missing project statuses", () => {
    expect(isNonTerminalProjectStatus("active")).toBe(true);
    expect(isNonTerminalProjectStatus("draft")).toBe(true);
    expect(isNonTerminalProjectStatus("paused")).toBe(true);
    expect(isNonTerminalProjectStatus("closed")).toBe(false);
    expect(isNonTerminalProjectStatus("cancelled")).toBe(false);
    expect(isNonTerminalProjectStatus(null)).toBe(false);
  });
});
