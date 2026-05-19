import type { AccessRole, Opportunity, Position, Project, WorkspaceUser } from "./api";

export function filterUsersForTable(
  users: WorkspaceUser[],
  roles: AccessRole[],
  query: string
): WorkspaceUser[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return users;

  return users.filter((user) => {
    const role = roles.find((item) => item.id === user.accessProfileId);
    const statusLabel = user.status === "active" ? "активен" : "отключен";

    return normalizeTableQuery(
      [
        user.name,
        user.email,
        role?.name,
        user.accessProfileId,
        user.positionName,
        statusLabel
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(normalizedQuery);
  });
}

export function filterRolesForTable(roles: AccessRole[], query: string): AccessRole[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return roles;

  return roles.filter((role) =>
    normalizeTableQuery([role.name, role.permissions.join(" ")].join(" ")).includes(
      normalizedQuery
    )
  );
}

export function filterPositionsForTable(
  positions: Position[],
  query: string
): Position[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return positions;

  return positions.filter((position) =>
    normalizeTableQuery([position.name, position.description].filter(Boolean).join(" ")).includes(
      normalizedQuery
    )
  );
}

export function filterOpportunitiesForTable(
  opportunities: Opportunity[],
  query: string
): Opportunity[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return opportunities;

  return opportunities.filter((opportunity) =>
    normalizeTableQuery(
      [
        opportunity.clientName,
        opportunity.contactName,
        opportunity.title,
        opportunity.projectType,
        opportunity.status,
        opportunity.feasibilityStatus
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(normalizedQuery)
  );
}

export function filterProjectsForTable(projects: Project[], query: string): Project[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return projects;

  return projects.filter((project) =>
    normalizeTableQuery(
      [project.clientName, project.title, project.status, project.sourceOpportunityId]
        .filter(Boolean)
        .join(" ")
    ).includes(normalizedQuery)
  );
}

function normalizeTableQuery(value: string): string {
  return value.trim().toLowerCase();
}
