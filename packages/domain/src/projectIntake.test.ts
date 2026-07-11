import { describe, expect, it } from "vitest";

import {
  assessOpportunityFeasibility,
  calculatePlannedHours,
  countWorkingDays
} from "./projectIntake";

describe("Phase 3 project intake domain", () => {
  it("calculates planned hours from contract value and planned hourly rate", () => {
    expect(calculatePlannedHours(1_200_000, 6_000)).toBe(200);
    expect(calculatePlannedHours(1_205_000, 6_000)).toBe(200);
  });

  it("counts weekdays inclusively between planned start and finish", () => {
    expect(
      countWorkingDays(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-07T00:00:00.000Z")
      )
    ).toBe(5);
  });

  it("checks demand by position against available hours and existing reservations", () => {
    const assessment = assessOpportunityFeasibility({
      opportunity: {
        id: "opportunity-alpha",
        plannedStart: new Date("2026-06-01T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
        contractValue: 960_000,
        plannedHourlyRate: 6_000
      },
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 80 }
      ],
      positions: [
        { id: "position-engineer", name: "Инженер", activeUsers: 2 },
        { id: "position-analyst", name: "Аналитик", activeUsers: 1 }
      ],
      activeProjectReservations: [
        {
          projectId: "project-existing",
          positionId: "position-engineer",
          requiredHours: 32,
          plannedStart: new Date("2026-06-03T00:00:00.000Z"),
          plannedFinish: new Date("2026-06-10T00:00:00.000Z")
        }
      ]
    });

    expect(assessment.plannedHours).toBe(160);
    expect(assessment.totalRequiredHours).toBe(200);
    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toContain("demand_exceeds_planned_hours");
    expect(assessment.rows).toEqual([
      {
        positionId: "position-engineer",
        positionName: "Инженер",
        requiredHours: 120,
        availableHours: 128,
        reservedHours: 32,
        shortageHours: 0,
        status: "ok"
      },
      {
        positionId: "position-analyst",
        positionName: "Аналитик",
        requiredHours: 80,
        availableHours: 80,
        reservedHours: 0,
        shortageHours: 0,
        status: "ok"
      }
    ]);
  });

  it("исключает праздники и учитывает нестандартную рабочую неделю (произв. календарь)", () => {
    const start = new Date("2026-06-01T00:00:00.000Z"); // Пн
    const finish = new Date("2026-06-07T00:00:00.000Z"); // Вс
    // Праздник 03.06 убирает один рабочий день из 5.
    expect(
      countWorkingDays(start, finish, {
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480,
        holidays: new Set(["2026-06-03"])
      })
    ).toBe(4);
    // Шестидневка (Сб рабочая) даёт 6 дней (исключается только Вс).
    expect(
      countWorkingDays(start, finish, {
        workingWeekdays: [1, 2, 3, 4, 5, 6],
        workingMinutesPerDay: 480,
        holidays: new Set()
      })
    ).toBe(6);
  });

  it("KPI-002: праздники в периоде переводят feasibility из ok в conflict", () => {
    const opportunity = {
      id: "opportunity-holiday",
      plannedStart: new Date("2026-06-01T00:00:00.000Z"), // Пн
      plannedFinish: new Date("2026-06-05T00:00:00.000Z"), // Пт
      contractValue: 240_000,
      plannedHourlyRate: 6_000 // plannedHours = 40
    };
    const demand = [{ positionId: "position-engineer", requiredHours: 40 }];
    const positions = [{ id: "position-engineer", name: "Инженер", activeUsers: 1 }];

    // Без календаря: 5 раб. дней × 8ч × 1 чел = 40ч → спрос покрыт, ok.
    const noCalendar = assessOpportunityFeasibility({
      opportunity,
      demand,
      positions,
      activeProjectReservations: []
    });
    expect(noCalendar.workingDays).toBe(5);
    expect(noCalendar.status).toBe("ok");

    // С двумя праздниками: 3 раб. дня × 8ч = 24ч < 40ч → нехватка → conflict.
    const withHolidays = assessOpportunityFeasibility({
      opportunity,
      demand,
      positions,
      activeProjectReservations: [],
      calendar: {
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480,
        holidays: new Set(["2026-06-03", "2026-06-04"])
      }
    });
    expect(withHolidays.workingDays).toBe(3);
    expect(withHolidays.status).toBe("conflict");
    expect(withHolidays.rows[0]?.shortageHours).toBe(16);
  });

  it("reports missing position capacity as a blocker", () => {
    const assessment = assessOpportunityFeasibility({
      opportunity: {
        id: "opportunity-alpha",
        plannedStart: new Date("2026-06-01T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
        contractValue: 320_000,
        plannedHourlyRate: 4_000
      },
      demand: [{ positionId: "position-designer", requiredHours: 40 }],
      positions: [],
      activeProjectReservations: []
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toContain("missing_position_capacity");
    expect(assessment.rows[0]).toMatchObject({
      positionId: "position-designer",
      availableHours: 0,
      shortageHours: 40,
      status: "conflict"
    });
  });

  it("blocks activation when the opportunity has no resource demand", () => {
    const assessment = assessOpportunityFeasibility({
      opportunity: {
        id: "opportunity-without-demand",
        plannedStart: new Date("2026-06-01T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
        contractValue: 320_000,
        plannedHourlyRate: 4_000
      },
      demand: [],
      positions: [],
      activeProjectReservations: []
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toContain("demand_required");
  });
});
