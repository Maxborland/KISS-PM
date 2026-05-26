import type { ScenarioName } from "@/lib/mock-data/scenarios";

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
      const level = over > 12 ? "over" : "high";
      return { kind: "load", hours: over, level };
    }
    return { kind: "load", hours: hoursPerDay, level: "normal" };
  });
}

/** Группа: суммирует часы по подчинённым person-rows (только load-ячейки), даёт high/over level. */
function groupCells(rows: MatrixRow[], days: DayHeader[]): DayCell[] {
  return days.map((d, i): DayCell => {
    if (d.weekend) return { kind: "weekend" };
    if (d.holiday) return { kind: "holiday" };
    let sum = 0;
    let any = false;
    for (const r of rows) {
      const c = r.cells[i];
      if (c?.kind === "load") {
        sum += c.hours;
        any = true;
      }
    }
    if (!any || sum === 0) return { kind: "zero" };
    const level: "normal" | "high" | "over" = sum > 60 ? "over" : sum > 30 ? "high" : "normal";
    return { kind: "load", hours: Math.round(sum * 10) / 10, level };
  });
}

const days = buildDays(31, 6, [1, 9]);

const archPersons: MatrixRow[] = [
  {
    id: "p-be",
    kind: "person",
    indent: 1,
    name: "Басев Екатерина",
    avatar: { initials: "БЕ", color: "c1" },
    percent: { value: 77, level: "norm" },
    cells: personCells(days, 7.6, { offDays: [11] })
  },
  {
    id: "p-ba",
    kind: "person",
    indent: 1,
    name: "Быкова Алина",
    avatar: { initials: "БА", color: "c2" },
    percent: { value: 86, level: "norm" },
    cells: personCells(days, 7.6, { offDays: [4, 8, 11] })
  },
  {
    id: "p-vy",
    kind: "person",
    indent: 1,
    name: "Велинов Юрий",
    avatar: { initials: "ВЮ", color: "c3" },
    percent: { value: 86, level: "norm" },
    cells: personCells(days, 7.6, {
      offDays: [11],
      overDays: [{ day: 4, hours: 16 }]
    })
  },
  {
    id: "p-ga",
    kind: "person",
    indent: 1,
    name: "Голубовская Алёна",
    avatar: { initials: "ГА", color: "c4" },
    percent: { value: 67, level: "mid" },
    cells: personCells(days, 7.6, { vacationDays: [12, 13, 14, 15, 18, 19], offDays: [4, 5, 6, 7, 8, 11] })
  },
  {
    id: "p-la",
    kind: "person",
    indent: 1,
    name: "Линова Алёна",
    avatar: { initials: "ЛА", color: "c5" },
    percent: { value: 81, level: "norm" },
    cells: personCells(days, 7.9, { offDays: [4, 5, 7, 8, 11], overDays: [{ day: 6, hours: 14 }] })
  },
  {
    id: "p-se",
    kind: "person",
    indent: 1,
    name: "Старцев Елена",
    avatar: { initials: "СЕ", color: "c6" },
    percent: { value: 75, level: "norm" },
    cells: personCells(days, 7.6, { offDays: [4, 5, 6, 7, 8, 11] })
  }
];

const visualPersons: MatrixRow[] = [
  {
    id: "p-ad",
    kind: "person",
    indent: 1,
    name: "Абрамов Денис",
    avatar: { initials: "АД", color: "c3" },
    percent: { value: 74, level: "norm" },
    cells: personCells(days, 8, { offDays: [5, 6, 7, 8, 11] })
  },
  {
    id: "p-bash",
    kind: "person",
    indent: 1,
    name: "Башуров Александр",
    avatar: { initials: "БА", color: "c4" },
    percent: { value: 74, level: "norm" },
    cells: personCells(days, 8, { offDays: [5, 6, 7, 8, 11] })
  },
  {
    id: "p-bp",
    kind: "person",
    indent: 1,
    name: "Боршев Павел",
    avatar: { initials: "БП", color: "c5" },
    percent: { value: 69, level: "mid" },
    cells: personCells(days, 8, { offDays: [5, 6, 7, 8, 11] })
  },
  {
    id: "p-li",
    kind: "person",
    indent: 1,
    name: "Лопов Игорь",
    avatar: { initials: "ЛИ", color: "c1" },
    percent: { value: 123, level: "over" },
    cells: personCells(days, 8, {
      vacationDays: [18, 19, 20, 21, 22, 25, 26, 27, 28, 29],
      overDays: [
        { day: 4, hours: 16.9 },
        { day: 5, hours: 16.9 },
        { day: 6, hours: 16.9 }
      ]
    })
  }
];

const archGroup: MatrixRow = {
  id: "g-arch",
  kind: "role",
  indent: 0,
  name: "Архитектор",
  collapsible: true,
  percent: { value: 83, level: "norm" },
  cells: groupCells(archPersons, days)
};

const visualGroup: MatrixRow = {
  id: "g-visual",
  kind: "role",
  indent: 0,
  name: "Визуализатор",
  collapsible: true,
  percent: { value: 91, level: "high" },
  cells: groupCells(visualPersons, days)
};

const allPersons = [...archPersons, ...visualPersons];

const workshop: MatrixRow = {
  id: "g-workshop",
  kind: "workshop",
  indent: 0,
  name: "Мастерская Alpha",
  collapsible: true,
  percent: { value: 87, level: "norm" },
  cells: groupCells(allPersons, days)
};

const RESOURCE_MATRIX_DEFAULT: ResourceMatrixData = {
  days,
  rows: [workshop, archGroup, ...archPersons, visualGroup, ...visualPersons],
  stats: {
    capacityHours: 7448,
    assignedHours: 6251.91,
    loadPct: 95,
    freeHours: 361.01,
    employees: 53
  }
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
    return {
      ...RESOURCE_MATRIX_DEFAULT,
      stats: {
        ...RESOURCE_MATRIX_DEFAULT.stats,
        loadPct: 112,
        freeHours: 0
      }
    };
  }
  return RESOURCE_MATRIX_DEFAULT;
}
