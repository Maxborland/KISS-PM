import type { ResourceLoadBucket } from "./resourcePlanning";

export const HIDDEN_PROJECT_ID = "__hidden__";

export type CapacityHeat = 0 | 1 | 2 | 3;

export type CapacityDayLoad = {
  date: string;
  workMinutes: number;
  capacityMinutes: number;
  freeMinutes: number;
  overloadMinutes: number;
  isWeekend: boolean;
  isHoliday: boolean;
  hasAbsence: boolean;
  isFreeDay: boolean;
  isException: boolean;
  isOverload: boolean;
  heat: CapacityHeat;
};

export type CapacityMatrixUser = {
  id: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
};

export type CapacityMatrixRow = {
  user: CapacityMatrixUser;
  days: CapacityDayLoad[];
  projectsMixByDate?: Record<string, Array<{ projectId: string; workMinutes: number }>>;
};

export type CapacityMatrixGroup = {
  position: { id: string; name: string; users: CapacityMatrixUser[] };
  rows: CapacityMatrixRow[];
  positionDays: CapacityDayLoad[];
};

export type CapacityMatrixDayInfo = {
  date: string;
  isoWeekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
};

export type CapacityOrgUnitGroup = {
  unit: { id: string; name: string };
  unitDays: CapacityDayLoad[];
  positions: CapacityMatrixGroup[];
};

export type CapacityOrgDirectionGroup = {
  direction: { id: string; name: string };
  directionDays: CapacityDayLoad[];
  units: CapacityOrgUnitGroup[];
};

export type OrgCapacityTree = {
  monthIso: string;
  hierarchyMode: "org";
  days: CapacityMatrixDayInfo[];
  groups: CapacityMatrixGroup[];
  unassignedRows: CapacityMatrixRow[];
  orgGroups: CapacityOrgDirectionGroup[];
};

export type CapacitySummary = {
  monthIso: string;
  generatedAt: string;
  overloadProjectIds: string[];
  overloadUserCount: number;
  totalWorkMinutes: number;
  totalCapacityMinutes: number;
  totalOverloadMinutes: number;
  buckets: { low: number; mid: number; high: number };
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

export type OrgPlacementInput = {
  userId: string;
  directionId: string;
  positionId: string;
  unitId?: string | null;
  matrixUnitId?: string | null;
};

export type OrgDirectionInput = {
  id: string;
  name: string;
};

export type OrgUnitInput = {
  id: string;
  name: string;
  directionId: string;
};

type MergedEmployeeDay = {
  workMinutes: number;
  capacityMinutes: number;
  projectsMix: Map<string, number>;
};

export function computeHeat(workMinutes: number, capacityMinutes: number): CapacityHeat {
  if (workMinutes <= 0) return 0;
  if (capacityMinutes <= 0) return 3;
  const ratio = workMinutes / capacityMinutes;
  if (ratio < 0.34) return 1;
  if (ratio < 0.67) return 2;
  return 3;
}

export function buildMonthDays(
  monthIso: string,
  productionCalendar?: ProductionCalendarShape
): CapacityMatrixDayInfo[] {
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
  const days: CapacityMatrixDayInfo[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    const dateIso = date.toISOString().slice(0, 10);
    const isWorkingWeekday = workingSet.has(isoWeekday);
    days.push({
      date: dateIso,
      isoWeekday,
      isWeekend: !isWorkingWeekday,
      isHoliday: holidayDates.has(dateIso)
    });
  }
  return days;
}

export function monthDateSet(monthIso: string): Set<string> {
  return new Set(buildMonthDays(monthIso).map((day) => day.date));
}

export function mergeWorkspaceDayBuckets(input: {
  monthDates: ReadonlySet<string>;
  projects: Array<{ projectId: string; buckets: ResourceLoadBucket[] }>;
  readableProjectIds: ReadonlySet<string> | null;
}): Map<string, Map<string, MergedEmployeeDay>> {
  const byUserDate = new Map<string, Map<string, MergedEmployeeDay>>();

  for (const project of input.projects) {
    const displayProjectId =
      input.readableProjectIds && !input.readableProjectIds.has(project.projectId)
        ? HIDDEN_PROJECT_ID
        : project.projectId;

    for (const bucket of project.buckets) {
      if (bucket.granularity !== "day") continue;
      if (!input.monthDates.has(bucket.date)) continue;
      const committedMinutes = bucket.assignedMinutes + bucket.reservedMinutes + bucket.occupiedMinutes;
      if (committedMinutes <= 0) continue;

      let userMap = byUserDate.get(bucket.resourceId);
      if (!userMap) {
        userMap = new Map();
        byUserDate.set(bucket.resourceId, userMap);
      }

      const existing = userMap.get(bucket.date) ?? {
        workMinutes: 0,
        capacityMinutes: 0,
        projectsMix: new Map<string, number>()
      };

      existing.workMinutes += committedMinutes;
      existing.capacityMinutes = Math.max(existing.capacityMinutes, bucket.capacityMinutes);
      const mixMinutes = (existing.projectsMix.get(displayProjectId) ?? 0) + committedMinutes;
      existing.projectsMix.set(displayProjectId, mixMinutes);
      userMap.set(bucket.date, existing);
    }
  }

  return byUserDate;
}

function buildAbsenceKeySet(
  absences: Array<{ userId: string; dateFrom: string; dateTo: string }>,
  monthDates: ReadonlySet<string>
): Set<string> {
  const keys = new Set<string>();
  for (const absence of absences) {
    const from = Date.parse(absence.dateFrom);
    const to = Date.parse(absence.dateTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    for (const date of monthDates) {
      const ms = Date.parse(date);
      if (ms >= from && ms <= to) {
        keys.add(`${absence.userId}:${date}`);
      }
    }
  }
  return keys;
}

function buildExceptionsByResourceDate(
  exceptions: ProductionCalendarShape["exceptions"]
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const item of exceptions) {
    if (!item.resourceId) continue;
    let userMap = result.get(item.resourceId);
    if (!userMap) {
      userMap = new Map();
      result.set(item.resourceId, userMap);
    }
    userMap.set(item.date, item.workingMinutes);
  }
  return result;
}

function buildDayLoad(input: {
  day: CapacityMatrixDayInfo;
  workMinutes: number;
  capacityMinutes: number;
  availabilityWorkMinutes?: number;
  hasAbsence: boolean;
  isException: boolean;
  isOverload: boolean;
  isFreeDay?: boolean;
  freeMinutes?: number;
  overloadMinutes?: number;
}): CapacityDayLoad {
  const availabilityWorkMinutes = input.availabilityWorkMinutes ?? input.workMinutes;
  const isFreeDay =
    input.isFreeDay ??
    (availabilityWorkMinutes === 0 &&
      !input.hasAbsence &&
      input.capacityMinutes > 0 &&
      !input.day.isWeekend &&
      !input.day.isHoliday);
  return {
    date: input.day.date,
    workMinutes: input.workMinutes,
    capacityMinutes: input.capacityMinutes,
    freeMinutes: input.freeMinutes ?? Math.max(0, input.capacityMinutes - input.workMinutes),
    overloadMinutes: input.overloadMinutes ?? Math.max(0, input.workMinutes - input.capacityMinutes),
    isWeekend: input.day.isWeekend,
    isHoliday: input.day.isHoliday,
    hasAbsence: input.hasAbsence,
    isFreeDay,
    isException: input.isException,
    isOverload: input.isOverload,
    heat: computeHeat(availabilityWorkMinutes, input.capacityMinutes)
  };
}

export function buildEmployeeRows(input: {
  monthIso: string;
  workspaceUsers: CapacityMatrixUser[];
  mergedByUserDate: Map<string, Map<string, MergedEmployeeDay>>;
  productionCalendar?: ProductionCalendarShape;
  absences?: Array<{ userId: string; dateFrom: string; dateTo: string }>;
  projectFilterId?: string | null;
}): { days: CapacityMatrixDayInfo[]; rows: CapacityMatrixRow[] } {
  const days = buildMonthDays(input.monthIso, input.productionCalendar);
  const monthDates = new Set(days.map((day) => day.date));
  const absenceKeys = buildAbsenceKeySet(input.absences ?? [], monthDates);
  const exceptionsByUser = buildExceptionsByResourceDate(input.productionCalendar?.exceptions ?? []);
  const baseCapacity = input.productionCalendar?.workingMinutesPerDay ?? 480;

  const rows: CapacityMatrixRow[] = input.workspaceUsers.map((user) => {
    const userMerged = input.mergedByUserDate.get(user.id);
    const userExceptions = exceptionsByUser.get(user.id);
    const projectsMixByDate: Record<string, Array<{ projectId: string; workMinutes: number }>> = {};

    const dayLoads = days.map((day) => {
      const merged = userMerged?.get(day.date);
      const totalWork = merged?.workMinutes ?? 0;
      const exceptionMinutes = userExceptions?.get(day.date);
      const hasAbsence = absenceKeys.has(`${user.id}:${day.date}`);
      const baseDayCapacity =
        day.isWeekend || day.isHoliday ? 0 : (exceptionMinutes ?? baseCapacity);
      // Единый авторитетный источник ёмкости: произв. календарь + персональные исключения + отсутствия.
      // НЕ берём merged.capacityMinutes (календарь проекта, дефолт 480) — иначе частичная занятость и
      // выходной тенанта в день с нагрузкой скрывают перегруз (KPI-001).
      const capacityMinutes = hasAbsence ? 0 : baseDayCapacity;
      const isOverload = totalWork > capacityMinutes && capacityMinutes >= 0;
      const freeMinutes = Math.max(0, capacityMinutes - totalWork);
      const overloadMinutes = Math.max(0, totalWork - capacityMinutes);

      let displayWork = totalWork;
      if (input.projectFilterId && merged) {
        displayWork = merged.projectsMix.get(input.projectFilterId) ?? 0;
        if (input.projectFilterId === HIDDEN_PROJECT_ID) {
          displayWork = merged.projectsMix.get(HIDDEN_PROJECT_ID) ?? 0;
        }
        const mix = [...merged.projectsMix.entries()].map(([projectId, workMinutes]) => ({
          projectId,
          workMinutes
        }));
        if (mix.length > 0) projectsMixByDate[day.date] = mix;
      } else if (merged) {
        projectsMixByDate[day.date] = [...merged.projectsMix.entries()].map(
          ([projectId, workMinutes]) => ({ projectId, workMinutes })
        );
      }

      return buildDayLoad({
        day,
        workMinutes: displayWork,
        capacityMinutes,
        availabilityWorkMinutes: totalWork,
        hasAbsence,
        isException: exceptionMinutes !== undefined,
        isOverload,
        freeMinutes,
        overloadMinutes
      });
    });

    return {
      user,
      days: dayLoads,
      ...(Object.keys(projectsMixByDate).length > 0 ? { projectsMixByDate } : {})
    };
  });

  return { days, rows };
}

export function aggregateCapacityRowDays(
  days: CapacityMatrixDayInfo[],
  rows: CapacityMatrixRow[]
): CapacityDayLoad[] {
  return days.map((day, dayIndex) => {
    let totalWork = 0;
    let totalCapacity = 0;
    let overload = false;
    let exception = false;
    let hasAbsence = false;
    let freeMinutes = 0;
    let overloadMinutes = 0;
    let allRowsFreeDay = rows.length > 0;
    for (const row of rows) {
      const cell = row.days[dayIndex];
      if (!cell) continue;
      totalWork += cell.workMinutes;
      totalCapacity += cell.capacityMinutes;
      freeMinutes += cell.freeMinutes;
      overloadMinutes += cell.overloadMinutes;
      if (cell.isOverload) overload = true;
      if (cell.isException) exception = true;
      if (cell.hasAbsence) hasAbsence = true;
      if (!cell.isFreeDay) allRowsFreeDay = false;
    }
    const availabilityWorkMinutes = Math.max(0, totalCapacity - freeMinutes) + overloadMinutes;
    return buildDayLoad({
      day,
      workMinutes: totalWork,
      capacityMinutes: totalCapacity,
      availabilityWorkMinutes,
      hasAbsence,
      isException: exception,
      isOverload: overload,
      isFreeDay: allRowsFreeDay,
      freeMinutes,
      overloadMinutes
    });
  });
}

export function rollupOrgCapacityTree(input: {
  monthIso: string;
  rows: CapacityMatrixRow[];
  unassignedRows: CapacityMatrixRow[];
  days: CapacityMatrixDayInfo[];
  workspacePositions: Array<{ id: string; name: string }>;
  directions: OrgDirectionInput[];
  units: OrgUnitInput[];
  placements: OrgPlacementInput[];
}): OrgCapacityTree {
  const positionNameById = new Map(
    input.workspacePositions.map((position) => [position.id, position.name])
  );
  const rowByUserId = new Map(input.rows.map((row) => [row.user.id, row]));
  const assignedUserIds = new Set<string>();

  const orgGroups: CapacityOrgDirectionGroup[] = [];
  for (const direction of [...input.directions].sort((left, right) =>
    left.name.localeCompare(right.name, "ru")
  )) {
    const directionUnits = input.units
      .filter((unit) => unit.directionId === direction.id)
      .sort((left, right) => left.name.localeCompare(right.name, "ru"));
    const units: CapacityOrgUnitGroup[] = [];

    for (const unit of directionUnits) {
      const positionBuckets = new Map<string, CapacityMatrixRow[]>();
      for (const placement of input.placements) {
        if (placement.directionId !== direction.id) continue;
        const placementUnitId = placement.matrixUnitId ?? placement.unitId ?? null;
        if (placementUnitId !== unit.id) continue;
        const row = rowByUserId.get(placement.userId);
        if (!row) continue;
        assignedUserIds.add(placement.userId);
        const bucket = positionBuckets.get(placement.positionId) ?? [];
        bucket.push(row);
        positionBuckets.set(placement.positionId, bucket);
      }

      const positions: CapacityMatrixGroup[] = [];
      for (const [positionId, positionRows] of positionBuckets) {
        positionRows.sort((left, right) => left.user.name.localeCompare(right.user.name, "ru"));
        positions.push({
          position: {
            id: positionId,
            name: positionNameById.get(positionId) ?? positionId,
            users: positionRows.map((row) => row.user)
          },
          rows: positionRows,
          positionDays: aggregateCapacityRowDays(input.days, positionRows)
        });
      }
      positions.sort((left, right) => left.position.name.localeCompare(right.position.name, "ru"));
      const unitRows = positions.flatMap((group) => group.rows);
      if (unitRows.length === 0) continue;
      units.push({
        unit,
        unitDays: aggregateCapacityRowDays(input.days, unitRows),
        positions
      });
    }

    const directionRows = units.flatMap((unitGroup) =>
      unitGroup.positions.flatMap((positionGroup) => positionGroup.rows)
    );
    if (directionRows.length === 0) continue;
    orgGroups.push({
      direction,
      directionDays: aggregateCapacityRowDays(input.days, directionRows),
      units
    });
  }

  const unplacedRows = [
    ...input.unassignedRows,
    ...input.rows.filter((row) => !assignedUserIds.has(row.user.id))
  ];
  if (unplacedRows.length > 0) {
    orgGroups.push({
      direction: { id: "__unplaced__", name: "Без оргструктуры" },
      directionDays: aggregateCapacityRowDays(input.days, unplacedRows),
      units: [
        {
          unit: { id: "__unplaced__", name: "—" },
          unitDays: aggregateCapacityRowDays(input.days, unplacedRows),
          positions: [
            {
              position: {
                id: "__unplaced__",
                name: "—",
                users: unplacedRows.map((row) => row.user)
              },
              rows: unplacedRows,
              positionDays: aggregateCapacityRowDays(input.days, unplacedRows)
            }
          ]
        }
      ]
    });
  }

  return {
    monthIso: input.monthIso,
    hierarchyMode: "org",
    days: input.days,
    groups: [],
    unassignedRows: [],
    orgGroups
  };
}

export function buildCapacitySummary(input: {
  monthIso: string;
  tree: OrgCapacityTree;
  overloadProjectIdsFromMix: ReadonlySet<string>;
}): CapacitySummary {
  let low = 0;
  let mid = 0;
  let high = 0;
  let totalWorkMinutes = 0;
  let totalCapacityMinutes = 0;
  let totalOverloadMinutes = 0;
  const overloadUsers = new Set<string>();

  for (const direction of input.tree.orgGroups) {
    for (const unit of direction.units) {
      for (const position of unit.positions) {
        for (const row of position.rows) {
          for (const day of row.days) {
            if (day.isOverload) overloadUsers.add(row.user.id);
            if (day.heat === 1) low += 1;
            if (day.heat === 2) mid += 1;
            if (day.heat === 3) high += 1;
            totalWorkMinutes += day.workMinutes;
            totalCapacityMinutes += day.capacityMinutes;
            totalOverloadMinutes += day.overloadMinutes;
          }
        }
      }
    }
  }

  return {
    monthIso: input.monthIso,
    generatedAt: new Date().toISOString(),
    overloadProjectIds: [...input.overloadProjectIdsFromMix].filter(
      (id) => id !== HIDDEN_PROJECT_ID
    ),
    overloadUserCount: overloadUsers.size,
    totalWorkMinutes,
    totalCapacityMinutes,
    totalOverloadMinutes,
    buckets: { low, mid, high }
  };
}

export function listOrgCapacityRows(tree: OrgCapacityTree): CapacityMatrixRow[] {
  const rows: CapacityMatrixRow[] = [...tree.unassignedRows];
  for (const direction of tree.orgGroups) {
    for (const unit of direction.units) {
      for (const position of unit.positions) {
        rows.push(...position.rows);
      }
    }
  }
  return rows;
}

/** Проекты, в которых участвуют сотрудники с employee-total перегрузом (вариант 1). */
export function collectProjectsWithOverloadedEmployees(
  rows: readonly CapacityMatrixRow[]
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const day of row.days) {
      if (!day.isOverload) continue;
      const mix = row.projectsMixByDate?.[day.date];
      if (!mix) continue;
      for (const entry of mix) {
        if (entry.projectId !== HIDDEN_PROJECT_ID) {
          ids.add(entry.projectId);
        }
      }
    }
  }
  return ids;
}

export function maskOrgCapacityTreeProjects(
  tree: OrgCapacityTree,
  readableProjectIds: ReadonlySet<string>
): OrgCapacityTree {
  return {
    ...tree,
    groups: tree.groups.map(maskGroup),
    unassignedRows: tree.unassignedRows.map((row) => maskCapacityRowProjects(row, readableProjectIds)),
    orgGroups: tree.orgGroups.map((direction) => ({
      ...direction,
      units: direction.units.map((unit) => ({
        ...unit,
        positions: unit.positions.map(maskGroup)
      }))
    }))
  };

  function maskGroup(group: CapacityMatrixGroup): CapacityMatrixGroup {
    return {
      ...group,
      rows: group.rows.map((row) => maskCapacityRowProjects(row, readableProjectIds))
    };
  }
}

export function maskCapacityRowProjects(
  row: CapacityMatrixRow,
  readableProjectIds: ReadonlySet<string>
): CapacityMatrixRow {
  if (!row.projectsMixByDate) return row;
  const projectsMixByDate: CapacityMatrixRow["projectsMixByDate"] = {};
  for (const [date, mix] of Object.entries(row.projectsMixByDate)) {
    const masked = new Map<string, number>();
    for (const entry of mix) {
      const projectId = readableProjectIds.has(entry.projectId)
        ? entry.projectId
        : HIDDEN_PROJECT_ID;
      masked.set(projectId, (masked.get(projectId) ?? 0) + entry.workMinutes);
    }
    projectsMixByDate[date] = [...masked.entries()].map(([projectId, workMinutes]) => ({
      projectId,
      workMinutes
    }));
  }
  return { ...row, projectsMixByDate };
}
