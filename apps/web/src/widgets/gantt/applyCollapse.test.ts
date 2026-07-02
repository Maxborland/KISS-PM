import { expect, test } from "vitest";

import { applyCollapse } from "./gantt";
import type { GanttRow } from "./types";

function row(id: string, parentId?: string): GanttRow {
  return {
    id,
    ...(parentId ? { parentId } : {}),
    level: parentId ? 1 : 0,
    kind: parentId ? "task" : "summary",
    name: id,
    startDay: 0,
    durationDays: 1
  };
}

// Дерево: A → (A1, A2 → A2a), B
const rows: GanttRow[] = [
  row("A"),
  row("A1", "A"),
  row("A2", "A"),
  row("A2a", "A2"),
  row("B")
];

test("без свёрнутых узлов возвращает все строки", () => {
  expect(applyCollapse(rows, new Set()).map((r) => r.id)).toEqual(["A", "A1", "A2", "A2a", "B"]);
});

test("сворачивание A скрывает всех потомков, включая внуков", () => {
  const visible = applyCollapse(rows, new Set(["A"]));
  expect(visible.map((r) => r.id)).toEqual(["A", "B"]);
  expect(visible.find((r) => r.id === "A")?.collapsed).toBe(true);
});

test("сворачивание промежуточного узла скрывает только его ветку", () => {
  const visible = applyCollapse(rows, new Set(["A2"]));
  expect(visible.map((r) => r.id)).toEqual(["A", "A1", "A2", "B"]);
  expect(visible.find((r) => r.id === "A2")?.collapsed).toBe(true);
  expect(visible.find((r) => r.id === "A1")?.collapsed).toBeUndefined();
});
