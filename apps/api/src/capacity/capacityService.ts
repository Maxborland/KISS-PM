import {
  canReadProjects,
  canReadProjectResources,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { ResourceLoadBucket, TenantId, TenantUser } from "@kiss-pm/domain";
import {
  buildCapacitySummary,
  buildEmployeeRows,
  collectProjectsWithOverloadedEmployees,
  listOrgCapacityRows,
  mergeWorkspaceDayBuckets,
  monthDateSet,
  rollupOrgCapacityTree,
  type CapacityMatrixUser,
  type CapacitySummary,
  type OrgCapacityTree,
  type ProductionCalendarShape
} from "@kiss-pm/domain";
import {
  createPlanningRepository,
  createResourceAbsencesRepository,
  createTenantOrgStructureRepository,
  createTenantProductionCalendarRepository,
  type KissPmDatabase
} from "@kiss-pm/persistence";
import {
  getOrgStructureTrackSnapshot,
  listDirectionChildUnits,
  placementUnitId,
  sortedDirectionNodes
} from "@kiss-pm/tenant-org-structure";

import type { ApiTenantDataSource } from "../apiTypes";
import { createPlanningReadModel } from "../planning/planningReadModel";

export type BuildCapacityInput = {
  tenantId: TenantId;
  monthIso: string;
  projectId?: string | null;
  actor: TenantUser;
  profile: AccessProfile;
};

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

function parseMonthIso(value: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(value.trim())) return null;
  return value.trim();
}

function monthRangeIso(monthIso: string): { fromDate: string; toDate: string } {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "0", 10);
  const monthIndex = Number.parseInt(monthText ?? "1", 10) - 1;
  const fromDate = `${monthIso}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const toDate = `${monthIso}-${String(lastDay).padStart(2, "0")}`;
  return { fromDate, toDate };
}

export async function buildWorkspaceCapacityTree(
  dataSource: ApiTenantDataSource,
  input: BuildCapacityInput
): Promise<OrgCapacityTree | null> {
  const monthIso = parseMonthIso(input.monthIso);
  if (!monthIso) return null;

  const db = resolveDb(dataSource);
  if (!db || !dataSource.listProjects || !dataSource.getPlanSnapshot || !dataSource.listWorkspaceUsers) {
    return null;
  }

  const resourcesDecision = canReadProjectResources({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.tenantId
  });
  if (!resourcesDecision.allowed) return null;

  const projectsDecision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.tenantId
  });
  const readableProjectIds = projectsDecision.allowed
    ? new Set((await dataSource.listProjects(input.tenantId)).map((project) => project.id))
    : new Set<string>();

  const monthDates = monthDateSet(monthIso);
  const { fromDate, toDate } = monthRangeIso(monthIso);

  const planningRepo = createPlanningRepository(db);
  const projects = (await dataSource.listProjects(input.tenantId)).filter(
    (project) => project.status === "active"
  );

  const projectLoads: Array<{ projectId: string; buckets: ResourceLoadBucket[] }> = [];
  for (const project of projects) {
    const snapshot = await dataSource.getPlanSnapshot(input.tenantId, project.id);
    if (!snapshot) continue;
    const readModel = createPlanningReadModel(snapshot);
    const dayBuckets = readModel.resourceLoad.buckets.filter(
      (bucket) => bucket.granularity === "day" && monthDates.has(bucket.date)
    );
    projectLoads.push({ projectId: project.id, buckets: dayBuckets });
  }

  const merged = mergeWorkspaceDayBuckets({
    monthDates,
    projects: projectLoads,
    readableProjectIds
  });

  const workspaceUsers: CapacityMatrixUser[] = (await dataSource.listWorkspaceUsers(input.tenantId))
    .filter((user) => user.status !== "inactive")
    .map((user) => ({
      id: user.id,
      name: user.name,
      positionId: user.positionId,
      positionName: user.positionName
    }));

  const positions = await dataSource.listPositions?.(input.tenantId);
  const year = Number.parseInt(monthIso.split("-")[0] ?? "2026", 10);
  const productionCalendarRepo = createTenantProductionCalendarRepository(db);
  const calendarSnapshot = await productionCalendarRepo.getProductionCalendar(
    input.tenantId,
    year
  );
  const productionCalendar: ProductionCalendarShape = {
    workingWeekdays: calendarSnapshot.workingWeekdays,
    workingMinutesPerDay: calendarSnapshot.workingMinutesPerDay,
    exceptions: calendarSnapshot.exceptions.map((item) => ({
      date: item.date,
      workingMinutes: item.workingMinutes,
      resourceId: item.resourceId
    }))
  };

  const absencesRepo = createResourceAbsencesRepository(db);
  const absences = await absencesRepo.listAbsences(input.tenantId, fromDate, toDate);

  const { days, rows } = buildEmployeeRows({
    monthIso,
    workspaceUsers,
    mergedByUserDate: merged,
    productionCalendar,
    absences: absences.map((absence) => ({
      userId: absence.userId,
      dateFrom: absence.dateFrom,
      dateTo: absence.dateTo
    })),
    projectFilterId: input.projectId ?? null
  });

  const assignedResourceIds = new Set<string>();
  for (const project of projects) {
    const snapshot = await planningRepo.getPlanSnapshot(input.tenantId, project.id);
    if (!snapshot) continue;
    for (const assignment of snapshot.assignments) {
      assignedResourceIds.add(assignment.resourceId);
    }
  }

  const unassignedRows = rows.filter((row) => {
    const hasLoad = row.days.some((day) => day.workMinutes > 0 || day.isOverload);
    return !assignedResourceIds.has(row.user.id) && hasLoad;
  });
  const unassignedIds = new Set(unassignedRows.map((row) => row.user.id));
  const primaryRows = rows.filter((row) => !unassignedIds.has(row.user.id));

  const orgRepo = createTenantOrgStructureRepository(db);
  const orgStructure = await orgRepo.getOrgStructure(input.tenantId);
  const trackSnapshot = getOrgStructureTrackSnapshot(orgStructure, "functional");
  const directions = sortedDirectionNodes(trackSnapshot).map((node) => ({
    id: node.id,
    name: node.name
  }));
  const unitsByDirection = listDirectionChildUnits(trackSnapshot, "functional");
  const units = [...unitsByDirection.entries()].flatMap(([directionId, unitList]) =>
    unitList.map((unit) => ({ id: unit.id, name: unit.name, directionId }))
  );
  const placements = trackSnapshot.placements.map((placement) => ({
    userId: placement.userId,
    directionId: placement.directionId,
    positionId: placement.positionId,
    unitId: placementUnitId(placement, "functional")
  }));

  return rollupOrgCapacityTree({
    monthIso,
    rows: primaryRows,
    unassignedRows,
    days,
    workspacePositions: (positions ?? []).map((position) => ({
      id: position.id,
      name: position.name
    })),
    directions,
    units,
    placements
  });
}

export async function buildWorkspaceCapacitySummary(
  dataSource: ApiTenantDataSource,
  input: BuildCapacityInput
): Promise<CapacitySummary | null> {
  const monthIso = parseMonthIso(input.monthIso);
  if (!monthIso) return null;

  const tree = await buildWorkspaceCapacityTree(dataSource, input);
  if (!tree) return null;

  const overloadProjectIds = collectProjectsWithOverloadedEmployees(listOrgCapacityRows(tree));
  return buildCapacitySummary({
    monthIso,
    tree,
    overloadProjectIdsFromMix: overloadProjectIds
  });
}
