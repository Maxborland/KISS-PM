import type {
  AccessRole,
  AuditEvent,
  AuthMeResponse,
  Client,
  Contact,
  CustomFieldDefinition,
  DealStage,
  Opportunity,
  Position,
  Project,
  Task,
  ProjectType,
  ProjectTemplate,
  WorkspaceUser
} from "./api";

export type WorkspaceData = {
  apiStatus: string;
  me: WorkspaceUser;
  permissions: string[];
  users: WorkspaceUser[];
  positions: Position[];
  accessRoles: AccessRole[];
  auditEvents: AuditEvent[];
  clients: Client[];
  contacts: Contact[];
  projectTypes: ProjectType[];
  dealStages: DealStage[];
  opportunities: Opportunity[];
  projects: Project[];
  myWorkTasks: Task[];
  customFields: CustomFieldDefinition[];
  projectTemplates: ProjectTemplate[];
};

export function buildWorkspaceData(input: {
  apiStatus: string;
  me: AuthMeResponse["user"];
  permissions: string[];
  users: { users: WorkspaceUser[] } | undefined;
  positions: { positions: Position[] } | undefined;
  accessRoles: { accessRoles: AccessRole[] } | undefined;
  auditEvents: { auditEvents: AuditEvent[] } | undefined;
  clients: { clients: Client[] } | undefined;
  contacts: { contacts: Contact[] } | undefined;
  projectTypes: { projectTypes: ProjectType[] } | undefined;
  dealStages: { dealStages: DealStage[] } | undefined;
  opportunities: { opportunities: Opportunity[] } | undefined;
  projects: { projects: Project[] } | undefined;
  myWork: { tasks: Task[] } | undefined;
  customFields: { customFields: CustomFieldDefinition[] } | undefined;
  projectTemplates: { projectTemplates: ProjectTemplate[] } | undefined;
}): WorkspaceData {
  const canReadUsers = input.permissions.includes("tenant.users.read");
  const canReadPositions = input.permissions.includes("tenant.positions.read");
  const canReadAccessRoles = input.permissions.includes("tenant.access_profiles.read");
  const canReadAudit = input.permissions.includes("tenant.audit_events.read");
  const canReadClients = input.permissions.includes("tenant.clients.read");
  const canReadContacts = input.permissions.includes("tenant.contacts.read");
  const canReadProjectTypes = input.permissions.includes("tenant.project_types.read");
  const canReadDealStages = input.permissions.includes("tenant.deal_stages.read");
  const canReadOpportunities = input.permissions.includes("tenant.opportunities.read");
  const canReadProjects = input.permissions.includes("tenant.projects.read");
  const canReadWorkspaceConfig = input.permissions.includes("tenant.workspace_config.read");

  return {
    apiStatus: input.apiStatus,
    me: input.me,
    permissions: input.permissions,
    users: canReadUsers ? input.users?.users ?? [] : [],
    positions: canReadPositions ? input.positions?.positions ?? [] : [],
    accessRoles: canReadAccessRoles ? input.accessRoles?.accessRoles ?? [] : [],
    auditEvents: canReadAudit ? input.auditEvents?.auditEvents ?? [] : [],
    clients: canReadClients ? input.clients?.clients ?? [] : [],
    contacts: canReadContacts ? input.contacts?.contacts ?? [] : [],
    projectTypes: canReadProjectTypes ? input.projectTypes?.projectTypes ?? [] : [],
    dealStages: canReadDealStages ? input.dealStages?.dealStages ?? [] : [],
    opportunities: canReadOpportunities ? input.opportunities?.opportunities ?? [] : [],
    projects: canReadProjects ? input.projects?.projects ?? [] : [],
    myWorkTasks: canReadProjects ? input.myWork?.tasks ?? [] : [],
    customFields: canReadWorkspaceConfig ? input.customFields?.customFields ?? [] : [],
    projectTemplates: canReadWorkspaceConfig
      ? input.projectTemplates?.projectTemplates ?? []
      : []
  };
}
