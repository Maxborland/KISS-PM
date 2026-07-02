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
  year: number
): Promise<FeasibilityCalendar | undefined> {
  const db = "db" in dataSource ? (dataSource as { db?: KissPmDatabase }).db : undefined;
  if (!db) return undefined;
  const snapshot = await createTenantProductionCalendarRepository(db).getProductionCalendar(
    tenantId,
    year
  );
  return {
    workingWeekdays: snapshot.workingWeekdays,
    workingMinutesPerDay: snapshot.workingMinutesPerDay,
    // Праздники = tenant-wide исключения с нулём рабочих минут (как в buildMonthDays).
    holidays: new Set(
      snapshot.exceptions
        .filter((item) => item.resourceId === null && item.workingMinutes === 0)
        .map((item) => item.date)
    )
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
  // Календарь года начала сделки (периоды feasibility короткие; кросс-год — приемлемое упрощение).
  const calendar = await loadFeasibilityCalendar(
    dataSource,
    tenantId,
    opportunity.plannedStart.getUTCFullYear()
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
