import { describe, expect, it } from "vitest";

import type { CapacityDayLoad, OrgCapacityTree } from "@kiss-pm/domain";

import {
  capacityCellTone,
  capacityErrorMessage,
  capacityMonthLabel,
  flattenCapacityTree,
  formatHours,
  shiftMonthIso,
  splitCapacityWeeks,
  sumCapacityDays
} from "./capacity-surface";

const day = (overrides: Partial<CapacityDayLoad>): CapacityDayLoad => ({
  date: "2026-07-01",
  workMinutes: 0,
  capacityMinutes: 480,
  freeMinutes: 480,
  overloadMinutes: 0,
  isWeekend: false,
  isHoliday: false,
  hasAbsence: false,
  isFreeDay: false,
  isException: false,
  isOverload: false,
  heat: 0,
  ...overrides
});

describe("capacity period navigation", () => {
  it("shifts months across year boundaries in both directions", () => {
    expect(shiftMonthIso("2026-07", 1)).toBe("2026-08");
    expect(shiftMonthIso("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthIso("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthIso("2026-07", -7)).toBe("2025-12");
  });

  it("renders a russian month label and passes through invalid input", () => {
    expect(capacityMonthLabel("2026-07")).toBe("Июль 2026");
    expect(capacityMonthLabel("2026-13")).toBe("2026-13");
  });

  it("splits month days into calendar weeks starting on Monday", () => {
    // Июль 2026: 01.07 — среда; первая неделя короткая (Ср–Вс), дальше полные.
    const days = Array.from({ length: 31 }, (_, i) => ({ isoWeekday: ((2 + i) % 7) + 1 }));
    const weeks = splitCapacityWeeks(days);
    expect(weeks[0]!.length).toBe(5);
    expect(weeks.slice(1, -1).every((week) => week.length === 7)).toBe(true);
    expect(weeks.reduce((sum, week) => sum + week.length, 0)).toBe(31);
    expect(splitCapacityWeeks([])).toEqual([]);
  });
});

describe("capacity cell tones (подсветка перегруза)", () => {
  it("marks overload as danger regardless of heat", () => {
    expect(capacityCellTone(day({ workMinutes: 600, overloadMinutes: 120, isOverload: true, heat: 3 }))).toBe("danger");
  });

  it("marks high load without overload as warning", () => {
    expect(capacityCellTone(day({ workMinutes: 420, heat: 3 }))).toBe("warning");
  });

  it("marks normal load, idle working day and non-working day distinctly", () => {
    expect(capacityCellTone(day({ workMinutes: 240, heat: 2 }))).toBe("ok");
    expect(capacityCellTone(day({}))).toBe("idle");
    expect(capacityCellTone(day({ isWeekend: true, capacityMinutes: 0, freeMinutes: 0, isFreeDay: true }))).toBe("free");
  });
});

describe("capacity tree flattening and totals", () => {
  const row = (userId: string) => ({
    user: { id: userId, name: userId, positionId: "backend", positionName: "Backend" },
    days: [day({ workMinutes: 480 }), day({ date: "2026-07-02", workMinutes: 600, overloadMinutes: 120, isOverload: true, heat: 3 as const })]
  });

  const tree: OrgCapacityTree = {
    monthIso: "2026-07",
    hierarchyMode: "org",
    days: [
      { date: "2026-07-01", isoWeekday: 3, isWeekend: false, isHoliday: false },
      { date: "2026-07-02", isoWeekday: 4, isWeekend: false, isHoliday: false }
    ],
    groups: [],
    unassignedRows: [row("u-free")],
    orgGroups: [
      {
        direction: { id: "dir-delivery", name: "Производство" },
        directionDays: [],
        units: [
          {
            unit: { id: "unit-dev", name: "Разработка" },
            unitDays: [],
            positions: [
              {
                position: { id: "backend", name: "Backend", users: [] },
                rows: [row("u-a"), row("u-b")],
                positionDays: []
              },
              { position: { id: "frontend", name: "Frontend", users: [] }, rows: [], positionDays: [] }
            ]
          }
        ]
      },
      {
        direction: { id: "__unplaced__", name: "Без оргструктуры" },
        directionDays: [],
        units: [
          {
            unit: { id: "__unplaced__", name: "—" },
            unitDays: [],
            positions: [{ position: { id: "__unplaced__", name: "—", users: [] }, rows: [row("u-c")], positionDays: [] }]
          }
        ]
      }
    ]
  };

  it("flattens org groups into titled sections, skips empty positions, collapses service nodes", () => {
    const sections = flattenCapacityTree(tree);
    expect(sections.map((s) => s.title)).toEqual(["Производство · Разработка · Backend", "Без оргструктуры", "Без должности"]);
    expect(sections[0]!.rows.map((r) => r.user.id)).toEqual(["u-a", "u-b"]);
    expect(sections[1]!.rows.map((r) => r.user.id)).toEqual(["u-c"]);
    expect(sections[2]!.rows.map((r) => r.user.id)).toEqual(["u-free"]);
  });

  it("sums work, capacity and overload minutes over visible days", () => {
    expect(sumCapacityDays(row("u-a").days)).toEqual({ workMinutes: 1080, capacityMinutes: 960, overloadMinutes: 120 });
    expect(sumCapacityDays([])).toEqual({ workMinutes: 0, capacityMinutes: 0, overloadMinutes: 0 });
  });

  it("formats minutes as hours with russian decimal comma", () => {
    expect(formatHours(480)).toBe("8");
    expect(formatHours(450)).toBe("7,5");
  });
});

describe("capacity error mapping", () => {
  it("maps known codes and hides raw network errors", () => {
    expect(capacityErrorMessage("capacity_invalid_query")).toBe("Некорректный период или фильтр запроса");
    expect(capacityErrorMessage("persistence_not_configured")).toBe("Хранилище данных не настроено");
    expect(capacityErrorMessage("Failed to fetch internal.example")).toBe("Запрос не выполнен");
    expect(capacityErrorMessage()).toBe("Не удалось загрузить");
  });
});
