import { describe, expect, it } from "vitest";

import { buildIndentMoveCommand, buildOutdentMoveCommand } from "./wbsIndentOutdent";
import type { WbsGridRow } from "./wbsRows";

function row(id: string, parentTaskId: string | null): WbsGridRow {
  return {
    id,
    wbsIndex: 1,
    wbsCode: id,
    title: id,
    durationLabel: "",
    start: null,
    finish: null,
    percentComplete: 0,
    assignmentsLabel: "",
    hasValidation: false,
    isCritical: false,
    task: { parentTaskId }
  };
}

describe("wbsIndentOutdent", () => {
  const rows = [row("a", null), row("b", null), row("c", "a")];

  it("indents under the row above", () => {
    expect(buildIndentMoveCommand(rows, "b")).toEqual({
      type: "task.move_wbs",
      payload: { taskId: "b", parentTaskId: "a", sortOrder: 1 }
    });
  });

  it("outdents to grandparents level after parent", () => {
    const hierarchy = [row("a", null), row("b", "a"), row("c", "b")];
    expect(buildOutdentMoveCommand(hierarchy, "c")).toEqual({
      type: "task.move_wbs",
      payload: { taskId: "c", parentTaskId: "a", sortOrder: 1 }
    });
  });

  it("returns null when indent is impossible", () => {
    expect(buildIndentMoveCommand(rows, "a")).toBeNull();
  });
});
