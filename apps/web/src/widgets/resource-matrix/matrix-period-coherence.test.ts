import { describe, expect, it } from "vitest";

import {
  aggregatePeriodTotals,
  computePeriodPercent,
  personRowsInGroup,
  sumLoadHoursInRow
} from "./aggregate-matrix";
import { RESOURCE_MATRIX_MOCK } from "./mock-data";

function sumAggregateRowLoadHours(rowId: string): number {
  const row = RESOURCE_MATRIX_MOCK.rows.find((r) => r.id === rowId);
  if (!row) return 0;
  return row.cells.reduce((acc, cell) => (cell.kind === "load" ? acc + cell.hours : acc), 0);
}

describe("matrix period hours coherence", () => {
  const days = RESOURCE_MATRIX_MOCK.days;
  const persons = RESOURCE_MATRIX_MOCK.rows.filter((r) => r.kind === "person");
  const archPersons = persons.filter((p) => p.parentId === "g-arch");
  const visualPersons = persons.filter((p) => p.parentId === "g-visual");

  it("сводка «Назначено» = Σ load-ячеек всех сотрудников", () => {
    const { assignedHours } = aggregatePeriodTotals(persons, days);
    const fromCells = persons.reduce((acc, row) => acc + sumLoadHoursInRow(row), 0);
    expect(RESOURCE_MATRIX_MOCK.stats.assignedHours).toBe(assignedHours);
    expect(assignedHours).toBe(fromCells);
  });

  it("сводка «Ёмкость» = Σ нормо-часов по календарю", () => {
    const { capacityHours } = aggregatePeriodTotals(persons, days);
    expect(RESOURCE_MATRIX_MOCK.stats.capacityHours).toBe(capacityHours);
  });

  it("сводка loadPct согласована с часами", () => {
    const { assignedHours, capacityHours } = aggregatePeriodTotals(persons, days);
    const pct = Math.round((assignedHours / capacityHours) * 100);
    expect(RESOURCE_MATRIX_MOCK.stats.loadPct).toBe(pct);
  });

  it("месячная сумма в строке мастерской = сумма по сотрудникам", () => {
    const workshopSum = sumAggregateRowLoadHours("g-workshop");
    const teamSum = aggregatePeriodTotals(persons, days).assignedHours;
    expect(workshopSum).toBeCloseTo(teamSum, 2);
  });

  it("месячная сумма роли = сумма её сотрудников", () => {
    const archSum = sumAggregateRowLoadHours("g-arch");
    const archTotal = aggregatePeriodTotals(archPersons, days).assignedHours;
    expect(archSum).toBeCloseTo(archTotal, 2);
  });

  it("% строки = Σназначено/Σнорма за период (один знак после запятой)", () => {
    const archGroup = RESOURCE_MATRIX_MOCK.rows.find((r) => r.id === "g-arch");
    expect(archGroup).toBeDefined();
    const scoped = personRowsInGroup(archGroup!, RESOURCE_MATRIX_MOCK.rows);
    const period = computePeriodPercent(scoped, days);
    const { assignedHours, capacityHours } = aggregatePeriodTotals(archPersons, days);
    const expected = Math.round((assignedHours / capacityHours) * 1000) / 10;
    expect(period.value).toBe(expected);
    expect(period.assignedHours).toBeCloseTo(assignedHours, 2);
    expect(period.capacityHours).toBe(capacityHours);
  });

  it("мастерская = архитекторы + визуализаторы по часам", () => {
    const workshop = aggregatePeriodTotals(persons, days).assignedHours;
    const arch = aggregatePeriodTotals(archPersons, days).assignedHours;
    const visual = aggregatePeriodTotals(visualPersons, days).assignedHours;
    expect(workshop).toBe(Math.round((arch + visual) * 100) / 100);
  });
});
