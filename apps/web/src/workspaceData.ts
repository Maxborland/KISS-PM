import type { AccessRole, AuditEvent, AuthMeResponse, Position, WorkspaceUser } from "./api";

export type WorkspaceData = {
  apiStatus: string;
  me: WorkspaceUser;
  permissions: string[];
  users: WorkspaceUser[];
  positions: Position[];
  accessRoles: AccessRole[];
  auditEvents: AuditEvent[];
};

export function buildWorkspaceData(input: {
  apiStatus: string;
  me: AuthMeResponse["user"];
  permissions: string[];
  users: { users: WorkspaceUser[] } | undefined;
  positions: { positions: Position[] } | undefined;
  accessRoles: { accessRoles: AccessRole[] } | undefined;
  auditEvents: { auditEvents: AuditEvent[] } | undefined;
}): WorkspaceData {
  const canReadUsers = input.permissions.includes("tenant.users.read");
  const canReadPositions = input.permissions.includes("tenant.positions.read");
  const canReadAccessRoles = input.permissions.includes("tenant.access_profiles.read");
  const canReadAudit = input.permissions.includes("tenant.audit_events.read");

  return {
    apiStatus: input.apiStatus,
    me: input.me,
    permissions: input.permissions,
    users: canReadUsers ? input.users?.users ?? [] : [],
    positions: canReadPositions ? input.positions?.positions ?? [] : [],
    accessRoles: canReadAccessRoles ? input.accessRoles?.accessRoles ?? [] : [],
    auditEvents: canReadAudit ? input.auditEvents?.auditEvents ?? [] : []
  };
}
