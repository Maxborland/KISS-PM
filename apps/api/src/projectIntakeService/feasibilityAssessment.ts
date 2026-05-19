import {
  assessOpportunityFeasibility,
  type OpportunityFeasibilityAssessment
} from "@kiss-pm/domain";
import type {
  ApiTenantDataSource,
  OpportunityRecord,
  ProjectRecord
} from "../apiTypes";

export async function buildFeasibilityAssessment(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  opportunity: OpportunityRecord
): Promise<OpportunityFeasibilityAssessment> {
  const positions = await dataSource.listPositions?.(tenantId) ?? [];
  const users = await dataSource.listWorkspaceUsers?.(tenantId) ?? [];
  const projects = await dataSource.listProjects?.(tenantId) ?? [];

  return assessOpportunityFeasibility({
    opportunity,
    demand: opportunity.demand,
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
