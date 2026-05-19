import type {
  AccessRole,
  Client,
  Contact,
  DealStage,
  Opportunity,
  Position,
  Project,
  ProjectType,
  WorkspaceUser
} from "./api";

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
        opportunity.clientId,
        opportunity.contactName,
        opportunity.primaryContactId,
        opportunity.title,
        opportunity.projectType,
        opportunity.projectTypeId,
        opportunity.stageId,
        opportunity.status,
        opportunity.feasibilityStatus
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(normalizedQuery)
  );
}

export function filterClientsForTable(clients: Client[], query: string): Client[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return clients;

  return clients.filter((client) =>
    normalizeTableQuery([client.name, client.description, client.status].filter(Boolean).join(" "))
      .includes(normalizedQuery)
  );
}

export function filterContactsForTable(
  contacts: Contact[],
  clients: Client[],
  query: string
): Contact[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return contacts;

  return contacts.filter((contact) => {
    const client = clients.find((item) => item.id === contact.clientId);

    return normalizeTableQuery(
      [
        contact.name,
        contact.email,
        contact.phone,
        contact.telegram,
        contact.role,
        contact.status,
        client?.name
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(normalizedQuery);
  });
}

export function filterProjectTypesForTable(
  projectTypes: ProjectType[],
  query: string
): ProjectType[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return projectTypes;

  return projectTypes.filter((projectType) =>
    normalizeTableQuery(
      [projectType.name, projectType.description, projectType.status].filter(Boolean).join(" ")
    ).includes(normalizedQuery)
  );
}

export function filterDealStagesForTable(
  dealStages: DealStage[],
  query: string
): DealStage[] {
  const normalizedQuery = normalizeTableQuery(query);
  if (!normalizedQuery) return dealStages;

  return dealStages.filter((stage) =>
    normalizeTableQuery([stage.name, stage.sortOrder, stage.status].join(" ")).includes(
      normalizedQuery
    )
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
