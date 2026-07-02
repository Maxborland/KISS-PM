import {
  assessOpportunityFeasibility,
  type FeasibilityCalendar,
  type OpportunityFeasibilityAssessment
} from "@kiss-pm/domain";
import {
  createTenantProductionCalendarRepository,
  type KissPmDatabase
} from "@kiss-pm/persistence";
import type {
  ApiTenantDataSource,
  OpportunityRecord,
  ProjectRecord
} from "../apiTypes";

type FeasibilityAssessmentDataSource = Pick<
  ApiTenantDataSource,
  "listPositions" | "listProjects" | "listWorkspaceUsers"
>;

async function loadFeasibilityCalendar(
  dataSource: FeasibilityAssessmentDataSource,
  tenantId: string,
  fromYear: number,
  toYear: number
): Promise<FeasibilityCalendar | undefined> {
  const db = "db" in dataSource ? (dataSource as { db?: KissPmDatabase }).db : undefined;
  if (!db) return undefined;
  const repo = createTenantProductionCalendarRepository(db);
  // Кросс-годовой период: грузим календарь за КАЖДЫЙ год диапазона и объединяем праздники,
  // иначе праздники следующего года (напр. новогодние) считались бы рабочими днями.
  const years: number[] = [];
  for (let year = fromYear; year <= toYear; year += 1) years.push(year);
  const snapshots = await Promise.all(years.map((year) => repo.getProductionCalendar(tenantId, year)));
  const holidays = new Set<string>();
  for (const snapshot of snapshots) {
    for (const item of snapshot.exceptions) {
      if (item.resourceId === null && item.workingMinutes === 0) holidays.add(item.date);
    }
  }
  const primary = snapshots[0]!; // рабочая неделя/минуты — из года начала (стабильны для тенанта)
  return {
    workingWeekdays: primary.workingWeekdays,
    workingMinutesPerDay: primary.workingMinutesPerDay,
    holidays
  };
}

export async function buildFeasibilityAssessment(
  dataSource: FeasibilityAssessmentDataSource,
  tenantId: string,
  opportunity: OpportunityRecord
): Promise<OpportunityFeasibilityAssessment> {
  const positions = await dataSource.listPositions?.(tenantId) ?? [];
  const users = await dataSource.listWorkspaceUsers?.(tenantId) ?? [];
  const projects = await dataSource.listProjects?.(tenantId) ?? [];
  const calendar = await loadFeasibilityCalendar(
    dataSource,
    tenantId,
    opportunity.plannedStart.getUTCFullYear(),
    opportunity.plannedFinish.getUTCFullYear()
  );

  return assessOpportunityFeasibility({
    opportunity,
    demand: opportunity.demand,
    ...(calendar ? { calendar } : {}),
    positions: positions.map((position) => ({
      id: position.id,
      name: position.name,
      activeUsers: users.filter(
        (user) => user.positionId === position.id && user.status === "active"
      ).length
    })),
    activeProjectReservations: projects
      .filter((project) => project.status === "active")
      .flatMap((project: ProjectRecord) =>
        project.demand.map((line) => ({
          projectId: project.id,
          positionId: line.positionId,
          requiredHours: line.requiredHours,
          plannedStart: project.plannedStart,
          plannedFinish: project.plannedFinish
        }))
      )
  });
}
