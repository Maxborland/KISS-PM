import {
  LOAD_HOURS_NORMAL_MAX,
  resolvePersonDayLoadLevel,
  type DayLoadLevel
} from "./load-level";
import type { DayCell, DayHeader, MatrixPercent, MatrixRow, ResourceMatrixData } from "./types";

export type PeriodHoursTotals = {
  assignedHours: number;
  capacityHours: number;
};

/** Эталонная норма одного рабочего дня (ч) для перевода доли загрузки в уровень ячейки. */
export const REFERENCE_NORM_DAY_HOURS = LOAD_HOURS_NORMAL_MAX;

export function dayAssignedHours(cell: DayCell): number {
  return cell.kind === "load" ? cell.hours : 0;
}

/**
 * Нормо-часы ресурса в день.
 * Свободный рабочий день (`zero`, прочерк) входит в ёмкость месяца; назначений 0.
 * 0 только для выходных, праздников и отпуска.
 */
export function dayNormCapacityHours(
  cell: DayCell,
  dailyNormHours: number,
  day: DayHeader
): number {
  if (day.weekend || day.holiday) return 0;
  switch (cell.kind) {
    case "weekend":
    case "holiday":
    case "vacation":
      return 0;
    case "zero":
    case "load":
      return dailyNormHours;
  }
}

/** Уровень ячейки по сумме назначений / сумме нормо-часов группы за день. */
export function resolveAggregateDayLoadLevel(assignedHours: number, capacityHours: number): DayLoadLevel {
  if (capacityHours <= 0) {
    return assignedHours > REFERENCE_NORM_DAY_HOURS ? "over" : "normal";
  }
  const equivalentHours = (assignedHours / capacityHours) * REFERENCE_NORM_DAY_HOURS;
  return resolvePersonDayLoadLevel(equivalentHours);
}

export function resolveMatrixPercentLevel(value: number): MatrixPercent["level"] {
  if (value > 100) return "over";
  if (value >= 85) return "high";
  if (value < 70) return "low";
  if (value < 80) return "mid";
  return "norm";
}

function personDailyNorm(row: MatrixRow): number {
  return row.dailyNormHours ?? REFERENCE_NORM_DAY_HOURS;
}

/** Дневные ячейки агрегата (роль / мастерская) по дочерним person-rows. */
export function aggregateDayCells(personRows: MatrixRow[], days: DayHeader[]): DayCell[] {
  return days.map((day, dayIndex) => {
    if (day.weekend) return { kind: "weekend" };
    if (day.holiday) return { kind: "holiday" };

    let assigned = 0;
    let capacity = 0;
    let vacationOnly = 0;

    for (const row of personRows) {
      const cell = row.cells[dayIndex];
      if (!cell) continue;
      if (cell.kind === "vacation") vacationOnly += 1;
      assigned += dayAssignedHours(cell);
      capacity += dayNormCapacityHours(cell, personDailyNorm(row), day);
    }

    if (personRows.length > 0 && vacationOnly === personRows.length) {
      return { kind: "vacation" };
    }

    if (assigned === 0 && capacity === 0) {
      return { kind: "zero" };
    }

    const level = resolveAggregateDayLoadLevel(assigned, capacity);
    return {
      kind: "load",
      hours: assigned,
      level
    };
  });
}

/** Σ назначено / Σ нормо-часов за весь период (месяц) по person-rows. */
export function aggregatePeriodTotals(personRows: MatrixRow[], days: DayHeader[]): PeriodHoursTotals {
  let assignedHours = 0;
  let capacityHours = 0;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex]!;
    for (const row of personRows) {
      const cell = row.cells[dayIndex];
      if (!cell) continue;
      assignedHours += dayAssignedHours(cell);
      capacityHours += dayNormCapacityHours(cell, personDailyNorm(row), day);
    }
  }

  return {
    assignedHours: Math.round(assignedHours * 100) / 100,
    capacityHours: Math.round(capacityHours * 100) / 100
  };
}

/** Сумма часов из load-ячеек строки (должна совпадать с assigned за период для person). */
export function sumLoadHoursInRow(row: MatrixRow): number {
  let sum = 0;
  for (const cell of row.cells) {
    if (cell.kind === "load") sum += cell.hours;
  }
  return Math.round(sum * 100) / 100;
}

export type PeriodPercentView = MatrixPercent & {
  pctRaw: number;
  assignedHours: number;
  capacityHours: number;
  label: string;
};

/** % за период с подписью «назначено / ёмкость» (один знак после запятой). */
export function computePeriodPercent(personRows: MatrixRow[], days: DayHeader[]): PeriodPercentView {
  const { assignedHours, capacityHours } = aggregatePeriodTotals(personRows, days);
  const pctRaw = capacityHours > 0 ? (assignedHours / capacityHours) * 100 : 0;
  const value = Math.round(pctRaw * 10) / 10;
  const label = `${formatHoursRu(assignedHours)} / ${formatHoursRu(capacityHours)} ч (${value}%)`;
  return {
    value,
    level: resolveMatrixPercentLevel(pctRaw),
    pctRaw,
    assignedHours,
    capacityHours,
    label
  };
}

function formatHoursRu(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** % загрузки за период: Σ назначено / Σ нормо-часов. */
export function aggregateRowPercent(personRows: MatrixRow[], days: DayHeader[]): MatrixPercent {
  const { value, level } = computePeriodPercent(personRows, days);
  return { value, level };
}

/** Person-rows, входящие в группу (роль / мастерская). */
export function personRowsInGroup(anchor: MatrixRow, allRows: MatrixRow[]): MatrixRow[] {
  if (anchor.kind === "person") return [anchor];
  return allRows.filter((row) => {
    if (row.kind !== "person") return false;
    let parentId = row.parentId;
    while (parentId) {
      if (parentId === anchor.id) return true;
      parentId = allRows.find((r) => r.id === parentId)?.parentId;
    }
    return false;
  });
}

/** Сводка матрицы из тех же person-rows, что и таблица. */
export function computeMatrixStats(
  personRows: MatrixRow[],
  days: DayHeader[]
): ResourceMatrixData["stats"] {
  const { assignedHours, capacityHours } = aggregatePeriodTotals(personRows, days);
  const loadPctRaw = capacityHours > 0 ? (assignedHours / capacityHours) * 100 : 0;
  const loadPct = Math.round(loadPctRaw);
  const freeHours = Math.max(0, Math.round((capacityHours - assignedHours) * 100) / 100);

  return {
    capacityHours,
    assignedHours,
    loadPct,
    freeHours,
    employees: personRows.filter((r) => r.kind === "person").length
  };
}
