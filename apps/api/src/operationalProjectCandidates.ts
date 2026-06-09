import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";

// Keep downstream hydration bounded while ranking candidates beyond route response caps.
export const operationalProjectCandidateHydrationLimit = 500;

const operationalProjectCandidateStatuses: Array<"active" | "paused"> = ["active", "paused"];

type OperationalProjectCandidateDataSource = Pick<
  ApiTenantDataSource,
  "listOperationalQueueProjects" | "listProjects"
>;

export async function listOperationalProjectCandidates(input: {
  dataSource: OperationalProjectCandidateDataSource;
  tenantId: string;
  asOf: Date;
  limit?: number;
}): Promise<ProjectRecord[]> {
  const candidateLimit = input.limit ?? operationalProjectCandidateHydrationLimit;
  const rawProjects = input.dataSource.listOperationalQueueProjects
    ? await input.dataSource.listOperationalQueueProjects(input.tenantId, {
        statuses: [...operationalProjectCandidateStatuses],
        asOf: input.asOf,
        limit: candidateLimit
      })
    : await input.dataSource.listProjects?.(input.tenantId) ?? [];

  return rankOperationalProjectCandidates(
    rawProjects
      .filter((project) => project.tenantId === input.tenantId)
      .filter((project) => operationalProjectCandidateStatuses.includes(project.status as "active" | "paused")),
    input.asOf
  ).slice(0, candidateLimit);
}

export function rankOperationalProjectCandidates(projects: ProjectRecord[], asOf: Date): ProjectRecord[] {
  return [...projects].sort((left, right) => {
    const leftOverdue = isDateBefore(left.plannedFinish, asOf);
    const rightOverdue = isDateBefore(right.plannedFinish, asOf);
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;

    if (leftOverdue && rightOverdue) {
      const dueDateComparison = dateOnly(left.plannedFinish).localeCompare(dateOnly(right.plannedFinish));
      if (dueDateComparison !== 0) return dueDateComparison;
    }

    return (
      (right.activatedAt ?? right.createdAt).toISOString().localeCompare(
        (left.activatedAt ?? left.createdAt).toISOString()
      ) || left.id.localeCompare(right.id)
    );
  });
}

function isDateBefore(value: Date, asOf: Date): boolean {
  return dateOnly(value) < dateOnly(asOf);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
