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
export type RetryBackoffStrategy = "fixed" | "linear" | "exponential";
export type AdapterHealthState = "healthy" | "degraded" | "failed" | "rate_limited" | "unavailable" | "disabled";
export type AdapterFailureCode =
  | "adapter_unavailable"
  | "adapter_rate_limited"
  | "adapter_failure"
  | "invalid_payload"
  | "tenant_mismatch"
  | "mapping_conflict"
  | "idempotency_conflict"
  | "import_preview_required"
  | "stale_preview"
  | "partial_import_rejected";

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

export type RetryPolicy = {
  maxAttempts: number;
  backoff: RetryBackoffStrategy;
  retryableFailureCodes: AdapterFailureCode[];
};

export type RateLimitPolicy = {
  windowSeconds: number;
  maxRequests: number;
  retryAfterSeconds?: number;
};

export type AdapterHealthStatus = TenantOwned & {
  adapterId: string;
  connectionId: string;
  status: AdapterHealthState;
  checkedAt: string;
  failure?: AdapterFailure;
  retryPolicy?: RetryPolicy;
  rateLimitPolicy?: RateLimitPolicy;
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

export type ImportPreviewAction = "create" | "update" | "skip" | "error";
export type ImportValidationIssueSeverity = "blocking" | "warning";
export type ImportValidationIssueCode =
  | "canonical_title_missing"
  | "date_window_invalid"
  | "external_id_missing"
  | "task_due_date_outside_project_window"
  | "tenant_mismatch";

export type ImportValidationIssue = {
  code: ImportValidationIssueCode;
  severity: ImportValidationIssueSeverity;
  fieldPath: string;
  message: string;
  recoveryText: string;
  externalEntityType?: ExternalEntityType;
  externalEntityId?: string;
};

export type CanonicalImportEntityRef = {
  entityType: CanonicalEntityType;
  entityId: string;
  displayName: string;
};

export type ImportPreviewMapping = ExternalMappingKeyInput & {
  action: ImportPreviewAction;
  canonicalEntityId: string;
  mappingKey: string;
  existingMappingId?: string;
};

export type MockAdapterCanonicalImportPayload = {
  opportunity: {
    externalId: string;
    title: string;
    account?: {
      externalId: string;
      displayName: string;
      legalName?: string;
      taxId?: string;
    };
    contacts?: {
      externalId: string;
      displayName: string;
      email?: string;
      phone?: string;
      roleLabel?: string;
    }[];
    plannedStartDate: string;
    desiredFinishDate: string;
    expectedValue: {
      amount: number;
      currency: string;
    };
    probability: number;
    categoryKey: string;
    typologyKey: string;
    scopeHints?: {
      key: string;
      label: string;
      value: string | number | boolean;
    }[];
  };
  project: {
    externalId: string;
    title: string;
    template: {
      templateId: string;
      key: string;
      label: string;
      version: number;
      matchConfidence: number;
      assumptions: {
        code: string;
        message: string;
      }[];
    };
    demand: {
      totalPlannedWorkHours: number;
      scenarioKey: string;
      scenarioLabel: string;
      formulaKey: string;
      formulaVersion: number;
      confidence: number;
      stageRoleDemands: {
        stageKey: string;
        stageLabel: string;
        roleKey: string;
        roleLabel: string;
        plannedWorkHours: number;
      }[];
    };
    feasibility: {
      status: "fit" | "overloaded";
      severity: "none" | "warning" | "critical";
      blockerCodes: string[];
    };
  };
  tasks?: {
    externalId: string;
    title: string;
    stageKey: string;
    plannedWorkHours: number;
    dueDate: string;
    participantRoleKeys: string[];
  }[];
};

export type MockAdapterCanonicalImportPreview = TenantOwned & {
  id: string;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  payloadFingerprint: string;
  receivedAt: string;
  previewedAt: string;
  mutatesState: false;
  report: {
    creates: number;
    updates: number;
    skips: number;
    errors: number;
  };
  validationIssues: ImportValidationIssue[];
  affectedCanonicalEntities: CanonicalImportEntityRef[];
  mappingPreview: ImportPreviewMapping[];
  canonical: {
    account?: {
      id: string;
      tenantId: TenantId;
      displayName: string;
      legalName?: string;
      taxId?: string;
    };
    contacts: {
      id: string;
      tenantId: TenantId;
      accountId?: string;
      displayName: string;
      email?: string;
      phone?: string;
      roleLabel?: string;
    }[];
    opportunity?: {
      id: string;
      tenantId: TenantId;
      title: string;
      plannedStartDate: string;
      desiredFinishDate: string;
      expectedValue: {
        amount: number;
        currency: string;
      };
      probability: number;
      categoryKey: string;
      typologyKey: string;
      scopeHints: {
        key: string;
        label: string;
        value: string | number | boolean;
      }[];
    };
    projectDraft?: {
      id: string;
      tenantId: TenantId;
      title: string;
      sourceOpportunity: {
        tenantId: TenantId;
        type: "crm_opportunity";
        opportunityId: string;
        title: string;
        accountId?: string;
        contactIds: string[];
        plannedStartDate: string;
        desiredFinishDate: string;
      };
      processTemplate: MockAdapterCanonicalImportPayload["project"]["template"] & {
        tenantId: TenantId;
      };
      demand: MockAdapterCanonicalImportPayload["project"]["demand"] & {
        tenantId: TenantId;
      };
      feasibility: MockAdapterCanonicalImportPayload["project"]["feasibility"] & {
        tenantId: TenantId;
        expectedWindow: {
          startDate: string;
          endDate: string;
        };
      };
    };
    tasks: {
      id: string;
      tenantId: TenantId;
      title: string;
      stageKey: string;
      plannedWorkHours: number;
      dueDate: string;
      participantRoleKeys: string[];
    }[];
  };
};

export type MigrationValidationReport = TenantOwned & {
  id: string;
  previewId: string;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  generatedAt: string;
  mutatesState: false;
  safeToApply: boolean;
  summary: {
    creates: number;
    updates: number;
    skips: number;
    errors: number;
    totalAffected: number;
    blockingIssues: number;
    warningIssues: number;
  };
  blockers: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
  sampleMappings: ImportPreviewMapping[];
  affectedCanonicalEntities: CanonicalImportEntityRef[];
  recoveryActions: {
    code: ImportValidationIssueCode;
    label: string;
    fieldPath: string;
    externalEntityType?: ExternalEntityType;
    externalEntityId?: string;
  }[];
};

export type ImportDryRunSummary = TenantOwned & {
  id: string;
  previewId: string;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  generatedAt: string;
  mutatesState: false;
  canApply: boolean;
  expectedCreates: number;
  expectedUpdates: number;
  expectedSkips: number;
  expectedErrors: number;
  expectedTotalAffected: number;
  blockers: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
  mappingSample: ImportPreviewMapping[];
  canonicalEntitySample: CanonicalImportEntityRef[];
  recoveryText: string[];
};

export type ImportBatchResultStatus = "applied" | "idempotent_replay";

export type ImportBatch = TenantOwned & {
  id: string;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  previewId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  mappingKeys: string[];
  canonicalEntityRefs: CanonicalImportEntityRef[];
  resultStatus: ImportBatchResultStatus;
  appliedAt: string;
  actorId: TenantUserId;
};

export type ImportApplyResult = TenantOwned & {
  status: ImportBatchResultStatus;
  idempotentReplay: boolean;
  batch: ImportBatch;
  mappings: ExternalMapping[];
  canonicalEntityRefs: CanonicalImportEntityRef[];
  audit: SyncAuditEvent;
};

export class IntegrationDomainError extends Error {
  constructor(
    readonly code:
      | "validation_error"
      | "conflict"
      | "tenant_mismatch"
      | "import_preview_required"
      | "stale_preview"
      | "idempotency_conflict"
      | "adapter_unavailable"
      | "adapter_rate_limited"
      | "adapter_failure"
      | "invalid_payload"
      | "mapping_conflict"
      | "partial_import_rejected",
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
const supportedRetryBackoffs = new Set<RetryBackoffStrategy>(["fixed", "linear", "exponential"]);
const supportedAdapterHealthStates = new Set<AdapterHealthState>([
  "healthy",
  "degraded",
  "failed",
  "rate_limited",
  "unavailable",
  "disabled"
]);
const supportedFailureCodes = new Set<AdapterFailureCode>([
  "adapter_unavailable",
  "adapter_rate_limited",
  "adapter_failure",
  "invalid_payload",
  "tenant_mismatch",
  "mapping_conflict",
  "idempotency_conflict",
  "import_preview_required",
  "stale_preview",
  "partial_import_rejected"
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

function redactSecretText(value: string): string {
  return value.replace(/(secret|token|password|credential|api[_-]?key)[=: -]*[A-Za-z0-9._-]+/gi, "$1=[redacted]");
}

function stableIdSegment(parts: string[]): string {
  let hash = 2166136261;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}

function deterministicCanonicalId(input: {
  tenantId: TenantId;
  sourceSystem: string;
  entityType: CanonicalEntityType;
  externalId: string;
}): string {
  return `imported-${input.entityType}-${stableIdSegment([
    requireNonEmptyString(input.tenantId, "tenantId"),
    requireNonEmptyString(input.sourceSystem, "sourceSystem"),
    input.entityType,
    requireNonEmptyString(input.externalId, `${input.entityType}.externalId`)
  ])}`;
}

function requireIsoDate(value: string | undefined, fieldName: string): string {
  const date = requireNonEmptyString(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new IntegrationDomainError("validation_error", `${fieldName} must be an ISO date`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new IntegrationDomainError("validation_error", `${fieldName} must be a valid ISO date`);
  }

  return date;
}

function tryRequireIsoDate(value: string | undefined): string | undefined {
  try {
    return requireIsoDate(value, "date");
  } catch {
    return undefined;
  }
}

function createValidationIssue(input: ImportValidationIssue): ImportValidationIssue {
  return {
    code: input.code,
    severity: input.severity,
    fieldPath: input.fieldPath,
    message: input.message,
    recoveryText: input.recoveryText,
    ...(input.externalEntityType !== undefined ? { externalEntityType: input.externalEntityType } : {}),
    ...(input.externalEntityId !== undefined ? { externalEntityId: input.externalEntityId } : {})
  };
}

function findExistingMapping(
  mappings: ExternalMapping[] | undefined,
  input: ExternalMappingKeyInput
): ExternalMapping | undefined {
  const mappingKey = buildExternalMappingKey(input);
  return (mappings ?? []).find((mapping) => mapping.mappingKey === mappingKey);
}

function previewActionForMapping(
  mapping: ExternalMapping | undefined,
  payloadFingerprint: string
): Exclude<ImportPreviewAction, "error"> {
  if (mapping === undefined) return "create";
  return mapping.safeMetadata?.payloadFingerprint === payloadFingerprint ? "skip" : "update";
}

function createPreviewMapping(input: {
  tenantId: TenantId;
  sourceSystem: string;
  externalEntityType: ExternalEntityType;
  externalEntityId: string;
  canonicalEntityType: CanonicalEntityType;
  canonicalEntityId: string;
  payloadFingerprint: string;
  existingMappings?: ExternalMapping[];
}): ImportPreviewMapping {
  const keyInput: ExternalMappingKeyInput = {
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem,
    externalEntityType: input.externalEntityType,
    externalEntityId: input.externalEntityId,
    canonicalEntityType: input.canonicalEntityType
  };
  const existingMapping = findExistingMapping(input.existingMappings, keyInput);

  return {
    ...keyInput,
    canonicalEntityId: existingMapping?.canonicalEntityId ?? input.canonicalEntityId,
    mappingKey: buildExternalMappingKey(keyInput),
    action: previewActionForMapping(existingMapping, input.payloadFingerprint),
    ...(existingMapping !== undefined ? { existingMappingId: existingMapping.id } : {})
  };
}

function deterministicMappingId(mappingKey: string): string {
  return `mapping-${stableIdSegment([mappingKey])}`;
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
    message: redactSecretText(requireNonEmptyString(input.message, "adapterFailure.message")),
    retryable: requireBoolean(input.retryable, "adapterFailure.retryable"),
    occurredAt: requireValidTimestamp(input.occurredAt, "adapterFailure.occurredAt"),
    ...(input.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: requirePositiveInteger(input.retryAfterSeconds, "retryAfterSeconds") }
      : {})
  };
}

export function createRetryPolicy(input: {
  maxAttempts: number;
  backoff: RetryBackoffStrategy;
  retryableFailureCodes: AdapterFailureCode[];
}): RetryPolicy {
  if (!Array.isArray(input.retryableFailureCodes) || input.retryableFailureCodes.length === 0) {
    throw new IntegrationDomainError("validation_error", "retryPolicy.retryableFailureCodes must be a non-empty array");
  }
  const seen = new Set<AdapterFailureCode>();
  return {
    maxAttempts: requirePositiveInteger(input.maxAttempts, "retryPolicy.maxAttempts"),
    backoff: requireSupported(input.backoff, "retryPolicy.backoff", supportedRetryBackoffs),
    retryableFailureCodes: input.retryableFailureCodes.map((code) => {
      const supported = requireSupported(code, "retryPolicy.retryableFailureCode", supportedFailureCodes);
      if (seen.has(supported)) {
        throw new IntegrationDomainError("conflict", `Duplicate retryable failure code: ${supported}`);
      }
      seen.add(supported);
      return supported;
    })
  };
}

export function createRateLimitPolicy(input: {
  windowSeconds: number;
  maxRequests: number;
  retryAfterSeconds?: number;
}): RateLimitPolicy {
  return {
    windowSeconds: requirePositiveInteger(input.windowSeconds, "rateLimitPolicy.windowSeconds"),
    maxRequests: requirePositiveInteger(input.maxRequests, "rateLimitPolicy.maxRequests"),
    ...(input.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: requirePositiveInteger(input.retryAfterSeconds, "rateLimitPolicy.retryAfterSeconds") }
      : {})
  };
}

export function createAdapterHealthStatus(input: {
  tenantId: TenantId;
  adapterId: string;
  connectionId: string;
  status: AdapterHealthState;
  checkedAt: string;
  failure?: AdapterFailure;
  retryPolicy?: RetryPolicy;
  rateLimitPolicy?: RateLimitPolicy;
}): AdapterHealthStatus {
  return {
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    adapterId: requireNonEmptyString(input.adapterId, "adapterHealth.adapterId"),
    connectionId: requireNonEmptyString(input.connectionId, "adapterHealth.connectionId"),
    status: requireSupported(input.status, "adapterHealth.status", supportedAdapterHealthStates),
    checkedAt: requireValidTimestamp(input.checkedAt, "adapterHealth.checkedAt"),
    ...(input.failure !== undefined ? { failure: createAdapterFailure(input.failure) } : {}),
    ...(input.retryPolicy !== undefined ? { retryPolicy: createRetryPolicy(input.retryPolicy) } : {}),
    ...(input.rateLimitPolicy !== undefined ? { rateLimitPolicy: createRateLimitPolicy(input.rateLimitPolicy) } : {})
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

export function createMockAdapterImportPreview(input: {
  id: string;
  tenantId: TenantId;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  payloadFingerprint: string;
  receivedAt: string;
  previewedAt: string;
  payload: MockAdapterCanonicalImportPayload;
  existingMappings?: ExternalMapping[];
}): MockAdapterCanonicalImportPreview {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const sourceSystem = requireNonEmptyString(input.sourceSystem, "importPreview.sourceSystem");
  const payloadFingerprint = requireNonEmptyString(input.payloadFingerprint, "importPreview.payloadFingerprint");
  const payload = structuredClone(input.payload);
  const issues: ImportValidationIssue[] = [];
  const opportunity = payload.opportunity;
  const project = payload.project;
  const tasks = payload.tasks ?? [];

  if (!opportunity || typeof opportunity !== "object") {
    issues.push(
      createValidationIssue({
        code: "external_id_missing",
        severity: "blocking",
        fieldPath: "opportunity",
        message: "Opportunity payload is required",
        recoveryText: "Проверьте payload mock adapter: блок opportunity обязателен."
      })
    );
  } else {
    if (!opportunity.externalId?.trim()) {
      issues.push(
        createValidationIssue({
          code: "external_id_missing",
          severity: "blocking",
          fieldPath: "opportunity.externalId",
          message: "Opportunity external id is required",
          recoveryText: "Добавьте стабильный externalId для opportunity перед preview."
        })
      );
    }
    if (!opportunity.title?.trim()) {
      issues.push(
        createValidationIssue({
          code: "canonical_title_missing",
          severity: "blocking",
          fieldPath: "opportunity.title",
          message: "Opportunity title is required for canonical import",
          recoveryText: "Заполните название opportunity в adapter payload.",
          externalEntityType: "opportunity",
          externalEntityId: opportunity.externalId
        })
      );
    }
    if (opportunity.account !== undefined && !opportunity.account.externalId?.trim()) {
      issues.push(
        createValidationIssue({
          code: "external_id_missing",
          severity: "blocking",
          fieldPath: "opportunity.account.externalId",
          message: "Account external id is required",
          recoveryText: "Добавьте stable externalId для account перед preview.",
          externalEntityType: "account"
        })
      );
    }
    for (const contact of opportunity.contacts ?? []) {
      if (!contact.externalId?.trim()) {
        issues.push(
          createValidationIssue({
            code: "external_id_missing",
            severity: "blocking",
            fieldPath: "opportunity.contacts[].externalId",
            message: "Contact external id is required",
            recoveryText: "Добавьте stable externalId для каждого contact перед preview.",
            externalEntityType: "contact"
          })
        );
      }
    }
    const plannedStartDate = tryRequireIsoDate(opportunity.plannedStartDate);
    const desiredFinishDate = tryRequireIsoDate(opportunity.desiredFinishDate);
    if (plannedStartDate === undefined) {
      issues.push(
        createValidationIssue({
          code: "date_window_invalid",
          severity: "blocking",
          fieldPath: "opportunity.plannedStartDate",
          message: "Opportunity planned start date is not a valid ISO date",
          recoveryText: "Исправьте дату начала в формате YYYY-MM-DD.",
          externalEntityType: "opportunity",
          externalEntityId: opportunity.externalId
        })
      );
    }
    if (desiredFinishDate === undefined) {
      issues.push(
        createValidationIssue({
          code: "date_window_invalid",
          severity: "blocking",
          fieldPath: "opportunity.desiredFinishDate",
          message: "Opportunity desired finish date is not a valid ISO date",
          recoveryText: "Исправьте дату завершения в формате YYYY-MM-DD.",
          externalEntityType: "opportunity",
          externalEntityId: opportunity.externalId
        })
      );
    }
    if (plannedStartDate !== undefined && desiredFinishDate !== undefined && desiredFinishDate < plannedStartDate) {
      issues.push(
        createValidationIssue({
          code: "date_window_invalid",
          severity: "blocking",
          fieldPath: "opportunity.desiredFinishDate",
          message: "Opportunity desired finish date is before planned start date",
          recoveryText: "Исправьте окно дат во внешней системе или выберите другой payload fixture.",
          externalEntityType: "opportunity",
          externalEntityId: opportunity.externalId
        })
      );
    }
  }

  if (!project.externalId?.trim()) {
    issues.push(
      createValidationIssue({
        code: "external_id_missing",
        severity: "blocking",
        fieldPath: "project.externalId",
        message: "Project external id is required",
        recoveryText: "Добавьте стабильный externalId для project перед preview."
      })
    );
  }
  if (!project.title?.trim()) {
    issues.push(
      createValidationIssue({
        code: "canonical_title_missing",
        severity: "blocking",
        fieldPath: "project.title",
        message: "Project title is required for canonical import",
        recoveryText: "Заполните название project в adapter payload.",
        externalEntityType: "project",
        externalEntityId: project.externalId
      })
    );
  }
  for (const task of tasks) {
    if (!task.externalId?.trim()) {
      issues.push(
        createValidationIssue({
          code: "external_id_missing",
          severity: "blocking",
          fieldPath: "tasks[].externalId",
          message: "Task external id is required",
          recoveryText: "Добавьте stable externalId для каждой task перед preview."
        })
      );
    }
    if (!task.title?.trim()) {
      issues.push(
        createValidationIssue({
          code: "canonical_title_missing",
          severity: "blocking",
          fieldPath: `tasks.${task.externalId}.title`,
          message: "Task title is required for canonical import",
          recoveryText: "Заполните название task в adapter payload.",
          externalEntityType: "task",
          externalEntityId: task.externalId
        })
      );
    }
    const dueDate = tryRequireIsoDate(task.dueDate);
    if (dueDate === undefined) {
      issues.push(
        createValidationIssue({
          code: "date_window_invalid",
          severity: "blocking",
          fieldPath: `tasks.${task.externalId}.dueDate`,
          message: "Task due date is not a valid ISO date",
          recoveryText: "Исправьте срок задачи в формате YYYY-MM-DD.",
          externalEntityType: "task",
          externalEntityId: task.externalId
        })
      );
    }
    if (
      dueDate !== undefined &&
      tryRequireIsoDate(opportunity.plannedStartDate) !== undefined &&
      tryRequireIsoDate(opportunity.desiredFinishDate) !== undefined &&
      (dueDate < opportunity.plannedStartDate || dueDate > opportunity.desiredFinishDate)
    ) {
      issues.push(
        createValidationIssue({
          code: "task_due_date_outside_project_window",
          severity: "warning",
          fieldPath: `tasks.${task.externalId}.dueDate`,
          message: "Task due date is outside the imported project window",
          recoveryText: "Проверьте даты задачи после preview перед применением импорта.",
          externalEntityType: "task",
          externalEntityId: task.externalId
        })
      );
    }
  }

  const hasBlockingIssues = issues.some((issue) => issue.severity === "blocking");
  if (hasBlockingIssues) {
    return {
      id: requireNonEmptyString(input.id, "importPreview.id"),
      tenantId,
      adapterId: requireNonEmptyString(input.adapterId, "importPreview.adapterId"),
      connectionId: requireNonEmptyString(input.connectionId, "importPreview.connectionId"),
      sourceSystem,
      payloadFingerprint,
      receivedAt: requireValidTimestamp(input.receivedAt, "importPreview.receivedAt"),
      previewedAt: requireValidTimestamp(input.previewedAt, "importPreview.previewedAt"),
      mutatesState: false,
      report: {
        creates: 0,
        updates: 0,
        skips: 0,
        errors: issues.filter((issue) => issue.severity === "blocking").length
      },
      validationIssues: issues,
      affectedCanonicalEntities: [],
      mappingPreview: [],
      canonical: {
        contacts: [],
        tasks: []
      }
    };
  }

  const accountId =
    opportunity.account !== undefined
      ? deterministicCanonicalId({
          tenantId,
          sourceSystem,
          entityType: "account",
          externalId: opportunity.account.externalId
        })
      : undefined;
  const contactPreviews = (opportunity.contacts ?? []).map((contact) => ({
    id: deterministicCanonicalId({ tenantId, sourceSystem, entityType: "contact", externalId: contact.externalId }),
    tenantId,
    ...(accountId !== undefined ? { accountId } : {}),
    displayName: requireNonEmptyString(contact.displayName, "contact.displayName"),
    ...(contact.email !== undefined ? { email: requireNonEmptyString(contact.email, "contact.email") } : {}),
    ...(contact.phone !== undefined ? { phone: requireNonEmptyString(contact.phone, "contact.phone") } : {}),
    ...(contact.roleLabel !== undefined ? { roleLabel: requireNonEmptyString(contact.roleLabel, "contact.roleLabel") } : {})
  }));
  const opportunityId = deterministicCanonicalId({
    tenantId,
    sourceSystem,
    entityType: "opportunity",
    externalId: opportunity.externalId
  });
  const projectId = deterministicCanonicalId({ tenantId, sourceSystem, entityType: "project", externalId: project.externalId });
  const taskPreviews = tasks.map((task) => ({
    id: deterministicCanonicalId({ tenantId, sourceSystem, entityType: "task", externalId: task.externalId }),
    tenantId,
    title: requireNonEmptyString(task.title, "task.title"),
    stageKey: requireNonEmptyString(task.stageKey, "task.stageKey"),
    plannedWorkHours: task.plannedWorkHours,
    dueDate: requireIsoDate(task.dueDate, "task.dueDate"),
    participantRoleKeys: [...task.participantRoleKeys]
  }));
  const mappingPreview: ImportPreviewMapping[] = [];

  if (opportunity.account !== undefined && accountId !== undefined) {
    mappingPreview.push(
      createPreviewMapping({
        tenantId,
        sourceSystem,
        externalEntityType: "account",
        externalEntityId: opportunity.account.externalId,
        canonicalEntityType: "account",
        canonicalEntityId: accountId,
        payloadFingerprint,
        existingMappings: input.existingMappings
      })
    );
  }
  for (const contact of opportunity.contacts ?? []) {
    mappingPreview.push(
      createPreviewMapping({
        tenantId,
        sourceSystem,
        externalEntityType: "contact",
        externalEntityId: contact.externalId,
        canonicalEntityType: "contact",
        canonicalEntityId: deterministicCanonicalId({
          tenantId,
          sourceSystem,
          entityType: "contact",
          externalId: contact.externalId
        }),
        payloadFingerprint,
        existingMappings: input.existingMappings
      })
    );
  }
  mappingPreview.push(
    createPreviewMapping({
      tenantId,
      sourceSystem,
      externalEntityType: "opportunity",
      externalEntityId: opportunity.externalId,
      canonicalEntityType: "opportunity",
      canonicalEntityId: opportunityId,
      payloadFingerprint,
      existingMappings: input.existingMappings
    }),
    createPreviewMapping({
      tenantId,
      sourceSystem,
      externalEntityType: "project",
      externalEntityId: project.externalId,
      canonicalEntityType: "project",
      canonicalEntityId: projectId,
      payloadFingerprint,
      existingMappings: input.existingMappings
    })
  );
  for (const task of tasks) {
    mappingPreview.push(
      createPreviewMapping({
        tenantId,
        sourceSystem,
        externalEntityType: "task",
        externalEntityId: task.externalId,
        canonicalEntityType: "task",
        canonicalEntityId: deterministicCanonicalId({
          tenantId,
          sourceSystem,
          entityType: "task",
          externalId: task.externalId
        }),
        payloadFingerprint,
        existingMappings: input.existingMappings
      })
    );
  }

  const actionCounts = mappingPreview.reduce(
    (counts, mapping) => ({
      creates: counts.creates + (mapping.action === "create" ? 1 : 0),
      updates: counts.updates + (mapping.action === "update" ? 1 : 0),
      skips: counts.skips + (mapping.action === "skip" ? 1 : 0)
    }),
    { creates: 0, updates: 0, skips: 0 }
  );

  const canonical = {
    ...(opportunity.account !== undefined && accountId !== undefined
      ? {
          account: {
            id: accountId,
            tenantId,
            displayName: requireNonEmptyString(opportunity.account.displayName, "account.displayName"),
            ...(opportunity.account.legalName !== undefined
              ? { legalName: requireNonEmptyString(opportunity.account.legalName, "account.legalName") }
              : {}),
            ...(opportunity.account.taxId !== undefined
              ? { taxId: requireNonEmptyString(opportunity.account.taxId, "account.taxId") }
              : {})
          }
        }
      : {}),
    contacts: contactPreviews,
    opportunity: {
      id: opportunityId,
      tenantId,
      title: requireNonEmptyString(opportunity.title, "opportunity.title"),
      plannedStartDate: requireIsoDate(opportunity.plannedStartDate, "opportunity.plannedStartDate"),
      desiredFinishDate: requireIsoDate(opportunity.desiredFinishDate, "opportunity.desiredFinishDate"),
      expectedValue: {
        amount: opportunity.expectedValue.amount,
        currency: requireNonEmptyString(opportunity.expectedValue.currency, "opportunity.expectedValue.currency")
      },
      probability: opportunity.probability,
      categoryKey: requireNonEmptyString(opportunity.categoryKey, "opportunity.categoryKey"),
      typologyKey: requireNonEmptyString(opportunity.typologyKey, "opportunity.typologyKey"),
      scopeHints: structuredClone(opportunity.scopeHints ?? [])
    },
    projectDraft: {
      id: `imported-draft-${stableIdSegment([tenantId, sourceSystem, "project_draft", project.externalId])}`,
      tenantId,
      title: requireNonEmptyString(project.title, "project.title"),
      sourceOpportunity: {
        tenantId,
        type: "crm_opportunity" as const,
        opportunityId,
        title: requireNonEmptyString(opportunity.title, "opportunity.title"),
        ...(accountId !== undefined ? { accountId } : {}),
        contactIds: contactPreviews.map((contact) => contact.id),
        plannedStartDate: requireIsoDate(opportunity.plannedStartDate, "opportunity.plannedStartDate"),
        desiredFinishDate: requireIsoDate(opportunity.desiredFinishDate, "opportunity.desiredFinishDate")
      },
      processTemplate: {
        tenantId,
        ...structuredClone(project.template)
      },
      demand: {
        tenantId,
        ...structuredClone(project.demand)
      },
      feasibility: {
        tenantId,
        ...structuredClone(project.feasibility),
        expectedWindow: {
          startDate: requireIsoDate(opportunity.plannedStartDate, "opportunity.plannedStartDate"),
          endDate: requireIsoDate(opportunity.desiredFinishDate, "opportunity.desiredFinishDate")
        }
      }
    },
    tasks: taskPreviews
  };

  return {
    id: requireNonEmptyString(input.id, "importPreview.id"),
    tenantId,
    adapterId: requireNonEmptyString(input.adapterId, "importPreview.adapterId"),
    connectionId: requireNonEmptyString(input.connectionId, "importPreview.connectionId"),
    sourceSystem,
    payloadFingerprint,
    receivedAt: requireValidTimestamp(input.receivedAt, "importPreview.receivedAt"),
    previewedAt: requireValidTimestamp(input.previewedAt, "importPreview.previewedAt"),
    mutatesState: false,
    report: {
      ...actionCounts,
      errors: issues.filter((issue) => issue.severity === "blocking").length
    },
    validationIssues: issues,
    affectedCanonicalEntities: [
      ...(canonical.account !== undefined
        ? [{ entityType: "account" as const, entityId: canonical.account.id, displayName: canonical.account.displayName }]
        : []),
      ...canonical.contacts.map((contact) => ({
        entityType: "contact" as const,
        entityId: contact.id,
        displayName: contact.displayName
      })),
      { entityType: "opportunity" as const, entityId: opportunityId, displayName: opportunity.title },
      { entityType: "project" as const, entityId: projectId, displayName: project.title },
      ...canonical.tasks.map((task) => ({ entityType: "task" as const, entityId: task.id, displayName: task.title }))
    ],
    mappingPreview,
    canonical
  };
}

export function applyMockAdapterImportPreview(input: {
  preview: MockAdapterCanonicalImportPreview;
  actorId: TenantUserId;
  batchId: string;
  idempotencyKey: string;
  appliedAt: string;
  auditEventId: string;
  confirmed: boolean;
  expectedTenantId?: TenantId;
  existingBatches?: ImportBatch[];
  existingMappings?: ExternalMapping[];
  existingAuditEvents?: SyncAuditEvent[];
}): ImportApplyResult {
  const tenantId = requireNonEmptyString(input.preview.tenantId, "importApply.preview.tenantId");
  if (input.expectedTenantId !== undefined && input.expectedTenantId !== tenantId) {
    throw new IntegrationDomainError("tenant_mismatch", "import preview tenant mismatch");
  }
  if (!input.confirmed) {
    throw new IntegrationDomainError("import_preview_required", "import apply requires confirmation");
  }
  const blockingIssues = input.preview.validationIssues.filter((issue) => issue.severity === "blocking");
  if (blockingIssues.length > 0) {
    throw new IntegrationDomainError("validation_error", "import preview has blocking validation issues");
  }

  const idempotencyKey = requireNonEmptyString(input.idempotencyKey, "importApply.idempotencyKey");
  const batchId = requireNonEmptyString(input.batchId, "importApply.batchId");
  const auditEventId = requireNonEmptyString(input.auditEventId, "importApply.auditEventId");
  const existingBatch = (input.existingBatches ?? []).find(
    (batch) => batch.tenantId === tenantId && batch.idempotencyKey === idempotencyKey
  );
  if (existingBatch !== undefined) {
    const replayMappings = (input.existingMappings ?? []).filter((mapping) =>
      existingBatch.mappingKeys.includes(mapping.mappingKey)
    );
    const replayAudit = (input.existingAuditEvents ?? []).find(
      (event) => event.tenantId === tenantId && event.command === "import_apply" && event.target.entityId === existingBatch.id
    );
    if (replayMappings.length !== existingBatch.mappingKeys.length || replayAudit === undefined) {
      throw new IntegrationDomainError("idempotency_conflict", "idempotent import replay is missing prior mapping or audit evidence");
    }

    return {
      tenantId,
      status: "idempotent_replay",
      idempotentReplay: true,
      batch: structuredClone(existingBatch),
      mappings: structuredClone(replayMappings),
      canonicalEntityRefs: structuredClone(existingBatch.canonicalEntityRefs),
      audit: structuredClone(replayAudit)
    };
  }

  const batchIdConflict = (input.existingBatches ?? []).find(
    (batch) => batch.tenantId === tenantId && batch.id === batchId
  );
  if (batchIdConflict !== undefined) {
    throw new IntegrationDomainError("idempotency_conflict", "import batch id already exists with another idempotency key");
  }

  const auditIdConflict = (input.existingAuditEvents ?? []).find(
    (event) => event.tenantId === tenantId && event.id === auditEventId
  );
  if (auditIdConflict !== undefined) {
    throw new IntegrationDomainError("idempotency_conflict", "import audit id already exists with another target");
  }

  const appliedAt = requireValidTimestamp(input.appliedAt, "importApply.appliedAt");
  const actorId = requireNonEmptyString(input.actorId, "importApply.actorId");
  const mappings = input.preview.mappingPreview.map((mappingPreview) =>
    createExternalMapping({
      id: mappingPreview.existingMappingId ?? deterministicMappingId(mappingPreview.mappingKey),
      tenantId,
      sourceSystem: input.preview.sourceSystem,
      connectionId: input.preview.connectionId,
      externalEntityType: mappingPreview.externalEntityType,
      externalEntityId: mappingPreview.externalEntityId,
      canonicalEntityType: mappingPreview.canonicalEntityType,
      canonicalEntityId: mappingPreview.canonicalEntityId,
      lastBatchId: batchId,
      lastSyncStatus: "synced",
      lastSyncedAt: appliedAt,
      safeMetadata: {
        previewId: input.preview.id,
        payloadFingerprint: input.preview.payloadFingerprint,
        idempotencyKey,
        action: mappingPreview.action
      }
    })
  );
  const batch: ImportBatch = {
    id: batchId,
    tenantId,
    adapterId: input.preview.adapterId,
    connectionId: input.preview.connectionId,
    sourceSystem: input.preview.sourceSystem,
    previewId: input.preview.id,
    idempotencyKey,
    payloadFingerprint: input.preview.payloadFingerprint,
    mappingKeys: mappings.map((mapping) => mapping.mappingKey),
    canonicalEntityRefs: structuredClone(input.preview.affectedCanonicalEntities),
    resultStatus: "applied",
    appliedAt,
    actorId
  };
  const audit = createSyncAuditEvent({
    id: auditEventId,
    tenantId,
    actorId,
    adapterId: input.preview.adapterId,
    connectionId: input.preview.connectionId,
    command: "import_apply",
    result: "success",
    target: {
      entityType: "import_batch",
      entityId: batchId
    },
    timestamp: appliedAt,
    correlationId: `corr-${batchId}`,
    details: {
      previewId: input.preview.id,
      idempotencyKey,
      mappingCount: mappings.length,
      canonicalEntityCount: input.preview.affectedCanonicalEntities.length
    }
  });

  return {
    tenantId,
    status: "applied",
    idempotentReplay: false,
    batch,
    mappings,
    canonicalEntityRefs: structuredClone(input.preview.affectedCanonicalEntities),
    audit
  };
}

function sampleLimitOrDefault(value: number | undefined): number {
  return value === undefined ? 5 : requirePositiveInteger(value, "sampleLimit");
}

function splitValidationIssues(preview: MockAdapterCanonicalImportPreview): {
  blockers: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
} {
  return {
    blockers: preview.validationIssues.filter((issue) => issue.severity === "blocking").map((issue) => ({ ...issue })),
    warnings: preview.validationIssues.filter((issue) => issue.severity === "warning").map((issue) => ({ ...issue }))
  };
}

function createRecoveryActions(issues: ImportValidationIssue[]): MigrationValidationReport["recoveryActions"] {
  return issues.map((issue) => ({
    code: issue.code,
    label: issue.recoveryText,
    fieldPath: issue.fieldPath,
    ...(issue.externalEntityType !== undefined ? { externalEntityType: issue.externalEntityType } : {}),
    ...(issue.externalEntityId !== undefined ? { externalEntityId: issue.externalEntityId } : {})
  }));
}

export function createMigrationValidationReport(input: {
  preview: MockAdapterCanonicalImportPreview;
  generatedAt: string;
  sampleLimit?: number;
}): MigrationValidationReport {
  const generatedAt = requireValidTimestamp(input.generatedAt, "migrationValidationReport.generatedAt");
  const sampleLimit = sampleLimitOrDefault(input.sampleLimit);
  const { blockers, warnings } = splitValidationIssues(input.preview);

  return {
    id: `validation-report-${requireNonEmptyString(input.preview.id, "migrationValidationReport.preview.id")}`,
    tenantId: requireNonEmptyString(input.preview.tenantId, "migrationValidationReport.preview.tenantId"),
    previewId: input.preview.id,
    adapterId: requireNonEmptyString(input.preview.adapterId, "migrationValidationReport.preview.adapterId"),
    connectionId: requireNonEmptyString(input.preview.connectionId, "migrationValidationReport.preview.connectionId"),
    sourceSystem: requireNonEmptyString(input.preview.sourceSystem, "migrationValidationReport.preview.sourceSystem"),
    generatedAt,
    mutatesState: false,
    safeToApply: blockers.length === 0,
    summary: {
      creates: input.preview.report.creates,
      updates: input.preview.report.updates,
      skips: input.preview.report.skips,
      errors: input.preview.report.errors,
      totalAffected: input.preview.mappingPreview.length,
      blockingIssues: blockers.length,
      warningIssues: warnings.length
    },
    blockers,
    warnings,
    sampleMappings: input.preview.mappingPreview.slice(0, sampleLimit).map((mapping) => ({ ...mapping })),
    affectedCanonicalEntities: input.preview.affectedCanonicalEntities.map((entity) => ({ ...entity })),
    recoveryActions: createRecoveryActions([...blockers, ...warnings])
  };
}

export function createImportDryRunSummary(input: {
  preview: MockAdapterCanonicalImportPreview;
  generatedAt: string;
  sampleLimit?: number;
}): ImportDryRunSummary {
  const report = createMigrationValidationReport(input);

  return {
    id: `dry-run-summary-${report.previewId}`,
    tenantId: report.tenantId,
    previewId: report.previewId,
    adapterId: report.adapterId,
    connectionId: report.connectionId,
    sourceSystem: report.sourceSystem,
    generatedAt: report.generatedAt,
    mutatesState: false,
    canApply: report.safeToApply,
    expectedCreates: report.summary.creates,
    expectedUpdates: report.summary.updates,
    expectedSkips: report.summary.skips,
    expectedErrors: report.summary.errors,
    expectedTotalAffected: report.summary.totalAffected,
    blockers: report.blockers.map((issue) => ({ ...issue })),
    warnings: report.warnings.map((issue) => ({ ...issue })),
    mappingSample: report.sampleMappings.map((mapping) => ({ ...mapping })),
    canonicalEntitySample: report.affectedCanonicalEntities.slice(0, sampleLimitOrDefault(input.sampleLimit)).map((entity) => ({
      ...entity
    })),
    recoveryText: report.recoveryActions.map((action) => action.label)
  };
}
