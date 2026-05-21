import type { TenantId, TenantUser } from "@kiss-pm/domain";

export const permissions = [
  "tenant.users.read",
  "tenant.users.manage",
  "tenant.access_profiles.read",
  "tenant.access_profiles.manage",
  "tenant.positions.read",
  "tenant.positions.manage",
  "tenant.audit_events.read",
  "tenant.workspace_config.read",
  "tenant.workspace_config.manage",
  "tenant.clients.read",
  "tenant.clients.manage",
  "tenant.contacts.read",
  "tenant.contacts.manage",
  "tenant.products.read",
  "tenant.products.manage",
  "tenant.project_types.read",
  "tenant.project_types.manage",
  "tenant.deal_stages.read",
  "tenant.deal_stages.manage",
  "tenant.opportunities.read",
  "tenant.opportunities.manage",
  "tenant.projects.read",
  "tenant.projects.manage",
  "tenant.tasks.create",
  "tenant.tasks.edit",
  "tenant.tasks.delete",
  "tenant.task_statuses.manage",
  "tenant.project_activation.manage",
  "tenant.resource_feasibility.read",
  "profile.read",
  "profile.update",
  "workspace.theme.manage"
] as const;

export type Permission = (typeof permissions)[number];

export type AccessProfile = {
  id: string;
  permissions: readonly Permission[];
};

export type PolicyDecisionReason =
  | "same_tenant_permission_granted"
  | "cross_tenant_denied"
  | "permission_missing";

export type PolicyDecision = {
  allowed: boolean;
  reason: PolicyDecisionReason;
};

export function createAccessProfile(input: AccessProfile): AccessProfile {
  return {
    id: input.id,
    permissions: [...input.permissions]
  };
}

export function isPermission(value: string): value is Permission {
  return permissions.includes(value as Permission);
}

export function canReadTenantUsers(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.users.read"
  });
}

export function canManageTenantUsers(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.users.manage"
  });
}

export function canReadAccessProfiles(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.access_profiles.read"
  });
}

export function canManageAccessProfiles(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.access_profiles.manage"
  });
}

export function canReadAuditEvents(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.audit_events.read"
  });
}

export function canReadPositions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.positions.read"
  });
}

export function canReadWorkspaceConfig(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.workspace_config.read"
  });
}

export function canManageWorkspaceConfig(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.workspace_config.manage"
  });
}

export function canReadOpportunities(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.opportunities.read"
  });
}

export function canReadClients(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.clients.read"
  });
}

export function canManageClients(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.clients.manage"
  });
}

export function canReadContacts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.contacts.read"
  });
}

export function canManageContacts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.contacts.manage"
  });
}

export function canReadProducts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.products.read"
  });
}

export function canManageProducts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.products.manage"
  });
}

export function canReadProjectTypes(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_types.read"
  });
}

export function canManageProjectTypes(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_types.manage"
  });
}

export function canReadDealStages(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.deal_stages.read"
  });
}

export function canManageDealStages(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.deal_stages.manage"
  });
}

export function canManageOpportunities(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.opportunities.manage"
  });
}

export function canReadProjects(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.projects.read"
  });
}

export function canManageProjects(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.projects.manage"
  });
}

export function canCreateTasks(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.tasks.create"
  });
}

export function canEditTasks(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.tasks.edit"
  });
}

export function canDeleteTasks(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.tasks.delete"
  });
}

export function canManageTaskStatuses(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.task_statuses.manage"
  });
}

export function canManageProjectActivation(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_activation.manage"
  });
}

export function canReadResourceFeasibility(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.resource_feasibility.read"
  });
}

export function canManagePositions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.positions.manage"
  });
}

export function canUpdateProfile(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "profile.update"
  });
}

export function canManageWorkspaceTheme(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "workspace.theme.manage"
  });
}

function evaluateTenantPermission(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
  permission: Permission;
}): PolicyDecision {
  if (input.actor.tenantId !== input.targetTenantId) {
    return {
      allowed: false,
      reason: "cross_tenant_denied"
    };
  }

  if (!input.profile.permissions.includes(input.permission)) {
    return {
      allowed: false,
      reason: "permission_missing"
    };
  }

  return {
    allowed: true,
    reason: "same_tenant_permission_granted"
  };
}
