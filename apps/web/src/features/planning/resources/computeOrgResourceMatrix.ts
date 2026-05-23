import type { TenantOrgStructureSnapshot } from "../../org-structure/useOrgStructure";
import type { OrgStructureTrack } from "../../org-structure/useOrgStructure";
import {
  computeMonthlyResourceMatrix,
  type MonthlyResourceMatrix,
  type MonthlyResourceMatrixInput,
  type ResourceMatrixDayLoad,
  type ResourceMatrixGroup,
  type ResourceMatrixRow
} from "./useMonthlyResourceMatrix";

export type ResourceMatrixOrgDirectionGroup = {
  direction: { id: string; name: string };
  directionDays: ResourceMatrixDayLoad[];
  units: ResourceMatrixOrgUnitGroup[];
};

export type ResourceMatrixOrgUnitGroup = {
  unit: { id: string; name: string };
  unitDays: ResourceMatrixDayLoad[];
  positions: ResourceMatrixGroup[];
};

export type OrgMonthlyResourceMatrix = MonthlyResourceMatrix & {
  hierarchyMode: "position" | "org";
  orgGroups: ResourceMatrixOrgDirectionGroup[];
};

export function computeOrgMonthlyResourceMatrix(
  input: MonthlyResourceMatrixInput & {
    orgTrack: OrgStructureTrack;
    orgStructure: TenantOrgStructureSnapshot;
  }
): OrgMonthlyResourceMatrix {
  const base = computeMonthlyResourceMatrix(input);
  const trackSnapshot =
    input.orgTrack === "functional" ? input.orgStructure.functional : input.orgStructure.project;
  const directions = trackSnapshot.nodes
    .filter((node) => node.nodeType === "direction")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ru"));

  if (directions.length === 0) {
    return { ...base, hierarchyMode: "position", orgGroups: [] };
  }

  const unitsByDirection = new Map<string, Array<{ id: string; name: string }>>();
  for (const node of trackSnapshot.nodes) {
    if (node.nodeType === "direction" || !node.parentId) continue;
    const units = unitsByDirection.get(node.parentId) ?? [];
    units.push({ id: node.id, name: node.name });
    unitsByDirection.set(node.parentId, units);
  }

  const placementByUser = new Map(
    trackSnapshot.placements.map((placement) => [placement.userId, placement])
  );
  const positionNameById = new Map(
    input.workspacePositions.map((position) => [position.id, position.name])
  );

  const allRows: ResourceMatrixRow[] = [];
  for (const group of base.groups) allRows.push(...group.rows);
  allRows.push(...base.unassignedRows);

  const rowByUserId = new Map(allRows.map((row) => [row.user.id, row]));
  const assignedUserIds = new Set<string>();

  const orgGroups: ResourceMatrixOrgDirectionGroup[] = [];
  for (const direction of directions) {
    const unitNodes = (unitsByDirection.get(direction.id) ?? []).sort((left, right) =>
      left.name.localeCompare(right.name, "ru")
    );
    const units: ResourceMatrixOrgUnitGroup[] = [];

    for (const unit of unitNodes) {
      const positionBuckets = new Map<string, ResourceMatrixRow[]>();
      for (const placement of trackSnapshot.placements) {
        const unitId =
          input.orgTrack === "functional" ? placement.departmentId : placement.teamId;
        if (placement.directionId !== direction.id || unitId !== unit.id) continue;
        const row = rowByUserId.get(placement.userId);
        if (!row) continue;
        assignedUserIds.add(placement.userId);
        const bucket = positionBuckets.get(placement.positionId) ?? [];
        bucket.push(row);
        positionBuckets.set(placement.positionId, bucket);
      }

      const positions: ResourceMatrixGroup[] = [];
      for (const [positionId, rows] of positionBuckets) {
        rows.sort((left, right) => left.user.name.localeCompare(right.user.name, "ru"));
        positions.push({
          position: {
            id: positionId,
            name: positionNameById.get(positionId) ?? positionId,
            users: rows.map((row) => row.user)
          },
          rows,
          positionDays: aggregateRowDays(base.days, rows)
        });
      }
      positions.sort((left, right) => left.position.name.localeCompare(right.position.name, "ru"));
      const unitRows = positions.flatMap((group) => group.rows);
      units.push({
        unit,
        unitDays: aggregateRowDays(base.days, unitRows),
        positions
      });
    }

    const directionRows = units.flatMap((unitGroup) =>
      unitGroup.positions.flatMap((positionGroup) => positionGroup.rows)
    );
    orgGroups.push({
      direction,
      directionDays: aggregateRowDays(base.days, directionRows),
      units
    });
  }

  const unplacedRows = allRows.filter((row) => !assignedUserIds.has(row.user.id));
  if (unplacedRows.length > 0) {
    orgGroups.push({
      direction: { id: "__unplaced__", name: "Без оргструктуры" },
      directionDays: aggregateRowDays(base.days, unplacedRows),
      units: [
        {
          unit: { id: "__unplaced__", name: "—" },
          unitDays: aggregateRowDays(base.days, unplacedRows),
          positions: [
            {
              position: { id: "__unplaced__", name: "—", users: unplacedRows.map((row) => row.user) },
              rows: unplacedRows,
              positionDays: aggregateRowDays(base.days, unplacedRows)
            }
          ]
        }
      ]
    });
  }

  return {
    ...base,
    hierarchyMode: "org",
    groups: [],
    orgGroups
  };
}

function aggregateRowDays(
  days: MonthlyResourceMatrix["days"],
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

function computeHeat(workMinutes: number, capacityMinutes: number): 0 | 1 | 2 | 3 {
  if (capacityMinutes <= 0 || workMinutes <= 0) return 0;
  const ratio = workMinutes / capacityMinutes;
  if (ratio >= 1) return 3;
  if (ratio >= 0.75) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}
