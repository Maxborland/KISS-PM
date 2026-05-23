import { describe, expect, it } from "vitest";

import {
  buildAbsenceDateKeySet,
  hasAbsenceOnDate
} from "./resourceMatrixAbsences";
import { computeMonthlyResourceMatrix } from "./useMonthlyResourceMatrix";

const USER_ID = "user-1";
const POSITION_ID = "pos-1";
const MONTH = "2026-05";

describe("resourceMatrixAbsences", () => {
  it("marks absence keys only inside the month range", () => {
    const monthDates = new Set(["2026-05-10", "2026-05-11"]);
    const keys = buildAbsenceDateKeySet(
      [{ userId: USER_ID, dateFrom: "2026-05-09", dateTo: "2026-05-11" }],
      monthDates
    );
    expect(keys.has(`${USER_ID}:2026-05-09`)).toBe(false);
    expect(keys.has(`${USER_ID}:2026-05-10`)).toBe(true);
    expect(keys.has(`${USER_ID}:2026-05-11`)).toBe(true);
    expect(hasAbsenceOnDate(keys, USER_ID, "2026-05-10")).toBe(true);
  });
});

describe("computeMonthlyResourceMatrix cell semantics", () => {
  const baseUser = {
    id: USER_ID,
    name: "Иван",
    positionId: POSITION_ID,
    positionName: "Инженер"
  };

  const baseCalendar = {
    workingWeekdays: [1, 2, 3, 4, 5],
    workingMinutesPerDay: 480,
    exceptions: [] as Array<{
      date: string;
      workingMinutes: number;
      resourceId: string | null;
    }>
  };

  it("sets hasAbsence from resource_absences, not isFreeDay", () => {
    const matrix = computeMonthlyResourceMatrix({
      readModel: undefined,
      monthIso: MONTH,
      workspaceUsers: [baseUser],
      workspacePositions: [{ id: POSITION_ID, name: "Инженер" }],
      productionCalendar: baseCalendar,
      absences: [{ userId: USER_ID, dateFrom: "2026-05-12", dateTo: "2026-05-12" }]
    });
    const cell = matrix.groups[0]?.rows[0]?.days.find((day) => day.date === "2026-05-12");
    expect(cell?.hasAbsence).toBe(true);
    expect(cell?.isFreeDay).toBe(false);
    expect(cell?.isHoliday).toBe(false);
  });

  it("sets isFreeDay on working days without work and without absence", () => {
    const matrix = computeMonthlyResourceMatrix({
      readModel: undefined,
      monthIso: MONTH,
      workspaceUsers: [baseUser],
      workspacePositions: [{ id: POSITION_ID, name: "Инженер" }],
      productionCalendar: baseCalendar,
      absences: []
    });
    const cell = matrix.groups[0]?.rows[0]?.days.find((day) => day.date === "2026-05-12");
    expect(cell?.workMinutes).toBe(0);
    expect(cell?.capacityMinutes).toBe(480);
    expect(cell?.hasAbsence).toBe(false);
    expect(cell?.isFreeDay).toBe(true);
    expect(cell?.isHoliday).toBe(false);
  });

  it("sets isHoliday for tenant-wide non-working days, not hasAbsence", () => {
    const matrix = computeMonthlyResourceMatrix({
      readModel: undefined,
      monthIso: MONTH,
      workspaceUsers: [baseUser],
      workspacePositions: [{ id: POSITION_ID, name: "Инженер" }],
      productionCalendar: {
        ...baseCalendar,
        exceptions: [{ date: "2026-05-12", workingMinutes: 0, resourceId: null }]
      },
      absences: []
    });
    const cell = matrix.groups[0]?.rows[0]?.days.find((day) => day.date === "2026-05-12");
    expect(cell?.isHoliday).toBe(true);
    expect(cell?.hasAbsence).toBe(false);
    expect(cell?.isFreeDay).toBe(false);
  });
});
