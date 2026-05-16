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

export type PolicyTargetRef = {
  entityType: string;
  tenantId: TenantId;
  entityId?: string;
  ownerId?: TenantUserId;
  projectId?: string;
};

export type PolicyRequest = {
  actor: {
    tenantId: TenantId;
    actorId: TenantUserId;
  };
  profile: AccessProfile;
  permissionKey: string;
  target: PolicyTargetRef;
  requestedScope?: string;
  contextRefs?: {
    projectIds?: string[];
  };
};

export type PolicyEvaluation = {
  allowed: boolean;
  reasonCode:
    | "allowed"
    | "profile_tenant_mismatch"
    | "tenant_mismatch"
    | "unsupported_scope"
    | "profile_inactive"
    | "permission_missing"
    | "scope_not_granted"
    | "owner_mismatch"
    | "project_scope_unavailable"
    | "project_scope_mismatch";
  scope?: AccessScope | string;
  trace: string[];
};

export const TASK_PARTICIPANT_READ_PERMISSION: Permission = {
  key: "task_participant.read",
  description: "Read task participant relation",
  category: "task_work_management"
};

export const TASK_PARTICIPANT_MANAGE_PERMISSION: Permission = {
  key: "task_participant.manage",
  description: "Manage task participant relation",
  category: "task_work_management"
};

export const TENANT_CONFIG_READ_PERMISSION: Permission = {
  key: "tenant.config.read",
  description: "Read tenant configuration",
  category: "tenant_configuration"
};

export const TENANT_CONFIG_WRITE_PERMISSION: Permission = {
  key: "tenant.config.write",
  description: "Preview and publish tenant configuration",
  category: "tenant_configuration"
};

export const TENANT_CONFIG_EXPORT_PERMISSION: Permission = {
  key: "tenant.config.export",
  description: "Export tenant configuration",
  category: "tenant_configuration"
};

export const TENANT_CONFIG_IMPORT_PERMISSION: Permission = {
  key: "tenant.config.import",
  description: "Import tenant configuration",
  category: "tenant_configuration"
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

export function createTaskParticipantPolicyTarget(input: {
  tenantId: TenantId;
  taskId: string;
  projectId: string;
  userId: TenantUserId;
}): PolicyTargetRef {
  return {
    entityType: "taskParticipant",
    tenantId: requireNonEmptyString(input.tenantId, "taskParticipant.tenantId"),
    entityId: requireNonEmptyString(input.taskId, "taskParticipant.taskId"),
    ownerId: requireNonEmptyString(input.userId, "taskParticipant.userId"),
    projectId: requireNonEmptyString(input.projectId, "taskParticipant.projectId")
  };
}

function isSupportedScope(scope: string): scope is AccessScope {
  return ["own", "project", "tenant", "all"].includes(scope);
}

function deny(
  reasonCode: PolicyEvaluation["reasonCode"],
  trace: string[],
  scope?: AccessScope | string
): PolicyEvaluation {
  return {
    allowed: false,
    reasonCode,
    ...(scope ? { scope } : {}),
    trace
  };
}

function allow(scope: AccessScope, trace: string[]): PolicyEvaluation {
  return {
    allowed: true,
    reasonCode: "allowed",
    scope,
    trace
  };
}

function evaluateScopeRule(request: PolicyRequest, rule: ScopeRule, trace: string[]): PolicyEvaluation {
  const scope = rule.scope as string;
  trace.push(`policy:scope_rule scope=${scope}`);

  if (!isSupportedScope(scope)) {
    trace.push(`policy:unsupported_scope scope=${scope}`);
    return deny("unsupported_scope", trace, scope);
  }

  if (scope === "all" || scope === "tenant") {
    trace.push(`policy:allowed scope=${scope}`);
    return allow(scope, trace);
  }

  if (scope === "own") {
    if (request.target.ownerId && request.target.ownerId === request.actor.actorId) {
      trace.push("policy:allowed scope=own");
      return allow("own", trace);
    }

    trace.push("policy:owner_mismatch");
    return deny("owner_mismatch", trace, "own");
  }

  if (!request.target.projectId) {
    trace.push("policy:project_scope_unavailable");
    return deny("project_scope_unavailable", trace, "project");
  }

  if (request.contextRefs?.projectIds?.includes(request.target.projectId)) {
    trace.push("policy:allowed scope=project");
    return allow("project", trace);
  }

  trace.push("policy:project_scope_mismatch");
  return deny("project_scope_mismatch", trace, "project");
}

export function evaluatePolicy(request: PolicyRequest): PolicyEvaluation {
  const permissionKey = requireNonEmptyString(request.permissionKey, "permissionKey");
  const actorTenantId = requireNonEmptyString(request.actor.tenantId, "actor.tenantId");
  const actorId = requireNonEmptyString(request.actor.actorId, "actor.actorId");
  const targetTenantId = requireNonEmptyString(request.target.tenantId, "target.tenantId");
  const targetType = requireNonEmptyString(request.target.entityType, "target.entityType");
  const trace = [`policy:start tenant=${actorTenantId} actor=${actorId} permission=${permissionKey} targetType=${targetType}`];

  if (request.profile.tenantId !== actorTenantId) {
    trace.push("policy:profile_tenant_mismatch");
    return deny("profile_tenant_mismatch", trace);
  }

  if (targetTenantId !== actorTenantId) {
    trace.push("policy:tenant_mismatch");
    return deny("tenant_mismatch", trace);
  }

  trace.push("policy:tenant_match");

  if (request.requestedScope !== undefined) {
    const requestedScope = requireNonEmptyString(request.requestedScope, "requestedScope");
    if (!isSupportedScope(requestedScope)) {
      trace.push(`policy:unsupported_scope scope=${requestedScope}`);
      return deny("unsupported_scope", trace, requestedScope);
    }
  }

  if (!request.profile.active) {
    trace.push(`policy:profile_inactive version=${request.profile.version}`);
    return deny("profile_inactive", trace);
  }

  trace.push(`policy:profile_active version=${request.profile.version}`);

  if (!request.profile.permissions.includes(permissionKey)) {
    trace.push("policy:permission_missing");
    return deny("permission_missing", trace);
  }

  trace.push("policy:permission_present");

  const matchingScopeRules = request.profile.scopeRules.filter((rule) => {
    if (rule.permissionKey !== permissionKey) return false;
    return request.requestedScope === undefined || rule.scope === request.requestedScope;
  });

  if (matchingScopeRules.length === 0) {
    trace.push("policy:scope_not_granted");
    return deny("scope_not_granted", trace, request.requestedScope);
  }

  let lastDenied: PolicyEvaluation | undefined;
  for (const rule of matchingScopeRules) {
    const evaluation = evaluateScopeRule(request, rule, [...trace]);
    if (evaluation.allowed) {
      return evaluation;
    }
    lastDenied = evaluation;
  }

  return lastDenied ?? deny("scope_not_granted", trace, request.requestedScope);
}
