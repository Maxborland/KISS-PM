import type { AccessProfileId, TenantId, TenantUserId } from "@kiss-pm/domain-core";

export type AccessScope = "own" | "project" | "tenant" | "all";

export type Permission = {
  key: string;
  description: string;
  category: string;
};

export type ScopeRule = {
  permissionKey: string;
  scope: AccessScope;
  constraints?: Record<string, string | number | boolean>;
};

export type AccessProfile = {
  id: AccessProfileId;
  tenantId: TenantId;
  systemKey: string;
  label: string;
  permissions: string[];
  scopeRules: ScopeRule[];
  active: boolean;
  version: number;
  updatedAt: string;
};

export type ProfileAssignment = {
  id: string;
  tenantId: TenantId;
  userId: TenantUserId;
  accessProfileId: AccessProfileId;
  assignedAt: string;
};

export class AccessControlModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "AccessControlModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AccessControlModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new AccessControlModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new AccessControlModelError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new AccessControlModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

export function createPermission(input: {
  key: string;
  description: string;
  category: string;
}): Permission {
  return {
    key: requireNonEmptyString(input.key, "permission.key"),
    description: requireNonEmptyString(input.description, "permission.description"),
    category: requireNonEmptyString(input.category, "permission.category")
  };
}

export function createScopeRule(input: {
  permissionKey: string;
  scope: string;
  constraints?: Record<string, string | number | boolean>;
}): ScopeRule {
  const scope = requireNonEmptyString(input.scope, "scope");
  if (!["own", "project", "tenant", "all"].includes(scope)) {
    throw new AccessControlModelError("validation_error", `Unsupported scope for profile rule: ${scope}`);
  }

  return {
    permissionKey: requireNonEmptyString(input.permissionKey, "permissionKey"),
    scope: scope as AccessScope,
    ...(input.constraints ? { constraints: { ...input.constraints } } : {})
  };
}

export function createAccessProfile(input: {
  id: AccessProfileId;
  tenantId: TenantId;
  systemKey: string;
  label: string;
  permissions: Permission[];
  scopeRules: ScopeRule[];
  active: boolean;
  version: number;
  updatedAt: string;
}): AccessProfile {
  const permissionKeys = input.permissions.map((permission) => requireNonEmptyString(permission.key, "permission.key"));
  const scopeRules = input.scopeRules.map((rule) =>
    createScopeRule({
      permissionKey: rule.permissionKey,
      scope: rule.scope,
      ...(rule.constraints ? { constraints: rule.constraints } : {})
    })
  );
  const seenPermissionKeys = new Set<string>();

  for (const permissionKey of permissionKeys) {
    if (seenPermissionKeys.has(permissionKey)) {
      throw new AccessControlModelError("conflict", `Duplicate permission key: ${permissionKey}`);
    }
    seenPermissionKeys.add(permissionKey);
  }

  for (const rule of scopeRules) {
    if (!seenPermissionKeys.has(rule.permissionKey)) {
      throw new AccessControlModelError(
        "validation_error",
        `Scope rule references permission that is not assigned: ${rule.permissionKey}`
      );
    }
  }

  return {
    id: requireNonEmptyString(input.id, "accessProfile.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    systemKey: requireNonEmptyString(input.systemKey, "accessProfile.systemKey"),
    label: requireNonEmptyString(input.label, "accessProfile.label"),
    permissions: [...permissionKeys],
    scopeRules,
    active: requireBoolean(input.active, "accessProfile.active"),
    version: requirePositiveInteger(input.version, "version"),
    updatedAt: requireValidTimestamp(input.updatedAt, "updatedAt")
  };
}

export function createProfileAssignment(input: {
  id: string;
  tenantId: TenantId;
  userId: TenantUserId;
  accessProfileId: AccessProfileId;
  assignedAt: string;
}): ProfileAssignment {
  return {
    id: requireNonEmptyString(input.id, "profileAssignment.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    userId: requireNonEmptyString(input.userId, "userId"),
    accessProfileId: requireNonEmptyString(input.accessProfileId, "accessProfileId"),
    assignedAt: requireValidTimestamp(input.assignedAt, "assignedAt")
  };
}
