import type { ScenarioName } from "@/lib/mock-data/scenarios";

import { aggregateDayCells, aggregateRowPercent, computeMatrixStats } from "./aggregate-matrix";
import { resolvePersonDayLoadLevel } from "./load-level";
import type { DayCell, DayHeader, MatrixRow, ResourceMatrixData } from "./types";

const WEEKDAY_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

/** Генерирует заголовки дней мая (31 день) с выходными/праздником/today. */
function buildDays(monthLengthDays = 31, todayDay = 6, holidayDays = [1, 9]): DayHeader[] {
  return Array.from({ length: monthLengthDays }, (_, i): DayHeader => {
    const day = i + 1;
    const dow = (i + 4) % 7; // 4 = Чт для day=1
    return {
      day,
      weekdayShort: WEEKDAY_RU[dow] ?? "",
      weekend: dow === 0 || dow === 6,
      holiday: holidayDays.includes(day),
      today: day === todayDay
    };
  });
}

/** Генератор ячеек для одного человека: нормальные часы по будням, weekend/holiday/vacation как есть. */
function personCells(
  days: DayHeader[],
  hoursPerDay: number,
  options?: { vacationDays?: number[]; overDays?: Array<{ day: number; hours: number }>; offDays?: number[] }
): DayCell[] {
  const vacation = new Set(options?.vacationDays ?? []);
  const off = new Set(options?.offDays ?? []);
  const overMap = new Map(options?.overDays?.map((o) => [o.day, o.hours] as const) ?? []);
  return days.map((d): DayCell => {
    if (d.weekend) return { kind: "weekend" };
    if (d.holiday) return { kind: "holiday" };
    if (vacation.has(d.day)) return { kind: "vacation" };
    if (off.has(d.day)) return { kind: "zero" };
    const over = overMap.get(d.day);
    if (over !== undefined) {
      return { kind: "load", hours: over, level: resolvePersonDayLoadLevel(over) };
    }
    const hours = hoursPerDay;
    return { kind: "load", hours, level: resolvePersonDayLoadLevel(hours) };
  });
}

function personRow(
  base: Omit<MatrixRow, "cells" | "percent"> & { cells: MatrixRow["cells"] },
  dailyNormHours: number
): MatrixRow {
  const row: MatrixRow = { ...base, dailyNormHours };
  return { ...row, percent: aggregateRowPercent([row], days) };
}

const days = buildDays(31, 6, [1, 9]);

const archPersons: MatrixRow[] = [
  personRow(
    {
      id: "p-be",
      kind: "person",
      parentId: "g-arch",
      indent: 2,
      name: "Басев Екатерина",
      avatar: { initials: "БЕ", color: "c1" },
      cells: personCells(days, 7.6, { offDays: [11] })
    },
    7.6
  ),
  personRow(
    {
      id: "p-ba",
      kind: "person",
      parentId: "g-arch",
      indent: 2,
      name: "Быкова Алина",
      avatar: { initials: "БА", color: "c2" },
      cells: personCells(days, 7.6, { offDays: [4, 8, 11] })
    },
    7.6
  ),
  personRow(
    {
      id: "p-vy",
      kind: "person",
      parentId: "g-arch",
      indent: 2,
      name: "Велинов Юрий",
      avatar: { initials: "ВЮ", color: "c3" },
      cells: personCells(days, 7.6, { offDays: [11] })
    },
    7.6
  ),
  personRow(
    {
      id: "p-ga",
      kind: "person",
      parentId: "g-arch",
      indent: 2,
      name: "Голубовская Алёна",
      avatar: { initials: "ГА", color: "c4" },
      cells: personCells(days, 7.6, {
        vacationDays: [12, 13, 14, 15, 18, 19],
        offDays: [4, 5, 6, 7, 8, 11]
      })
    },
    7.6
  ),
  personRow(
    {
      id: "p-la",
      kind: "person",
      parentId: "g-arch",
      indent: 2,
      name: "Линова Алёна",
      avatar: { initials: "ЛА", color: "c5" },
      cells: personCells(days, 7.9, { offDays: [4, 5, 7, 8, 11] })
    },
    7.9
  ),
  personRow(
    {
      id: "p-se",
      kind: "person",
      parentId: "g-arch",
      indent: 2,
      name: "Старцев Елена",
      avatar: { initials: "СЕ", color: "c6" },
      cells: personCells(days, 7.6, { offDays: [4, 5, 6, 7, 8, 11] })
    },
    7.6
  )
];

const visualPersons: MatrixRow[] = [
  personRow(
    {
      id: "p-ad",
      kind: "person",
      parentId: "g-visual",
      indent: 2,
      name: "Абрамов Денис",
      avatar: { initials: "АД", color: "c3" },
      cells: personCells(days, 8, { offDays: [5, 6, 7, 8, 11] })
    },
    8
  ),
  personRow(
    {
      id: "p-bash",
      kind: "person",
      parentId: "g-visual",
      indent: 2,
      name: "Башуров Александр",
      avatar: { initials: "БА", color: "c4" },
      cells: personCells(days, 8, { offDays: [5, 6, 7, 8, 11] })
    },
    8
  ),
  personRow(
    {
      id: "p-bp",
      kind: "person",
      parentId: "g-visual",
      indent: 2,
      name: "Боршев Павел",
      avatar: { initials: "БП", color: "c5" },
      cells: personCells(days, 8, { offDays: [5, 6, 7, 8, 11] })
    },
    8
  ),
  personRow(
    {
      id: "p-li",
      kind: "person",
      parentId: "g-visual",
      indent: 2,
      name: "Лопов Игорь",
      avatar: { initials: "ЛИ", color: "c1" },
      cells: personCells(days, 8, {
        vacationDays: [18, 19, 20, 21, 22, 25, 26, 27, 28, 29],
        overDays: [
          { day: 4, hours: 16.9 },
          { day: 5, hours: 16.9 },
          { day: 6, hours: 16.9 }
        ]
      })
    },
    8
  )
];

const archGroup: MatrixRow = {
  id: "g-arch",
  kind: "role",
  parentId: "g-workshop",
  indent: 1,
  name: "Архитектор",
  collapsible: true,
  percent: aggregateRowPercent(archPersons, days),
  cells: aggregateDayCells(archPersons, days)
};

const visualGroup: MatrixRow = {
  id: "g-visual",
  kind: "role",
  parentId: "g-workshop",
  indent: 1,
  name: "Визуализатор",
  collapsible: true,
  percent: aggregateRowPercent(visualPersons, days),
  cells: aggregateDayCells(visualPersons, days)
};

const allPersons = [...archPersons, ...visualPersons];

const workshop: MatrixRow = {
  id: "g-workshop",
  kind: "workshop",
  indent: 0,
  name: "Мастерская Alpha",
  collapsible: true,
  percent: aggregateRowPercent(allPersons, days),
  cells: aggregateDayCells(allPersons, days)
};

const allPersonRows = [...archPersons, ...visualPersons];

const RESOURCE_MATRIX_DEFAULT: ResourceMatrixData = {
  days,
  rows: [workshop, archGroup, ...archPersons, visualGroup, ...visualPersons],
  stats: computeMatrixStats(allPersonRows, days)
};

export const RESOURCE_MATRIX_MOCK = RESOURCE_MATRIX_DEFAULT;

/** Матрица ресурсов с учётом Storybook-сценария (empty / overload). */
export function getResourceMatrixMock(scenario: ScenarioName = "default"): ResourceMatrixData {
  if (scenario === "empty") {
    return {
      days: RESOURCE_MATRIX_DEFAULT.days,
      rows: [],
      stats: {
        capacityHours: 0,
        assignedHours: 0,
        loadPct: 0,
        freeHours: 0,
        employees: 0
      }
    };
  }
  if (scenario === "overload") {
    const stats = computeMatrixStats(allPersonRows, days);
    return {
      ...RESOURCE_MATRIX_DEFAULT,
      stats: {
        ...stats,
        loadPct: 112,
        assignedHours: Math.round(stats.capacityHours * 1.12 * 100) / 100,
        freeHours: 0
      }
    };
  }
  return RESOURCE_MATRIX_DEFAULT;
}
