"use client";

import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo } from "react";

import { readCalculatedTasks } from "../planningReadModelAccess";
import type { ResourceMatrixAbsenceInput } from "./resourceMatrixAbsences";
import { buildAbsenceDateKeySet, hasAbsenceOnDate } from "./resourceMatrixAbsences";

export type ResourceMatrixUser = {
  id: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
};

export type ResourceMatrixPosition = {
  id: string;
  name: string;
  users: ResourceMatrixUser[];
};

export type ResourceMatrixDayLoad = {
  date: string;
  workMinutes: number;
  capacityMinutes: number;
  isWeekend: boolean;
  isHoliday: boolean;
  hasAbsence: boolean;
  isFreeDay: boolean;
  isException: boolean;
  isOverload: boolean;
  heat: 0 | 1 | 2 | 3;
};

export type ResourceMatrixRow = {
  user: ResourceMatrixUser;
  days: ResourceMatrixDayLoad[];
};

export type ResourceMatrixGroup = {
  position: ResourceMatrixPosition;
  rows: ResourceMatrixRow[];
  positionDays: ResourceMatrixDayLoad[];
};

export type ResourceMatrixDayInfo = {
  date: string;
  isoWeekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
};

export type MonthlyResourceMatrix = {
  monthIso: string;
  days: ResourceMatrixDayInfo[];
  groups: ResourceMatrixGroup[];
  unassignedRows: ResourceMatrixRow[];
};

export type ProductionCalendarShape = {
  workingWeekdays: number[];
  workingMinutesPerDay: number;
  exceptions: Array<{
    date: string;
    workingMinutes: number;
    resourceId: string | null;
  }>;
};

export type MonthlyResourceMatrixInput = {
  readModel: PlanningReadModel | undefined;
  workspaceUsers: ResourceMatrixUser[];
  workspacePositions: Array<{ id: string; name: string }>;
  monthIso: string;
  productionCalendar?: ProductionCalendarShape | undefined;
  absences?: ResourceMatrixAbsenceInput[];
};

export function computeMonthlyResourceMatrix(
  input: MonthlyResourceMatrixInput
): MonthlyResourceMatrix {
    const days = buildMonthDays(input.monthIso, input.productionCalendar);
    const monthDateSet = new Set(days.map((day) => day.date));
    const absenceKeys = buildAbsenceDateKeySet(input.absences ?? [], monthDateSet);
    const positionsMap = buildPositionsMap(input.workspaceUsers, input.workspacePositions);
    const loadByUserDate = buildLoadByUserDate(input.readModel, days);
    const exceptionsByResourceDate = buildExceptionsByResourceDate(
      input.productionCalendar?.exceptions ?? []
    );

    const groups: ResourceMatrixGroup[] = [];
    for (const position of positionsMap.values()) {
      if (position.users.length === 0) continue;
      const rows = position.users.map((user) =>
        buildRow({
          user,
          days,
          loadByUserDate,
          exceptionsByResourceDate,
          absenceKeys,
          productionCalendar: input.productionCalendar
        })
      );
      const positionDays = aggregateRows(days, rows);
      groups.push({ position, rows, positionDays });
    }

    const unassignedRows: ResourceMatrixRow[] = [];
    const knownUserIds = new Set(input.workspaceUsers.map((user) => user.id));
    const assignedResourceIds = collectAssignedResourceIds(input.readModel);
    for (const resourceId of assignedResourceIds) {
      if (knownUserIds.has(resourceId)) continue;
      const fallbackUser: ResourceMatrixUser = {
        id: resourceId,
        name: resourceId,
        positionId: null,
        positionName: null
      };
      unassignedRows.push(
        buildRow({
          user: fallbackUser,
          days,
          loadByUserDate,
          exceptionsByResourceDate,
          absenceKeys,
          productionCalendar: input.productionCalendar
        })
      );
    }

  groups.sort((left, right) => left.position.name.localeCompare(right.position.name, "ru"));
  return { monthIso: input.monthIso, days, groups, unassignedRows };
}

export function useMonthlyResourceMatrix(input: MonthlyResourceMatrixInput): MonthlyResourceMatrix {
  return useMemo(
    () => computeMonthlyResourceMatrix(input),
    [
      input.absences,
      input.monthIso,
      input.productionCalendar,
      input.readModel,
      input.workspacePositions,
      input.workspaceUsers
    ]
  );
}

function buildMonthDays(
  monthIso: string,
  productionCalendar?: ProductionCalendarShape
): ResourceMatrixDayInfo[] {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "0", 10);
  const monthIndex = Number.parseInt(monthText ?? "1", 10) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const workingSet = new Set(productionCalendar?.workingWeekdays ?? [1, 2, 3, 4, 5]);
  const holidayDates = new Set(
    (productionCalendar?.exceptions ?? [])
      .filter((item) => item.resourceId === null && item.workingMinutes === 0)
      .map((item) => item.date)
  );
  const days: ResourceMatrixDayInfo[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const isoWeekday = isoWeekdayFromJsDay(date.getUTCDay());
    const isWorkingWeekday = workingSet.has(isoWeekday);
    const dateIso = toIsoDate(date);
    const isHoliday = holidayDates.has(dateIso);
    days.push({
      date: dateIso,
      isoWeekday,
      isWeekend: !isWorkingWeekday,
      isHoliday
    });
  }
  return days;
}

function buildPositionsMap(
  workspaceUsers: ResourceMatrixUser[],
  workspacePositions: Array<{ id: string; name: string }>
): Map<string, ResourceMatrixPosition> {
  const map = new Map<string, ResourceMatrixPosition>();
  for (const position of workspacePositions) {
    map.set(position.id, { id: position.id, name: position.name, users: [] });
  }
  const fallbackId = "__no_position__";
  for (const user of workspaceUsers) {
    if (user.positionId && map.has(user.positionId)) {
      map.get(user.positionId)!.users.push(user);
      continue;
    }
    if (!map.has(fallbackId)) {
      map.set(fallbackId, { id: fallbackId, name: "Без должности", users: [] });
    }
    map.get(fallbackId)!.users.push(user);
  }
  return map;
}

function collectAssignedResourceIds(readModel: PlanningReadModel | undefined): Set<string> {
  const set = new Set<string>();
  if (!readModel) return set;
  for (const assignment of readModel.authored.assignments) {
    const resourceId = assignment.resourceId;
    if (typeof resourceId === "string" && resourceId.length > 0) set.add(resourceId);
  }
  return set;
}

function buildLoadByUserDate(
  readModel: PlanningReadModel | undefined,
  days: ResourceMatrixDayInfo[]
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  if (!readModel) return result;
  const dateSet = new Set(days.map((day) => day.date));
  const tasksById = new Map(readCalculatedTasks(readModel).map((task) => [String(task.id), task]));
  for (const assignment of readModel.authored.assignments) {
    const resourceId = String(assignment.resourceId ?? "");
    if (!resourceId) continue;
    const taskId = String(assignment.taskId ?? "");
    const task = tasksById.get(taskId);
    if (!task) continue;
    const startIso = String(task.calculatedStart ?? task.plannedStart ?? "");
    const finishIso = String(task.calculatedFinish ?? task.plannedFinish ?? "");
    if (!startIso || !finishIso) continue;
    const workMinutes = Number(assignment.workMinutes ?? 0);
    const durationDays = countSpanDays(startIso, finishIso);
    if (durationDays <= 0) continue;
    const perDayMinutes = workMinutes > 0 ? workMinutes / durationDays : 0;
    iterateDates(startIso, finishIso, (dateIso) => {
      if (!dateSet.has(dateIso)) return;
      let userMap = result.get(resourceId);
      if (!userMap) {
        userMap = new Map<string, number>();
        result.set(resourceId, userMap);
      }
      userMap.set(dateIso, (userMap.get(dateIso) ?? 0) + perDayMinutes);
    });
  }
  return result;
}

function buildExceptionsByResourceDate(
  exceptions: ProductionCalendarShape["exceptions"]
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const item of exceptions) {
    if (!item.resourceId) continue;
    let userMap = result.get(item.resourceId);
    if (!userMap) {
      userMap = new Map<string, number>();
      result.set(item.resourceId, userMap);
    }
    userMap.set(item.date, item.workingMinutes);
  }
  return result;
}

function buildRow(input: {
  user: ResourceMatrixUser;
  days: ResourceMatrixDayInfo[];
  loadByUserDate: Map<string, Map<string, number>>;
  exceptionsByResourceDate: Map<string, Map<string, number>>;
  absenceKeys: ReadonlySet<string>;
  productionCalendar?: ProductionCalendarShape | undefined;
}): ResourceMatrixRow {
  const baseCapacity = input.productionCalendar?.workingMinutesPerDay ?? 480;
  const userLoad = input.loadByUserDate.get(input.user.id);
  const userExceptions = input.exceptionsByResourceDate.get(input.user.id);
  const days: ResourceMatrixDayLoad[] = input.days.map((day) => {
    const workMinutes = userLoad?.get(day.date) ?? 0;
    const exceptionMinutes = userExceptions?.get(day.date);
    const baseCapacityForDay = day.isWeekend || day.isHoliday ? 0 : baseCapacity;
    const capacityMinutes =
      exceptionMinutes !== undefined ? exceptionMinutes : baseCapacityForDay;
    const hasAbsence = hasAbsenceOnDate(input.absenceKeys, input.user.id, day.date);
    const isFreeDay =
      workMinutes === 0 && !hasAbsence && capacityMinutes > 0 && !day.isWeekend && !day.isHoliday;
    const isOverload = workMinutes > capacityMinutes && capacityMinutes >= 0;
    return {
      date: day.date,
      workMinutes,
      capacityMinutes,
      isWeekend: day.isWeekend,
      isHoliday: day.isHoliday,
      hasAbsence,
      isFreeDay,
      isException: exceptionMinutes !== undefined,
      isOverload,
      heat: computeHeat(workMinutes, capacityMinutes)
    };
  });
  return { user: input.user, days };
}

function aggregateRows(
  days: ResourceMatrixDayInfo[],
  rows: ResourceMatrixRow[]
): ResourceMatrixDayLoad[] {
  return days.map((day, dayIndex) => {
    let totalWork = 0;
    let totalCapacity = 0;
    let overload = false;
    let exception = false;
    let hasAbsence = false;
    for (const row of rows) {
      const cell = row.days[dayIndex];
      if (!cell) continue;
      totalWork += cell.workMinutes;
      totalCapacity += cell.capacityMinutes;
      if (cell.isOverload) overload = true;
      if (cell.isException) exception = true;
      if (cell.hasAbsence) hasAbsence = true;
    }
    const isFreeDay =
      totalWork === 0 &&
      !hasAbsence &&
      totalCapacity > 0 &&
      !day.isWeekend &&
      !day.isHoliday;
    return {
      date: day.date,
      workMinutes: totalWork,
      capacityMinutes: totalCapacity,
      isWeekend: day.isWeekend,
      isHoliday: day.isHoliday,
      hasAbsence,
      isFreeDay,
      isException: exception,
      isOverload: overload,
      heat: computeHeat(totalWork, totalCapacity)
    };
  });
}

export function computeHeat(workMinutes: number, capacityMinutes: number): 0 | 1 | 2 | 3 {
  if (workMinutes <= 0) return 0;
  if (capacityMinutes <= 0) return 3;
  const ratio = workMinutes / capacityMinutes;
  if (ratio < 0.34) return 1;
  if (ratio < 0.67) return 2;
  return 3;
}

function countSpanDays(startIso: string, finishIso: string): number {
  const start = parseIsoToUtcMs(startIso);
  const finish = parseIsoToUtcMs(finishIso);
  if (start === null || finish === null || finish < start) return 0;
  return Math.floor((finish - start) / (24 * 60 * 60 * 1000)) + 1;
}

function iterateDates(
  startIso: string,
  finishIso: string,
  callback: (dateIso: string) => void
): void {
  const startMs = parseIsoToUtcMs(startIso);
  const finishMs = parseIsoToUtcMs(finishIso);
  if (startMs === null || finishMs === null || finishMs < startMs) return;
  const dayMs = 24 * 60 * 60 * 1000;
  for (let ms = startMs; ms <= finishMs; ms += dayMs) {
    callback(toIsoDate(new Date(ms)));
  }
}

function parseIsoToUtcMs(value: string): number | null {
  const trimmed = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [yearText, monthText, dayText] = trimmed.split("-");
  const year = Number.parseInt(yearText ?? "0", 10);
  const month = Number.parseInt(monthText ?? "1", 10);
  const day = Number.parseInt(dayText ?? "1", 10);
  return Date.UTC(year, month - 1, day);
}

function isoWeekdayFromJsDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function toIsoDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
