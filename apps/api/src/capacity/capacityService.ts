import {
  HIDDEN_PROJECT_ID,
  buildResourceLoadMatrix,
  buildEmployeeRows,
  listOrgCapacityRows,
  mergeWorkspaceDayBuckets,
  monthDateSet,
  rollupOrgCapacityTree,
  type CalculatedPlan,
  type CapacityDayLoad,
  type CapacityMatrixUser,
  type OrgCapacityTree,
  type OccupancyWindow,
  type PlanResource,
  type ProductionCalendarShape,
  type ResourceLoadBucket,
  type TenantId
} from "@kiss-pm/domain";
import {
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

import type { ApiTenantDataSource, ProjectRecord } from "../apiTypes";
import { createPlanningReadModel } from "../planning/planningReadModel";

export const OCCUPANCY_BUCKET_PROJECT_ID = "__occupancy__";
const OCCUPANCY_BUCKET_PROJECT_TITLE = "Календарь и встречи";

export type BuildCapacityAggregationInput = {
  tenantId: TenantId;
  monthIso: string;
  projectFilterId?: string | null;
};

export type CapacityContribution = {
  resourceId: string;
  date: string;
  projectId: string;
  projectTitle: string;
  taskId: string | null;
  taskTitle: string | null;
  assignmentId: string | null;
  reservationId: string | null;
  workMinutes: number;
};

export type WorkspaceCapacityAggregation = {
  monthIso: string;
  tree: OrgCapacityTree;
  contributions: CapacityContribution[];
};

export type CapacityDrilldown = {
  monthIso: string;
  resourceId: string;
  date: string;
  totals: CapacityDayLoad;
  contributions: Array<{
    projectId: string;
    projectTitle: string;
    taskId: string | null;
    taskTitle: string | null;
    assignmentId: string | null;
    reservationId: string | null;
    workMinutes: number;
  }>;
};

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

export function parseMonthIso(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;
  const month = Number.parseInt(trimmed.slice(5, 7), 10);
  if (month < 1 || month > 12) return null;
  return trimmed;
}

export function parseCapacityDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}

export function monthRangeIso(monthIso: string): { fromDate: string; toDate: string } {
  const [yearText, monthText] = monthIso.split("-");
  const year = Number.parseInt(yearText ?? "0", 10);
  const monthIndex = Number.parseInt(monthText ?? "1", 10) - 1;
  const fromDate = `${monthIso}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const toDate = `${monthIso}-${String(lastDay).padStart(2, "0")}`;
  return { fromDate, toDate };
}

export function isCapacityCommittedProject(project: ProjectRecord): boolean {
  return project.status === "draft" || project.status === "active" || project.status === "paused";
}

function hasCommittedLoad(bucket: ResourceLoadBucket): boolean {
  return bucket.assignedMinutes + bucket.reservedMinutes + bucket.occupiedMinutes > 0;
}

export async function buildWorkspaceCapacityAggregation(
  dataSource: ApiTenantDataSource,
  input: BuildCapacityAggregationInput
): Promise<WorkspaceCapacityAggregation | null> {
  const monthIso = parseMonthIso(input.monthIso);
  if (!monthIso) return null;

  const db = resolveDb(dataSource);
  if (!db || !dataSource.listProjects || !dataSource.getPlanSnapshot || !dataSource.listWorkspaceUsers) {
    return null;
  }

  const monthDates = monthDateSet(monthIso);
  const { fromDate, toDate } = monthRangeIso(monthIso);
  const projects = (await dataSource.listProjects(input.tenantId)).filter(isCapacityCommittedProject);

  const projectLoads: Array<{ projectId: string; buckets: ResourceLoadBucket[] }> = [];
  const contributions: CapacityContribution[] = [];
  const assignedResourceIds = new Set<string>();
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

  // Снапшоты тянем параллельно (I/O), а тяжёлый CPM-пересчёт делаем с уступкой event loop между
  // проектами — чтобы холодный промах кэша не морозил API для других тенантов на всё время расчёта.
  // ponytail: потолок — кэш read-model per-project по planVersion либо вынос CPM в worker; апгрейд, когда CPU станет узким.
  // Зовём как метод (dataSource.getPlanSnapshot!), а не через извлечённую ссылку — иначе теряется
  // this-биндинг репозитория (реальный DB-datasource использует this → 500).
  const snapshots = await Promise.all(
    projects.map(async (project) => ({
      project,
      snapshot: await dataSource.getPlanSnapshot!(input.tenantId, project.id)
    }))
  );

  let processedProjects = 0;
  for (const { project, snapshot } of snapshots) {
    if (!snapshot) continue;
    if (processedProjects > 0) await new Promise((resolve) => setImmediate(resolve));
    processedProjects += 1;
    const readModel = createPlanningReadModel({ ...snapshot, occupancyWindows: [] });
    const tasksById = new Map(snapshot.tasks.map((task) => [task.id, task]));
    const dayBuckets = readModel.resourceLoad.buckets.filter(
      (bucket) => bucket.granularity === "day" && monthDates.has(bucket.date)
    );
    const loadBuckets = dayBuckets.filter(hasCommittedLoad);
    if (project.status === "draft" && loadBuckets.length === 0) {
      continue;
    }
    projectLoads.push({ projectId: project.id, buckets: loadBuckets });

    for (const assignment of snapshot.assignments) {
      assignedResourceIds.add(assignment.resourceId);
    }
    for (const reservation of snapshot.reservations) {
      assignedResourceIds.add(reservation.resourceId);
    }
    for (const bucket of loadBuckets) {
      for (const contribution of bucket.assignmentContributions) {
        if (contribution.workMinutes <= 0) continue;
        const task = tasksById.get(contribution.taskId);
        contributions.push({
          resourceId: bucket.resourceId,
          date: bucket.date,
          projectId: project.id,
          projectTitle: project.title,
          taskId: contribution.taskId,
          taskTitle: task?.title ?? contribution.taskId,
          assignmentId: contribution.assignmentId,
          reservationId: null,
          workMinutes: contribution.workMinutes
        });
      }
      for (const contribution of bucket.reservationContributions) {
        if (contribution.workMinutes <= 0) continue;
        contributions.push({
          resourceId: bucket.resourceId,
          date: bucket.date,
          projectId: project.id,
          projectTitle: project.title,
          taskId: null,
          taskTitle: null,
          assignmentId: null,
          reservationId: contribution.reservationId,
          workMinutes: contribution.workMinutes
        });
      }
    }
  }

  if (dataSource.listOccupancyWindows) {
    const occupancyWindows = await dataSource.listOccupancyWindows({
      tenantId: input.tenantId,
      from: new Date(`${fromDate}T00:00:00.000Z`),
      to: new Date(`${toDate}T23:59:59.999Z`)
    });
    const occupancyBuckets = buildOccupancyLoad({
      tenantId: input.tenantId,
      monthIso,
      resources: workspaceUsers.map((user) => ({
        id: user.id,
        userId: user.id,
        positionId: user.positionId,
        teamId: null,
        name: user.name,
        calendarId: null
      })),
      productionCalendar,
      occupancyWindows
    }).filter(hasCommittedLoad);
    if (occupancyBuckets.length > 0) {
      projectLoads.push({ projectId: OCCUPANCY_BUCKET_PROJECT_ID, buckets: occupancyBuckets });
      for (const bucket of occupancyBuckets) {
        assignedResourceIds.add(bucket.resourceId);
        for (const contribution of bucket.occupancyContributions) {
          if (contribution.workMinutes <= 0) continue;
          contributions.push({
            resourceId: bucket.resourceId,
            date: bucket.date,
            projectId: OCCUPANCY_BUCKET_PROJECT_ID,
            projectTitle: OCCUPANCY_BUCKET_PROJECT_TITLE,
            taskId: null,
            taskTitle: occupancyContributionTitle(contribution.sourceType),
            assignmentId: null,
            reservationId: contribution.occupancyId,
            workMinutes: contribution.workMinutes
          });
        }
      }
    }
  }

  const merged = mergeWorkspaceDayBuckets({
    monthDates,
    projects: projectLoads,
    readableProjectIds: null
  });

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
    projectFilterId: input.projectFilterId ?? null
  });

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

  return {
    monthIso,
    tree: rollupOrgCapacityTree({
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
    }),
    contributions
  };
}

function buildOccupancyLoad(input: {
  tenantId: TenantId;
  monthIso: string;
  resources: PlanResource[];
  productionCalendar: ProductionCalendarShape;
  occupancyWindows: OccupancyWindow[];
}): ResourceLoadBucket[] {
  if (input.resources.length === 0 || input.occupancyWindows.length === 0) return [];
  const { fromDate, toDate } = monthRangeIso(input.monthIso);
  const plan: CalculatedPlan = {
    tenantId: input.tenantId,
    projectId: OCCUPANCY_BUCKET_PROJECT_ID,
    planVersion: 0,
    engineVersion: "calendar-occupancy-v2",
    calculatedAt: `${fromDate}T00:00:00.000Z`,
    tasks: [],
    dependencies: [],
    projectFinish: toDate,
    criticalPathTaskIds: [],
    criticalPath: { taskIds: [] },
    scheduleTrace: [],
    validationIssues: []
  };
  return buildResourceLoadMatrix({
    plan,
    resources: input.resources,
    assignments: [],
    calendars: [{
      id: "tenant-production-calendar",
      workingWeekdays: input.productionCalendar.workingWeekdays,
      workingMinutesPerDay: input.productionCalendar.workingMinutesPerDay
    }],
    calendarExceptions: input.productionCalendar.exceptions.map((item, index) => ({
      id: `production-calendar-exception-${item.date}-${item.resourceId ?? "tenant"}-${index}`,
      calendarId: "tenant-production-calendar",
      resourceId: item.resourceId,
      date: item.date,
      workingMinutes: item.workingMinutes,
      reason: null
    })),
    reservations: [],
    occupancyWindows: input.occupancyWindows,
    rangeStart: fromDate,
    rangeFinish: toDate,
    granularities: ["day"]
  }).buckets;
}

function occupancyContributionTitle(sourceType: string): string {
  if (sourceType === "personal_calendar_event") return "Личный календарь";
  if (sourceType === "meeting") return "Встреча";
  if (sourceType === "call_session") return "Звонок";
  return "Занятость";
}

export function buildCapacityDrilldown(input: {
  aggregation: WorkspaceCapacityAggregation;
  resourceId: string;
  date: string;
  readableProjectIds: ReadonlySet<string>;
}): CapacityDrilldown | null {
  const monthIso = parseMonthIso(input.aggregation.monthIso);
  const date = parseCapacityDate(input.date);
  if (!monthIso || !date || !monthDateSet(monthIso).has(date)) return null;

  const row = listOrgCapacityRows(input.aggregation.tree).find(
    (candidate) => candidate.user.id === input.resourceId
  );
  const totals = row?.days.find((day) => day.date === date);
  if (!row || !totals) return null;

  const visibleContributions: CapacityDrilldown["contributions"] = [];
  let hiddenWorkMinutes = 0;
  for (const contribution of input.aggregation.contributions) {
    if (contribution.resourceId !== input.resourceId || contribution.date !== date) continue;
    if (
      contribution.projectId !== OCCUPANCY_BUCKET_PROJECT_ID &&
      !input.readableProjectIds.has(contribution.projectId)
    ) {
      hiddenWorkMinutes += contribution.workMinutes;
      continue;
    }
    visibleContributions.push({
      projectId: contribution.projectId,
      projectTitle: contribution.projectTitle,
      taskId: contribution.taskId,
      taskTitle: contribution.taskTitle,
      assignmentId: contribution.assignmentId,
      reservationId: contribution.reservationId,
      workMinutes: contribution.workMinutes
    });
  }
  if (hiddenWorkMinutes > 0) {
    visibleContributions.push({
      projectId: HIDDEN_PROJECT_ID,
      projectTitle: "Недоступный проект",
      taskId: null,
      taskTitle: null,
      assignmentId: null,
      reservationId: null,
      workMinutes: hiddenWorkMinutes
    });
  }

  return {
    monthIso,
    resourceId: input.resourceId,
    date,
    totals,
    contributions: visibleContributions.sort(compareDrilldownRows)
  };
}

function compareDrilldownRows(
  left: CapacityDrilldown["contributions"][number],
  right: CapacityDrilldown["contributions"][number]
): number {
  if (left.projectId === HIDDEN_PROJECT_ID && right.projectId !== HIDDEN_PROJECT_ID) return 1;
  if (right.projectId === HIDDEN_PROJECT_ID && left.projectId !== HIDDEN_PROJECT_ID) return -1;
  return (
    left.projectTitle.localeCompare(right.projectTitle, "ru") ||
    (left.taskTitle ?? "").localeCompare(right.taskTitle ?? "", "ru") ||
    (left.assignmentId ?? "").localeCompare(right.assignmentId ?? "") ||
    (left.reservationId ?? "").localeCompare(right.reservationId ?? "")
  );
}
