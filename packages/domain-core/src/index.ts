export type TenantId = string;
export type WorkspaceId = string;
export type TenantUserId = string;
export type AccessProfileId = string;
export type CorrelationId = string;

export type AuditResult = "success" | "denied" | "failed";

export type TenantOwned = {
  tenantId: TenantId;
};

export type Tenant = {
  id: TenantId;
  label: string;
  configurationVersion: number;
};

export type Workspace = TenantOwned & {
  id: WorkspaceId;
  label: string;
};

export type TenantUser = TenantOwned & {
  id: TenantUserId;
  displayName: string;
  accessProfileId?: AccessProfileId;
};

export type TenantContext = {
  tenantId: TenantId;
};

export type ActorContext = TenantContext & {
  actorId: TenantUserId;
  accessProfileId?: AccessProfileId;
  correlationId?: CorrelationId;
};

export type TenantIsolationProbe = TenantOwned & {
  id: string;
  label: string;
};

export type AuditTargetRef = {
  entityType: string;
  entityId: string;
};

export type AuditEventDetails = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  previousConfigurationVersion?: number;
  newConfigurationVersion?: number;
  changedLabel?: {
    key: string;
    beforeLabel: string;
    afterLabel: string;
  };
};

export type AuditEvent = TenantOwned & {
  id: string;
  actorId: TenantUserId;
  actionKey: string;
  target: AuditTargetRef;
  result: AuditResult;
  timestamp: string;
  correlationId: CorrelationId;
  details?: AuditEventDetails;
};

export class DomainInvariantError extends Error {
  constructor(
    readonly code: "validation_error" | "tenant_mismatch",
    message: string
  ) {
    super(message);
    this.name = "DomainInvariantError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DomainInvariantError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new DomainInvariantError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new DomainInvariantError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireAuditResult(value: AuditResult | undefined): AuditResult {
  if (value !== "success" && value !== "denied" && value !== "failed") {
    throw new DomainInvariantError("validation_error", "auditEvent.result is invalid");
  }

  return value;
}

function cloneRecord(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;

  return structuredClone(value);
}

function cloneAuditDetails(details: AuditEventDetails | undefined): AuditEventDetails | undefined {
  if (details === undefined) return undefined;

  return {
    ...(details.before !== undefined ? { before: cloneRecord(details.before) } : {}),
    ...(details.after !== undefined ? { after: cloneRecord(details.after) } : {}),
    ...(details.previousConfigurationVersion !== undefined
      ? { previousConfigurationVersion: requirePositiveInteger(details.previousConfigurationVersion, "details.previousConfigurationVersion") }
      : {}),
    ...(details.newConfigurationVersion !== undefined
      ? { newConfigurationVersion: requirePositiveInteger(details.newConfigurationVersion, "details.newConfigurationVersion") }
      : {}),
    ...(details.changedLabel !== undefined
      ? {
          changedLabel: {
            key: requireNonEmptyString(details.changedLabel.key, "details.changedLabel.key"),
            beforeLabel: requireNonEmptyString(details.changedLabel.beforeLabel, "details.changedLabel.beforeLabel"),
            afterLabel: requireNonEmptyString(details.changedLabel.afterLabel, "details.changedLabel.afterLabel")
          }
        }
      : {})
  };
}

export function createTenant(input: {
  id: TenantId;
  label: string;
  configurationVersion?: number;
}): Tenant {
  return {
    id: requireNonEmptyString(input.id, "tenant.id"),
    label: requireNonEmptyString(input.label, "tenant.label"),
    configurationVersion: requirePositiveInteger(input.configurationVersion ?? 1, "tenant.configurationVersion")
  };
}

export function createWorkspace(input: {
  id: WorkspaceId;
  tenantId: TenantId;
  label: string;
}): Workspace {
  return {
    id: requireNonEmptyString(input.id, "workspace.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    label: requireNonEmptyString(input.label, "workspace.label")
  };
}

export function createTenantUser(input: {
  id: TenantUserId;
  tenantId: TenantId;
  displayName: string;
  accessProfileId?: AccessProfileId;
}): TenantUser {
  return {
    id: requireNonEmptyString(input.id, "tenantUser.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    displayName: requireNonEmptyString(input.displayName, "tenantUser.displayName"),
    ...(input.accessProfileId !== undefined
      ? { accessProfileId: requireNonEmptyString(input.accessProfileId, "accessProfileId") }
      : {})
  };
}

export function createTenantContext(input: { tenantId: TenantId }): TenantContext {
  return {
    tenantId: requireNonEmptyString(input.tenantId, "tenantId")
  };
}

export function createActorContext(input: {
  tenantId: TenantId;
  actorId: TenantUserId;
  accessProfileId?: AccessProfileId;
  correlationId?: CorrelationId;
}): ActorContext {
  return {
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    actorId: requireNonEmptyString(input.actorId, "actorId"),
    ...(input.accessProfileId !== undefined
      ? { accessProfileId: requireNonEmptyString(input.accessProfileId, "accessProfileId") }
      : {}),
    ...(input.correlationId !== undefined
      ? { correlationId: requireNonEmptyString(input.correlationId, "correlationId") }
      : {})
  };
}

export function createTenantIsolationProbe(input: {
  id: string;
  tenantId: TenantId;
  label: string;
}): TenantIsolationProbe {
  return {
    id: requireNonEmptyString(input.id, "tenantIsolationProbe.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    label: requireNonEmptyString(input.label, "tenantIsolationProbe.label")
  };
}

export function createAuditTargetRef(input: { entityType: string; entityId: string }): AuditTargetRef {
  return {
    entityType: requireNonEmptyString(input.entityType, "auditTarget.entityType"),
    entityId: requireNonEmptyString(input.entityId, "auditTarget.entityId")
  };
}

export function createAuditEvent(input: {
  id: string;
  actor: ActorContext;
  actionKey: string;
  target: AuditTargetRef;
  result: AuditResult;
  timestamp: string;
  details?: AuditEventDetails;
}): AuditEvent {
  return {
    id: requireNonEmptyString(input.id, "auditEvent.id"),
    tenantId: requireNonEmptyString(input.actor.tenantId, "actor.tenantId"),
    actorId: requireNonEmptyString(input.actor.actorId, "actor.actorId"),
    actionKey: requireNonEmptyString(input.actionKey, "auditEvent.actionKey"),
    target: createAuditTargetRef(input.target),
    result: requireAuditResult(input.result),
    timestamp: requireValidTimestamp(input.timestamp, "auditEvent.timestamp"),
    correlationId: requireNonEmptyString(input.actor.correlationId, "actor.correlationId"),
    ...(input.details !== undefined ? { details: cloneAuditDetails(input.details) } : {})
  };
}

export function assertTenantMatch(context: TenantContext, entity: TenantOwned): void {
  const contextTenantId = requireNonEmptyString(context.tenantId, "context.tenantId");
  const entityTenantId = requireNonEmptyString(entity.tenantId, "entity.tenantId");

  if (contextTenantId !== entityTenantId) {
    throw new DomainInvariantError("tenant_mismatch", "Tenant mismatch");
  }
}
