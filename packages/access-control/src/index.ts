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
