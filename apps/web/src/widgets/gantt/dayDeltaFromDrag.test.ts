import { expect, test } from "vitest";

import { dayDeltaFromDrag } from "./gantt";

const DAY = 28;

test("округляет смещение в днях по ширине дня", () => {
  expect(dayDeltaFromDrag(0, DAY)).toBe(0);
  expect(dayDeltaFromDrag(28, DAY)).toBe(1);
  expect(dayDeltaFromDrag(-56, DAY)).toBe(-2);
  expect(dayDeltaFromDrag(70, DAY)).toBe(3); // 2.5 → 3
});

test("малый сдвиг (клик, < полдня) даёт 0 — не двигаем задачу случайно", () => {
  expect(dayDeltaFromDrag(10, DAY)).toBe(0); // 0.36 дня
  expect(dayDeltaFromDrag(-13, DAY)).toBe(0);
});

test("нулевая ширина дня безопасна", () => {
  expect(dayDeltaFromDrag(100, 0)).toBe(0);
});
