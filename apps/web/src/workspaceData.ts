import type {
  AccessRole,
  AuditEvent,
  AuthMeResponse,
  CustomFieldDefinition,
  Opportunity,
  Position,
  Project,
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
  opportunities: Opportunity[];
  projects: Project[];
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
  opportunities: { opportunities: Opportunity[] } | undefined;
  projects: { projects: Project[] } | undefined;
  customFields: { customFields: CustomFieldDefinition[] } | undefined;
  projectTemplates: { projectTemplates: ProjectTemplate[] } | undefined;
}): WorkspaceData {
  const canReadUsers = input.permissions.includes("tenant.users.read");
  const canReadPositions = input.permissions.includes("tenant.positions.read");
  const canReadAccessRoles = input.permissions.includes("tenant.access_profiles.read");
  const canReadAudit = input.permissions.includes("tenant.audit_events.read");
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
    opportunities: canReadOpportunities ? input.opportunities?.opportunities ?? [] : [],
    projects: canReadProjects ? input.projects?.projects ?? [] : [],
    customFields: canReadWorkspaceConfig ? input.customFields?.customFields ?? [] : [],
    projectTemplates: canReadWorkspaceConfig
      ? input.projectTemplates?.projectTemplates ?? []
      : []
  };
}
