import { describe, expect, it } from "vitest";

import { tryCompleteLink } from "./gantt-link-session";
import type { GanttData } from "./types";

const data: GanttData = {
  days: [],
  rows: [
    { id: "a", level: 0, kind: "task", name: "A", startDay: 0, durationDays: 2 },
    { id: "b", level: 0, kind: "task", name: "B", startDay: 2, durationDays: 2 }
  ],
  dependencies: [{ id: "dep-100", fromId: "x", toId: "y", type: "FS" }]
};

describe("tryCompleteLink", () => {
  it("keeps dependency ids unique when a timestamp id is already present", () => {
    const result = tryCompleteLink({
      link: { fromId: "a", fromEndpoint: "finish", pointerX: 0, pointerY: 0 },
      data,
      visibleRowIds: new Set(["a", "b"]),
      toId: "b",
      toEndpoint: "start",
      now: 100
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dependency.id).not.toBe("dep-100");
    expect(result.dependency.id).toMatch(/^dep-100-/);
  });
});
