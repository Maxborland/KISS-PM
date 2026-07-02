import { describe, expect, it } from "vitest";

import type { ResourceLoadBucket } from "./resourcePlanning";
import {
  buildEmployeeRows,
  buildMonthDays,
  collectProjectsWithOverloadedEmployees,
  HIDDEN_PROJECT_ID,
  mergeWorkspaceDayBuckets,
  monthDateSet
} from "./employeeCapacity";

function dayBucket(input: {
  resourceId: string;
  projectId: string;
  date: string;
  assignedMinutes: number;
  reservedMinutes?: number;
  occupiedMinutes?: number;
  capacityMinutes?: number;
}): ResourceLoadBucket {
  return {
    resourceId: input.resourceId,
    positionId: null,
    teamId: null,
    projectId: input.projectId,
    date: input.date,
    granularity: "day",
    assignedMinutes: input.assignedMinutes,
    reservedMinutes: input.reservedMinutes ?? 0,
    occupiedMinutes: input.occupiedMinutes ?? 0,
    capacityMinutes: input.capacityMinutes ?? 480,
    freeMinutes: 0,
    taskIds: [],
    assignmentIds: [],
    assignmentContributions: [],
    reservationContributions:
      input.reservedMinutes && input.reservedMinutes > 0
        ? [{ reservationId: `reservation-${input.projectId}`, workMinutes: input.reservedMinutes }]
        : [],
    occupancyContributions: [],
    reservationIds: [],
    occupancyIds: [],
    calendarExceptionIds: []
  };
}

describe("employeeCapacity", () => {
  it("merges cross-project load and flags overload at employee total", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 240 })]
        },
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 288 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(528);
    expect(cell?.freeMinutes).toBe(0);
    expect(cell?.overloadMinutes).toBe(48);
    expect(cell?.isOverload).toBe(true);
  });

  it("collectProjectsWithOverloadedEmployees lists all projects from overload-day mix", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 240 })]
        },
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 288 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [{ id: "u1", name: "User", positionId: null, positionName: null }],
      mergedByUserDate: merged
    });

    const projectIds = collectProjectsWithOverloadedEmployees(rows);
    expect(projectIds.has("p-a")).toBe(true);
    expect(projectIds.has("p-b")).toBe(true);
  });

  it("project filter shows portion work but keeps employee-total overload", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 240 })]
        },
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 288 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged,
      projectFilterId: "p-a"
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(240);
    expect(cell?.isOverload).toBe(true);
  });

  it("project filter keeps tenant-wide availability flags when selected project has no work", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 240 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged,
      projectFilterId: "p-a"
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(0);
    expect(cell?.freeMinutes).toBe(240);
    expect(cell?.isFreeDay).toBe(false);
    expect(cell?.heat).toBe(2);
  });

  it("counts reservations as committed capacity load", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [
            dayBucket({
              resourceId: "u1",
              projectId: "p-a",
              date,
              assignedMinutes: 0,
              reservedMinutes: 240
            })
          ]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(240);
    expect(cell?.freeMinutes).toBe(240);
    expect(rows[0]?.projectsMixByDate?.[date]).toEqual([{ projectId: "p-a", workMinutes: 240 }]);
  });

  it("counts occupancy as committed capacity load", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["__occupancy__"]),
      projects: [
        {
          projectId: "__occupancy__",
          buckets: [
            dayBucket({
              resourceId: "u1",
              projectId: "__occupancy__",
              date,
              assignedMinutes: 0,
              occupiedMinutes: 60
            })
          ]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(60);
    expect(cell?.freeMinutes).toBe(420);
    expect(rows[0]?.projectsMixByDate?.[date]).toEqual([
      { projectId: "__occupancy__", workMinutes: 60 }
    ]);
  });

  it("omits zero-minute buckets from workload and project mix", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-zero"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 180 })]
        },
        {
          projectId: "p-zero",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-zero", date, assignedMinutes: 0 })]
        }
      ]
    });

    const day = merged.get("u1")?.get(date);
    expect(day?.workMinutes).toBe(180);
    expect(day?.projectsMix.has("p-zero")).toBe(false);
  });

  it("removes capacity for absence days even when employee has no project load", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const date = "2026-06-02";

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: new Map(),
      absences: [{ userId: "u1", dateFrom: date, dateTo: date }]
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.capacityMinutes).toBe(0);
    expect(cell?.freeMinutes).toBe(0);
    expect(cell?.hasAbsence).toBe(true);
    expect(cell?.isFreeDay).toBe(false);
  });

  it("KPI-005: отсутствие на полдня (portion 0.5) режет ёмкость наполовину", () => {
    const monthIso = "2026-06";
    const date = "2026-06-02"; // будний день
    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [{ id: "u1", name: "User", positionId: null, positionName: null }],
      mergedByUserDate: new Map(),
      absences: [{ userId: "u1", dateFrom: date, dateTo: date, portion: 0.5 }]
    });
    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.capacityMinutes).toBe(240); // 480 × (1 − 0.5)
    expect(cell?.hasAbsence).toBe(true);
  });

  it("два полудневных отсутствия в одну дату суммируются в полный день (ёмкость 0)", () => {
    const monthIso = "2026-06";
    const date = "2026-06-02";
    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [{ id: "u1", name: "User", positionId: null, positionName: null }],
      mergedByUserDate: new Map(),
      absences: [
        { userId: "u1", dateFrom: date, dateTo: date, portion: 0.5 },
        { userId: "u1", dateFrom: date, dateTo: date, portion: 0.5 }
      ]
    });
    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.capacityMinutes).toBe(0); // 0.5 + 0.5 = 1 (потолок), не max(0.5,0.5)
  });

  it("hides unreadable project ids in mix", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 100 })]
        },
        {
          projectId: "secret",
          buckets: [dayBucket({ resourceId: "u1", projectId: "secret", date, assignedMinutes: 50 })]
        }
      ]
    });

    const mix = merged.get("u1")?.get(date)?.projectsMix;
    expect(mix?.has(HIDDEN_PROJECT_ID)).toBe(true);
    expect(mix?.has("secret")).toBe(false);
  });

  it("builds month days with weekends", () => {
    const days = buildMonthDays("2026-06-01");
    expect(days.length).toBe(30);
    expect(days.some((day) => day.isWeekend)).toBe(true);
  });

  // KPI-001: в день С нагрузкой ёмкость берётся из произв. календаря + персонального исключения,
  // а НЕ из merged.capacityMinutes (календарь проекта, 480). Иначе полставки скрывает перегруз.
  it("частичная занятость в день с нагрузкой не скрывает перегруз", () => {
    const monthIso = "2026-07";
    const date = "2026-07-06"; // понедельник, рабочий день
    const merged = mergeWorkspaceDayBuckets({
      monthDates: monthDateSet(monthIso),
      readableProjectIds: null,
      projects: [
        {
          projectId: "p-a",
          // Бакет плана «думает» ёмкость 480 (календарь проекта).
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 300, capacityMinutes: 480 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [{ id: "u1", name: "Иван", positionId: null, positionName: null }],
      mergedByUserDate: merged,
      // Персональное исключение: полставки 240 мин на этот день.
      productionCalendar: {
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480,
        exceptions: [{ date, workingMinutes: 240, resourceId: "u1" }]
      }
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.capacityMinutes).toBe(240); // не 480
    expect(cell?.workMinutes).toBe(300);
    expect(cell?.overloadMinutes).toBe(60);
    expect(cell?.isOverload).toBe(true);
    expect(cell?.heat).toBe(3); // 300/240 = 1.25 → красный
  });
});
