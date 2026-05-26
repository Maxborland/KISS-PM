import { describe, expect, it } from "vitest";

import {
  aggregateDayCells,
  aggregateRowPercent,
  computePeriodPercent,
  dayNormCapacityHours,
  resolveAggregateDayLoadLevel
} from "./aggregate-matrix";
import { RESOURCE_MATRIX_MOCK } from "./mock-data";
import type { DayCell, DayHeader, MatrixRow } from "./types";

const workday: DayHeader = { day: 3, weekdayShort: "Пн" };
const weekend: DayHeader = { day: 4, weekdayShort: "Сб", weekend: true };

function personRow(cells: DayCell[], dailyNormHours = 8): MatrixRow {
  return {
    id: "p1",
    kind: "person",
    name: "Тест",
    dailyNormHours,
    cells
  };
}

describe("aggregate-matrix", () => {
  it("resolveAggregateDayLoadLevel: уровень от Σназначено/Σнорма (экв. 8ч)", () => {
    expect(resolveAggregateDayLoadLevel(40, 40)).toBe("normal");
    expect(resolveAggregateDayLoadLevel(55, 40)).toBe("high");
    expect(resolveAggregateDayLoadLevel(80, 40)).toBe("over");
  });

  it("dayNormCapacityHours учитывает отпуск, выходной и свободный рабочий день", () => {
    expect(dayNormCapacityHours({ kind: "vacation" }, 8, workday)).toBe(0);
    expect(dayNormCapacityHours({ kind: "zero" }, 8, workday)).toBe(8);
    expect(dayNormCapacityHours({ kind: "load", hours: 7, level: "normal" }, 8, workday)).toBe(8);
    expect(dayNormCapacityHours({ kind: "load", hours: 7, level: "normal" }, 8, weekend)).toBe(0);
  });

  it("aggregateDayCells: перегруз одного не красит отдел при простое остальных", () => {
    const days: DayHeader[] = [workday];
    const rows = [
      personRow([{ kind: "zero" }], 8),
      personRow([{ kind: "zero" }], 8),
      personRow([{ kind: "zero" }], 8),
      personRow([{ kind: "load", hours: 16.9, level: "over" }], 8)
    ];
    const cells = aggregateDayCells(rows, days);
    expect(cells[0]).toMatchObject({ kind: "load", hours: 16.9, level: "normal" });
  });

  it("aggregateDayCells: сумма часов и уровень от Σназначено/Σнорма", () => {
    const days: DayHeader[] = [workday];
    const rows = [
      personRow([{ kind: "load", hours: 8, level: "normal" }], 8),
      personRow([{ kind: "load", hours: 8, level: "normal" }], 8),
      personRow([{ kind: "vacation" }], 8)
    ];
    const cells = aggregateDayCells(rows, days);
    expect(cells[0]).toMatchObject({ kind: "load", hours: 16, level: "normal" });
  });

  it("aggregateRowPercent: доля за период", () => {
    const days: DayHeader[] = [workday];
    const rows = [personRow([{ kind: "load", hours: 8, level: "normal" }], 8)];
    const pct = aggregateRowPercent(rows, days);
    expect(pct.value).toBe(100);
    expect(pct.level).toBe("high");
  });

  it("computePeriodPercent: дробный % при неполной загрузке", () => {
    const days: DayHeader[] = [workday, { day: 4, weekdayShort: "Вт" }];
    const rows = [
      personRow(
        [
          { kind: "load", hours: 7.6, level: "normal" },
          { kind: "load", hours: 7.6, level: "normal" }
        ],
        8
      )
    ];
    const period = computePeriodPercent(rows, days);
    expect(period.value).toBe(95);
    expect(period.label).toContain("15.2");
    expect(period.label).toContain("16");
  });

  it("computePeriodPercent: свободные рабочие дни снижают % ниже 100", () => {
    const days: DayHeader[] = [
      workday,
      { day: 4, weekdayShort: "Вт" },
      { day: 5, weekdayShort: "Ср" },
      { day: 6, weekdayShort: "Чт" }
    ];
    const rows = [
      personRow(
        [
          { kind: "load", hours: 8, level: "normal" },
          { kind: "zero" },
          { kind: "zero" },
          { kind: "zero" }
        ],
        8
      )
    ];
    const period = computePeriodPercent(rows, days);
    expect(period.value).toBe(25);
    expect(period.level).not.toBe("high");
  });

  it("mock: у визуализаторов агрегат дня с одним перегруженным — не over", () => {
    const visualGroup = RESOURCE_MATRIX_MOCK.rows.find((r) => r.id === "g-visual");
    const overDay = visualGroup?.cells.find(
      (c): c is Extract<typeof c, { kind: "load" }> => c.kind === "load" && c.hours === 16.9
    );
    expect(overDay?.level).toBe("normal");
  });

  it("mock: при свободных днях месячный % сотрудника < 100", () => {
    const abramov = RESOURCE_MATRIX_MOCK.rows.find((r) => r.id === "p-ad");
    expect(abramov?.percent?.value).toBeLessThan(100);
  });
});
