export const packageName = "@kiss-pm/integrations";

export type TenantId = string;
export type TenantUserId = string;
export type CorrelationId = string;

export type TenantOwned = {
  tenantId: TenantId;
};

export type IntegrationCapability =
  | "import_preview"
  | "import_apply"
  | "health_check"
  | "mapping_diagnostics"
  | "failure_mode_test";

export type IntegrationConnectionStatus = "healthy" | "degraded" | "failed" | "disabled";
export type ExternalEntityType = "account" | "contact" | "opportunity" | "project" | "task" | "assignment" | "resource";
export type CanonicalEntityType = "account" | "contact" | "opportunity" | "project" | "task" | "assignment" | "resource";
export type ExternalMappingSyncStatus = "previewed" | "synced" | "skipped" | "failed" | "conflict";
export type ImportOperation = "import_preview" | "import_apply";
export type SyncAuditCommand = "import_preview" | "import_apply" | "mapping_diagnostic" | "adapter_health_check";
export type SyncAuditResult = "success" | "denied" | "failed";
export type AdapterFailureCode =
  | "adapter_unavailable"
  | "adapter_rate_limited"
  | "adapter_failure"
  | "invalid_payload"
  | "mapping_conflict"
  | "idempotency_conflict";

export type JsonRecord = Record<string, unknown>;

export type IntegrationAdapterDefinition = TenantOwned & {
  id: string;
  systemKey: string;
  label: string;
  sourceSystem: string;
  capabilities: IntegrationCapability[];
  active: boolean;
};

export type IntegrationConnection = TenantOwned & {
  id: string;
  adapterId: string;
  label: string;
  sourceSystem: string;
  status: IntegrationConnectionStatus;
  configuredAt: string;
  healthCheckedAt?: string;
};

export type ExternalPayloadEnvelope = TenantOwned & {
  id: string;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  externalEntityType: ExternalEntityType;
  externalEntityId: string;
  payloadFingerprint: string;
  receivedAt: string;
  payload: JsonRecord;
};

export type ExternalMappingKeyInput = {
  tenantId: TenantId;
  sourceSystem: string;
  externalEntityType: ExternalEntityType;
  externalEntityId: string;
  canonicalEntityType: CanonicalEntityType;
};

export type ImportIdempotencyKeyInput = {
  tenantId: TenantId;
  connectionId: string;
  sourceSystem: string;
  operation: ImportOperation;
  externalEntityType: ExternalEntityType;
  externalEntityId: string;
  payloadFingerprint: string;
};

export type ExternalMapping = TenantOwned &
  ExternalMappingKeyInput & {
    id: string;
    connectionId: string;
    canonicalEntityId: string;
    mappingKey: string;
    lastBatchId: string;
    lastSyncStatus: ExternalMappingSyncStatus;
    lastSyncedAt: string;
    safeMetadata?: JsonRecord;
  };

export type ExternalMappingDiagnostic = ExternalMapping;

export type AdapterFailure = {
  code: AdapterFailureCode;
  message: string;
  retryable: boolean;
  occurredAt: string;
  retryAfterSeconds?: number;
};

export type SyncAuditEvent = TenantOwned & {
  id: string;
  actorId: TenantUserId;
  adapterId: string;
  connectionId: string;
  command: SyncAuditCommand;
  result: SyncAuditResult;
  target: {
    entityType: string;
    entityId: string;
  };
  timestamp: string;
  correlationId: CorrelationId;
  failure?: AdapterFailure;
  details?: JsonRecord;
};

export class IntegrationDomainError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict" | "tenant_mismatch",
    message: string
  ) {
    super(message);
    this.name = "IntegrationDomainError";
  }
}

const supportedCapabilities = new Set<IntegrationCapability>([
  "import_preview",
  "import_apply",
  "health_check",
  "mapping_diagnostics",
  "failure_mode_test"
]);
const supportedConnectionStatuses = new Set<IntegrationConnectionStatus>(["healthy", "degraded", "failed", "disabled"]);
const supportedExternalEntityTypes = new Set<ExternalEntityType>([
  "account",
  "contact",
  "opportunity",
  "project",
  "task",
  "assignment",
  "resource"
]);
const supportedCanonicalEntityTypes = new Set<CanonicalEntityType>([
  "account",
  "contact",
  "opportunity",
  "project",
  "task",
  "assignment",
  "resource"
]);
const supportedSyncStatuses = new Set<ExternalMappingSyncStatus>(["previewed", "synced", "skipped", "failed", "conflict"]);
const supportedAuditCommands = new Set<SyncAuditCommand>([
  "import_preview",
  "import_apply",
  "mapping_diagnostic",
  "adapter_health_check"
]);
const supportedAuditResults = new Set<SyncAuditResult>(["success", "denied", "failed"]);
const supportedFailureCodes = new Set<AdapterFailureCode>([
  "adapter_unavailable",
  "adapter_rate_limited",
  "adapter_failure",
  "invalid_payload",
  "mapping_conflict",
  "idempotency_conflict"
]);

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IntegrationDomainError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new IntegrationDomainError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new IntegrationDomainError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new IntegrationDomainError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireSupported<T extends string>(value: T | undefined, fieldName: string, supported: Set<T>): T {
  const normalized = requireNonEmptyString(value, fieldName) as T;
  if (!supported.has(normalized)) {
    throw new IntegrationDomainError("validation_error", `${fieldName} is unsupported: ${normalized}`);
  }

  return normalized;
}

function cloneRecord(value: JsonRecord | undefined, fieldName: string): JsonRecord | undefined {
  if (value === undefined) return undefined;
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new IntegrationDomainError("validation_error", `${fieldName} must be an object`);
  }

  return structuredClone(value);
}

function requireCapabilities(capabilities: IntegrationCapability[]): IntegrationCapability[] {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new IntegrationDomainError("validation_error", "capabilities must be a non-empty array");
  }

  const seen = new Set<IntegrationCapability>();
  return capabilities.map((capability) => {
    const supported = requireSupported(capability, "capability", supportedCapabilities);
    if (seen.has(supported)) {
      throw new IntegrationDomainError("conflict", `Duplicate integration capability: ${supported}`);
    }
    seen.add(supported);
    return supported;
  });
}

function isSecretKey(key: string): boolean {
  return /(secret|token|password|credential|private|api[_-]?key)/i.test(key);
}

function redactSecrets(value: unknown, keyHint = ""): unknown {
  if (isSecretKey(keyHint)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, nestedValue]) => [key, redactSecrets(nestedValue, key)])
    );
  }

  return value;
}

export function createIntegrationAdapterDefinition(input: {
  id: string;
  tenantId: TenantId;
  systemKey: string;
  label: string;
  sourceSystem: string;
  capabilities: IntegrationCapability[];
  active: boolean;
}): IntegrationAdapterDefinition {
  return {
    id: requireNonEmptyString(input.id, "adapter.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    systemKey: requireNonEmptyString(input.systemKey, "adapter.systemKey"),
    label: requireNonEmptyString(input.label, "adapter.label"),
    sourceSystem: requireNonEmptyString(input.sourceSystem, "adapter.sourceSystem"),
    capabilities: requireCapabilities(input.capabilities),
    active: requireBoolean(input.active, "adapter.active")
  };
}

export function createIntegrationConnection(input: {
  id: string;
  tenantId: TenantId;
  adapterId: string;
  label: string;
  sourceSystem: string;
  status: IntegrationConnectionStatus;
  configuredAt: string;
  healthCheckedAt?: string;
}): IntegrationConnection {
  return {
    id: requireNonEmptyString(input.id, "connection.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    adapterId: requireNonEmptyString(input.adapterId, "connection.adapterId"),
    label: requireNonEmptyString(input.label, "connection.label"),
    sourceSystem: requireNonEmptyString(input.sourceSystem, "connection.sourceSystem"),
    status: requireSupported(input.status, "connection.status", supportedConnectionStatuses),
    configuredAt: requireValidTimestamp(input.configuredAt, "connection.configuredAt"),
    ...(input.healthCheckedAt !== undefined
      ? { healthCheckedAt: requireValidTimestamp(input.healthCheckedAt, "connection.healthCheckedAt") }
      : {})
  };
}

export function createExternalPayloadEnvelope(input: {
  id: string;
  tenantId: TenantId;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  externalEntityType: ExternalEntityType;
  externalEntityId: string;
  payloadFingerprint: string;
  receivedAt: string;
  payload: JsonRecord;
}): ExternalPayloadEnvelope {
  return {
    id: requireNonEmptyString(input.id, "payload.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    adapterId: requireNonEmptyString(input.adapterId, "payload.adapterId"),
    connectionId: requireNonEmptyString(input.connectionId, "payload.connectionId"),
    sourceSystem: requireNonEmptyString(input.sourceSystem, "payload.sourceSystem"),
    externalEntityType: requireSupported(
      input.externalEntityType,
      "payload.externalEntityType",
      supportedExternalEntityTypes
    ),
    externalEntityId: requireNonEmptyString(input.externalEntityId, "payload.externalEntityId"),
    payloadFingerprint: requireNonEmptyString(input.payloadFingerprint, "payload.payloadFingerprint"),
    receivedAt: requireValidTimestamp(input.receivedAt, "payload.receivedAt"),
    payload: cloneRecord(input.payload, "payload") ?? {}
  };
}

export function buildExternalMappingKey(input: ExternalMappingKeyInput): string {
  return [
    requireNonEmptyString(input.tenantId, "tenantId"),
    requireNonEmptyString(input.sourceSystem, "mapping.sourceSystem"),
    requireSupported(input.externalEntityType, "mapping.externalEntityType", supportedExternalEntityTypes),
    requireNonEmptyString(input.externalEntityId, "mapping.externalEntityId"),
    requireSupported(input.canonicalEntityType, "mapping.canonicalEntityType", supportedCanonicalEntityTypes)
  ].join("|");
}

export function buildImportIdempotencyKey(input: ImportIdempotencyKeyInput): string {
  return [
    requireNonEmptyString(input.tenantId, "tenantId"),
    requireNonEmptyString(input.connectionId, "idempotency.connectionId"),
    requireNonEmptyString(input.sourceSystem, "idempotency.sourceSystem"),
    requireSupported(input.operation, "idempotency.operation", new Set<ImportOperation>(["import_preview", "import_apply"])),
    requireSupported(input.externalEntityType, "idempotency.externalEntityType", supportedExternalEntityTypes),
    requireNonEmptyString(input.externalEntityId, "idempotency.externalEntityId"),
    requireNonEmptyString(input.payloadFingerprint, "idempotency.payloadFingerprint")
  ].join("|");
}

export function createExternalMapping(
  input: Omit<ExternalMapping, "mappingKey">
): ExternalMapping {
  const mappingKey = buildExternalMappingKey(input);
  return {
    id: requireNonEmptyString(input.id, "mapping.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    sourceSystem: requireNonEmptyString(input.sourceSystem, "mapping.sourceSystem"),
    connectionId: requireNonEmptyString(input.connectionId, "mapping.connectionId"),
    externalEntityType: requireSupported(input.externalEntityType, "mapping.externalEntityType", supportedExternalEntityTypes),
    externalEntityId: requireNonEmptyString(input.externalEntityId, "mapping.externalEntityId"),
    canonicalEntityType: requireSupported(input.canonicalEntityType, "mapping.canonicalEntityType", supportedCanonicalEntityTypes),
    canonicalEntityId: requireNonEmptyString(input.canonicalEntityId, "mapping.canonicalEntityId"),
    mappingKey,
    lastBatchId: requireNonEmptyString(input.lastBatchId, "mapping.lastBatchId"),
    lastSyncStatus: requireSupported(input.lastSyncStatus, "mapping.lastSyncStatus", supportedSyncStatuses),
    lastSyncedAt: requireValidTimestamp(input.lastSyncedAt, "mapping.lastSyncedAt"),
    ...(input.safeMetadata !== undefined ? { safeMetadata: cloneRecord(input.safeMetadata, "mapping.safeMetadata") } : {})
  };
}

export function createExternalMappingDiagnostic(mapping: ExternalMapping): ExternalMappingDiagnostic {
  return {
    ...mapping,
    safeMetadata: (redactSecrets(mapping.safeMetadata ?? {}) as JsonRecord)
  };
}

export function createAdapterFailure(input: {
  code: AdapterFailureCode;
  message: string;
  retryable: boolean;
  occurredAt: string;
  retryAfterSeconds?: number;
}): AdapterFailure {
  return {
    code: requireSupported(input.code, "adapterFailure.code", supportedFailureCodes),
    message: requireNonEmptyString(input.message, "adapterFailure.message"),
    retryable: requireBoolean(input.retryable, "adapterFailure.retryable"),
    occurredAt: requireValidTimestamp(input.occurredAt, "adapterFailure.occurredAt"),
    ...(input.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: requirePositiveInteger(input.retryAfterSeconds, "retryAfterSeconds") }
      : {})
  };
}

export function createSyncAuditEvent(input: {
  id: string;
  tenantId: TenantId;
  actorId: TenantUserId;
  adapterId: string;
  connectionId: string;
  command: SyncAuditCommand;
  result: SyncAuditResult;
  target: {
    entityType: string;
    entityId: string;
  };
  timestamp: string;
  correlationId: CorrelationId;
  failure?: AdapterFailure;
  details?: JsonRecord;
}): SyncAuditEvent {
  return {
    id: requireNonEmptyString(input.id, "syncAudit.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    actorId: requireNonEmptyString(input.actorId, "syncAudit.actorId"),
    adapterId: requireNonEmptyString(input.adapterId, "syncAudit.adapterId"),
    connectionId: requireNonEmptyString(input.connectionId, "syncAudit.connectionId"),
    command: requireSupported(input.command, "syncAudit.command", supportedAuditCommands),
    result: requireSupported(input.result, "syncAudit.result", supportedAuditResults),
    target: {
      entityType: requireNonEmptyString(input.target.entityType, "syncAudit.target.entityType"),
      entityId: requireNonEmptyString(input.target.entityId, "syncAudit.target.entityId")
    },
    timestamp: requireValidTimestamp(input.timestamp, "syncAudit.timestamp"),
    correlationId: requireNonEmptyString(input.correlationId, "syncAudit.correlationId"),
    ...(input.failure !== undefined ? { failure: createAdapterFailure(input.failure) } : {}),
    ...(input.details !== undefined ? { details: redactSecrets(cloneRecord(input.details, "syncAudit.details")) as JsonRecord } : {})
  };
}
