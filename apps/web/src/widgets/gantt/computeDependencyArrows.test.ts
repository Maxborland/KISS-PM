import { expect, test } from "vitest";

import { computeDependencyArrows } from "./gantt";
import type { GanttRow } from "./types";

function row(id: string, startDay: number, durationDays: number, predecessorIds?: string[]): GanttRow {
  return {
    id,
    level: 0,
    kind: "task",
    name: id,
    startDay,
    durationDays,
    ...(predecessorIds ? { predecessorIds } : {})
  };
}

const DAY = 28;

test("строит стрелку от конца бара предшественника к началу бара преемника", () => {
  const rows: GanttRow[] = [
    row("A", 0, 3), // конец = день 3 → x = 84
    row("B", 5, 2, ["A"]) // начало = день 5 → x = 140
  ];
  const arrows = computeDependencyArrows(rows, DAY);
  expect(arrows).toEqual([
    { key: "A->B", fromRow: 0, toRow: 1, fromX: 3 * DAY, toX: 5 * DAY }
  ]);
});

test("пропускает предшественника вне видимых строк (свёрнут)", () => {
  const rows: GanttRow[] = [row("B", 5, 2, ["A-hidden"])];
  expect(computeDependencyArrows(rows, DAY)).toEqual([]);
});

test("несколько предшественников у одной задачи", () => {
  const rows: GanttRow[] = [
    row("A", 0, 2),
    row("B", 3, 2),
    row("C", 6, 1, ["A", "B"])
  ];
  const arrows = computeDependencyArrows(rows, DAY);
  expect(arrows.map((a) => a.key)).toEqual(["A->C", "B->C"]);
  expect(arrows.every((a) => a.toRow === 2)).toBe(true);
});
