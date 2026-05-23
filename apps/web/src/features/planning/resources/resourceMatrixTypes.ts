/** Типы матрицы ресурсов (контракт API /workspace/capacity/tree). */

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

export type ResourceMatrixUser = {
  id: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
};

export type ResourceMatrixRow = {
  user: ResourceMatrixUser;
  days: ResourceMatrixDayLoad[];
  projectsMixByDate?: Record<string, Array<{ projectId: string; workMinutes: number }>>;
};

export type ResourceMatrixGroup = {
  position: { id: string; name: string; users: ResourceMatrixUser[] };
  rows: ResourceMatrixRow[];
  positionDays: ResourceMatrixDayLoad[];
};

export type ResourceMatrixDayInfo = {
  date: string;
  isoWeekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
};

export type ResourceMatrixOrgUnitGroup = {
  unit: { id: string; name: string };
  unitDays: ResourceMatrixDayLoad[];
  positions: ResourceMatrixGroup[];
};

export type ResourceMatrixOrgDirectionGroup = {
  direction: { id: string; name: string };
  directionDays: ResourceMatrixDayLoad[];
  units: ResourceMatrixOrgUnitGroup[];
};

export type MonthlyResourceMatrix = {
  monthIso: string;
  days: ResourceMatrixDayInfo[];
  groups: ResourceMatrixGroup[];
  unassignedRows: ResourceMatrixRow[];
};

export type OrgCapacityTree = MonthlyResourceMatrix & {
  hierarchyMode: "org";
  orgGroups: ResourceMatrixOrgDirectionGroup[];
};

export function isOrgCapacityTree(matrix: MonthlyResourceMatrix): matrix is OrgCapacityTree {
  return "hierarchyMode" in matrix && matrix.hierarchyMode === "org";
}

export function aggregateResourceMatrixRowDays(
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

export function countOverloadDays(matrix: OrgCapacityTree): number {
  let count = 0;
  for (const direction of matrix.orgGroups) {
    for (const unit of direction.units) {
      for (const position of unit.positions) {
        for (const row of position.rows) {
          for (const day of row.days) {
            if (day.isOverload) count += 1;
          }
        }
      }
    }
  }
  return count;
}
