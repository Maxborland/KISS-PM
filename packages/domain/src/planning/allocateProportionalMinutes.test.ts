import { expect, test } from "vitest";

import { allocateProportionalMinutes } from "./resourcePlanning";

const equalDays = [
  { date: "2026-06-01", capacityMinutes: 480 },
  { date: "2026-06-02", capacityMinutes: 480 },
  { date: "2026-06-03", capacityMinutes: 480 }
];

// KPI-004: Σ по дням должна ТОЧНО равняться total (без дрейфа округления).
test("распределяет без потери минут: 100 на 3 равных дня → 34+33+33 = 100", () => {
  const perDay = equalDays.map((d) => allocateProportionalMinutes(100, equalDays, d.date));
  expect(perDay).toEqual([34, 33, 33]);
  expect(perDay.reduce((a, b) => a + b, 0)).toBe(100);
});

test("сумма долей равна total для неравной ёмкости", () => {
  const days = [
    { date: "2026-06-01", capacityMinutes: 300 },
    { date: "2026-06-02", capacityMinutes: 120 },
    { date: "2026-06-03", capacityMinutes: 60 }
  ];
  const total = 137; // намеренно «некруглое»
  const sum = days
    .map((d) => allocateProportionalMinutes(total, days, d.date))
    .reduce((a, b) => a + b, 0);
  expect(sum).toBe(total);
});

test("нулевая ёмкость и нулевой total дают 0", () => {
  expect(allocateProportionalMinutes(0, equalDays, "2026-06-01")).toBe(0);
  expect(
    allocateProportionalMinutes(100, [{ date: "2026-06-01", capacityMinutes: 0 }], "2026-06-01")
  ).toBe(0);
});
