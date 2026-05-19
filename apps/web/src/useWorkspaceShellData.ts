import { useMemo } from "react";

import {
  getVisibleRouteGroups,
  getVisibleRoutes
} from "./routes";
import {
  useAccessRolesQuery,
  useAuditEventsQuery,
  useClientsQuery,
  useCustomFieldsQuery,
  useContactsQuery,
  useDealStagesQuery,
  useHealthQuery,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useOpportunitiesQuery,
  usePositionsQuery,
  useProjectsQuery,
  useProjectTypesQuery,
  useProjectTemplatesQuery,
  useUsersQuery
} from "./workspaceQueries";
import { buildWorkspaceData, type WorkspaceData } from "./workspaceData";
import { getSectionState, hasPermission } from "./workspaceShellState";
import { useDocumentThemeClass } from "./useDocumentThemeClass";

export function useWorkspaceShellData() {
  const healthQuery = useHealthQuery();
  const meQuery = useMeQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const permissions = meQuery.data?.permissions ?? [];
  const canReadUsers = hasPermission(permissions, "tenant.users.read");
  const canReadPositions = hasPermission(permissions, "tenant.positions.read");
  const canReadAccessRoles = hasPermission(permissions, "tenant.access_profiles.read");
  const canReadAudit = hasPermission(permissions, "tenant.audit_events.read");
  const canReadClients = hasPermission(permissions, "tenant.clients.read");
  const canReadContacts = hasPermission(permissions, "tenant.contacts.read");
  const canReadProjectTypes = hasPermission(permissions, "tenant.project_types.read");
  const canReadDealStages = hasPermission(permissions, "tenant.deal_stages.read");
  const canReadOpportunities = hasPermission(permissions, "tenant.opportunities.read");
  const canReadProjects = hasPermission(permissions, "tenant.projects.read");
  const canReadWorkspaceConfig = hasPermission(permissions, "tenant.workspace_config.read");
  const usersQuery = useUsersQuery(canReadUsers);
  const positionsQuery = usePositionsQuery(canReadPositions);
  const accessRolesQuery = useAccessRolesQuery(canReadAccessRoles);
  const auditEventsQuery = useAuditEventsQuery(canReadAudit);
  const clientsQuery = useClientsQuery(canReadClients);
  const contactsQuery = useContactsQuery(canReadContacts);
  const projectTypesQuery = useProjectTypesQuery(canReadProjectTypes);
  const dealStagesQuery = useDealStagesQuery(canReadDealStages);
  const opportunitiesQuery = useOpportunitiesQuery(canReadOpportunities);
  const projectsQuery = useProjectsQuery(canReadProjects);
  const customFieldsQuery = useCustomFieldsQuery(canReadWorkspaceConfig);
  const projectTemplatesQuery = useProjectTemplatesQuery(canReadWorkspaceConfig);
  const visibleRoutes = useMemo(() => getVisibleRoutes(permissions), [permissions]);
  const visibleRouteGroups = useMemo(() => getVisibleRouteGroups(permissions), [permissions]);
  const data = useMemo<WorkspaceData | null>(() => {
    if (!meQuery.data) return null;

    return buildWorkspaceData({
      apiStatus: healthQuery.data?.status ?? (healthQuery.isError ? "ошибка" : "проверяем"),
      me: meQuery.data.user,
      permissions,
      users: usersQuery.data,
      positions: positionsQuery.data,
      accessRoles: accessRolesQuery.data,
      auditEvents: auditEventsQuery.data,
      clients: clientsQuery.data,
      contacts: contactsQuery.data,
      projectTypes: projectTypesQuery.data,
      dealStages: dealStagesQuery.data,
      opportunities: opportunitiesQuery.data,
      projects: projectsQuery.data,
      customFields: customFieldsQuery.data,
      projectTemplates: projectTemplatesQuery.data
    });
  }, [
    accessRolesQuery.data?.accessRoles,
    auditEventsQuery.data?.auditEvents,
    clientsQuery.data?.clients,
    contactsQuery.data?.contacts,
    dealStagesQuery.data?.dealStages,
    healthQuery.data?.status,
    healthQuery.isError,
    meQuery.data,
    permissions,
    opportunitiesQuery.data?.opportunities,
    projectTypesQuery.data?.projectTypes,
    projectsQuery.data?.projects,
    customFieldsQuery.data?.customFields,
    projectTemplatesQuery.data?.projectTemplates,
    positionsQuery.data?.positions,
    usersQuery.data?.users
  ]);

  useDocumentThemeClass(data?.me.theme);

  return {
    canOpenProfile: hasPermission(permissions, "profile.read"),
    canOpenTheme: hasPermission(permissions, "workspace.theme.manage"),
    data,
    loginMutation,
    logoutMutation,
    meQuery,
    permissions,
    sectionStates: {
      users: getSectionState(canReadUsers, usersQuery.isFetching, usersQuery.error),
      positions: getSectionState(canReadPositions, positionsQuery.isFetching, positionsQuery.error),
      accessRoles: getSectionState(
        canReadAccessRoles,
        accessRolesQuery.isFetching,
        accessRolesQuery.error
      ),
      auditEvents: getSectionState(canReadAudit, auditEventsQuery.isFetching, auditEventsQuery.error),
      clients: getSectionState(canReadClients, clientsQuery.isFetching, clientsQuery.error),
      contacts: getSectionState(canReadContacts, contactsQuery.isFetching, contactsQuery.error),
      projectTypes: getSectionState(
        canReadProjectTypes,
        projectTypesQuery.isFetching,
        projectTypesQuery.error
      ),
      dealStages: getSectionState(
        canReadDealStages,
        dealStagesQuery.isFetching,
        dealStagesQuery.error
      ),
      opportunities: getSectionState(
        canReadOpportunities,
        opportunitiesQuery.isFetching,
        opportunitiesQuery.error
      ),
      projects: getSectionState(canReadProjects, projectsQuery.isFetching, projectsQuery.error),
      workspaceConfig: getSectionState(
        canReadWorkspaceConfig,
        customFieldsQuery.isFetching || projectTemplatesQuery.isFetching,
        customFieldsQuery.error ?? projectTemplatesQuery.error
      )
    },
    visibleRouteGroups,
    visibleRoutes
  };
}
