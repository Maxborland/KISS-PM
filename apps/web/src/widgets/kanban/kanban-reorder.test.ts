import { describe, expect, it } from "vitest";

import { kanbanInsertIndexById, reorderKanbanColumnByIds } from "./kanban-reorder";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("kanban reorder helpers", () => {
  it("resolves a visible moving id back to the manual bucket", () => {
    const reordered = reorderKanbanColumnByIds(items, 0, 0, "c", "a");
    expect(reordered.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("uses the hovered item id as an insert anchor", () => {
    expect(kanbanInsertIndexById(items, 0, "b")).toBe(1);
  });
});
