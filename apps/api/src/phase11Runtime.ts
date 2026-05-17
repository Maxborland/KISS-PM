import {
  applyMockAdapterImportPreview,
  createAdapterFailure,
  createImportDryRunSummary,
  createMigrationValidationReport,
  createMockAdapterImportPreview,
  createSyncAuditEvent,
  type AdapterFailure,
  type AdapterFailureCode,
  type ExternalMapping,
  type ImportDryRunSummary,
  type ImportApplyResult,
  type ImportBatch,
  type MigrationValidationReport,
  type MockAdapterCanonicalImportPayload,
  type MockAdapterCanonicalImportPreview,
  type SyncAuditEvent,
  IntegrationDomainError
} from "@kiss-pm/integrations";

type StoredPreview = {
  stateVersion: number;
  preview: MockAdapterCanonicalImportPreview;
};

type Phase11RuntimeState = {
  tenantVersions: Map<string, number>;
  previews: Map<string, StoredPreview>;
  batches: Map<string, ImportBatch>;
  mappings: Map<string, ExternalMapping>;
  auditEvents: Map<string, SyncAuditEvent>;
  failureModes: Map<string, ConnectionFailureMode>;
};

type ConnectionFailureMode = {
  tenantId: string;
  adapterId: string;
  connectionId: string;
  failure: AdapterFailure;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function previewStorageKey(tenantId: string, previewId: string): string {
  return `${tenantId}:${previewId}`;
}

function batchStorageKey(tenantId: string, batchId: string): string {
  return `${tenantId}:${batchId}`;
}

function auditStorageKey(tenantId: string, auditEventId: string): string {
  return `${tenantId}:${auditEventId}`;
}

function connectionFailureKey(tenantId: string, connectionId: string): string {
  return `${tenantId}:${connectionId}`;
}

function failureCodeFromIntegrationError(code: IntegrationDomainError["code"]): AdapterFailureCode {
  if (code === "validation_error") return "partial_import_rejected";
  if (code === "conflict") return "mapping_conflict";
  return code;
}

export function createPhase11RuntimeState() {
  const state: Phase11RuntimeState = {
    tenantVersions: new Map(),
    previews: new Map(),
    batches: new Map(),
    mappings: new Map(),
    auditEvents: new Map(),
    failureModes: new Map()
  };

  function currentTenantVersion(tenantId: string): number {
    return state.tenantVersions.get(tenantId) ?? 0;
  }

  function advanceTenantVersion(tenantId: string): number {
    const nextVersion = currentTenantVersion(tenantId) + 1;
    state.tenantVersions.set(tenantId, nextVersion);
    return nextVersion;
  }

  function recordSyncAudit(event: SyncAuditEvent): void {
    state.auditEvents.set(auditStorageKey(event.tenantId, event.id), clone(event));
  }

  function setConnectionFailureMode(input: ConnectionFailureMode): void {
    const failure = createAdapterFailure(input.failure);
    state.failureModes.set(connectionFailureKey(input.tenantId, input.connectionId), {
      tenantId: input.tenantId,
      adapterId: input.adapterId,
      connectionId: input.connectionId,
      failure
    });
  }

  function clearConnectionFailureMode(input: { tenantId: string; connectionId: string }): void {
    state.failureModes.delete(connectionFailureKey(input.tenantId, input.connectionId));
  }

  function getConnectionFailureMode(input: { tenantId: string; connectionId: string }): AdapterFailure | undefined {
    const failureMode = state.failureModes.get(connectionFailureKey(input.tenantId, input.connectionId));
    return failureMode === undefined ? undefined : clone(failureMode.failure);
  }

  function previewMockImport(input: {
    id: string;
    tenantId: string;
    adapterId: string;
    connectionId: string;
    sourceSystem: string;
    payloadFingerprint: string;
    receivedAt: string;
    previewedAt: string;
    payload: MockAdapterCanonicalImportPayload;
  }): MockAdapterCanonicalImportPreview {
    const failureMode = state.failureModes.get(connectionFailureKey(input.tenantId, input.connectionId));
    if (failureMode !== undefined) {
      recordSyncAudit(
        createSyncAuditEvent({
          id: `audit-${input.id}-failure`,
          tenantId: input.tenantId,
          actorId: "integration-runtime",
          adapterId: failureMode.adapterId,
          connectionId: failureMode.connectionId,
          command: "import_preview",
          result: "failed",
          target: {
            entityType: "import_preview",
            entityId: input.id
          },
          timestamp: input.previewedAt,
          correlationId: `corr-${input.id}`,
          failure: failureMode.failure,
          details: {
            previewId: input.id,
            payloadFingerprint: input.payloadFingerprint,
            ...(failureMode.failure.retryAfterSeconds !== undefined
              ? { retryAfterSeconds: failureMode.failure.retryAfterSeconds }
              : {})
          }
        })
      );
      throw new IntegrationDomainError(failureMode.failure.code, failureMode.failure.message);
    }

    const preview = createMockAdapterImportPreview({
      ...input,
      existingMappings: listMappings(input.tenantId)
    });
    const blockingIssues = preview.validationIssues.filter((issue) => issue.severity === "blocking");
    if (blockingIssues.length > 0) {
      recordSyncAudit(
        createSyncAuditEvent({
          id: `audit-${preview.id}-validation`,
          tenantId: preview.tenantId,
          actorId: "integration-runtime",
          adapterId: preview.adapterId,
          connectionId: preview.connectionId,
          command: "import_preview",
          result: "failed",
          target: {
            entityType: "import_preview",
            entityId: preview.id
          },
          timestamp: preview.previewedAt,
          correlationId: `corr-${preview.id}`,
          failure: createAdapterFailure({
            code: "invalid_payload",
            message: "Import preview has blocking validation issues",
            retryable: false,
            occurredAt: preview.previewedAt
          }),
          details: {
            previewId: preview.id,
            validationIssueCount: blockingIssues.length
          }
        })
      );
    }
    const stateVersion = advanceTenantVersion(preview.tenantId);
    state.previews.set(previewStorageKey(preview.tenantId, preview.id), {
      stateVersion,
      preview: clone(preview)
    });

    return clone(preview);
  }

  function applyImport(input: {
    tenantId: string;
    actorId: string;
    previewId: string;
    batchId: string;
    idempotencyKey: string;
    auditEventId: string;
    appliedAt: string;
    confirmed: boolean;
  }): ImportApplyResult {
    const storedPreview = state.previews.get(previewStorageKey(input.tenantId, input.previewId));
    if (storedPreview === undefined) {
      const crossTenantPreview = Array.from(state.previews.values()).find((entry) => entry.preview.id === input.previewId);
      if (crossTenantPreview !== undefined) {
        recordFailedApply(input, {
          code: "tenant_mismatch",
          message: "import preview tenant mismatch",
          retryable: false,
          occurredAt: input.appliedAt
        });
        throw new IntegrationDomainError("tenant_mismatch", "import preview tenant mismatch");
      }
      recordFailedApply(input, {
        code: "stale_preview",
        message: "import preview is missing",
        retryable: true,
        occurredAt: input.appliedAt
      });
      throw new IntegrationDomainError("stale_preview", "import preview is missing");
    }
    if (storedPreview.stateVersion !== currentTenantVersion(input.tenantId)) {
      recordFailedApply(input, {
        code: "stale_preview",
        message: "import preview is stale",
        retryable: true,
        occurredAt: input.appliedAt
      }, storedPreview.preview);
      throw new IntegrationDomainError("stale_preview", "import preview is stale");
    }

    let result: ImportApplyResult;
    try {
      result = applyMockAdapterImportPreview({
        preview: storedPreview.preview,
        actorId: input.actorId,
        batchId: input.batchId,
        idempotencyKey: input.idempotencyKey,
        appliedAt: input.appliedAt,
        auditEventId: input.auditEventId,
        confirmed: input.confirmed,
        expectedTenantId: input.tenantId,
        existingBatches: listImportBatches(input.tenantId),
        existingMappings: listMappings(input.tenantId),
        existingAuditEvents: listSyncAudit(input.tenantId)
      });
    } catch (error) {
      if (error instanceof IntegrationDomainError) {
        recordFailedApply(input, {
          code: failureCodeFromIntegrationError(error.code),
          message: error.message,
          retryable: error.code === "stale_preview" || error.code === "adapter_rate_limited",
          occurredAt: input.appliedAt
        }, storedPreview.preview);
      }
      throw error;
    }

    if (!result.idempotentReplay) {
      state.batches.set(batchStorageKey(result.batch.tenantId, result.batch.id), clone(result.batch));
      for (const mapping of result.mappings) {
        state.mappings.set(mapping.mappingKey, clone(mapping));
      }
      recordSyncAudit(result.audit);
    }

    return clone(result);
  }

  function getStoredPreviewForRead(input: { tenantId: string; previewId: string }): MockAdapterCanonicalImportPreview {
    const storedPreview = state.previews.get(previewStorageKey(input.tenantId, input.previewId));
    if (storedPreview !== undefined) {
      if (storedPreview.stateVersion !== currentTenantVersion(input.tenantId)) {
        throw new IntegrationDomainError("stale_preview", "import preview is stale");
      }
      return clone(storedPreview.preview);
    }
    const crossTenantPreview = Array.from(state.previews.values()).find((entry) => entry.preview.id === input.previewId);
    if (crossTenantPreview !== undefined) {
      throw new IntegrationDomainError("tenant_mismatch", "import preview tenant mismatch");
    }
    throw new IntegrationDomainError("stale_preview", "import preview is missing");
  }

  function getMigrationValidationReport(input: {
    tenantId: string;
    previewId: string;
    generatedAt: string;
    sampleLimit?: number;
  }): MigrationValidationReport {
    return createMigrationValidationReport({
      preview: getStoredPreviewForRead(input),
      generatedAt: input.generatedAt,
      ...(input.sampleLimit !== undefined ? { sampleLimit: input.sampleLimit } : {})
    });
  }

  function getImportDryRunSummary(input: {
    tenantId: string;
    previewId: string;
    generatedAt: string;
    sampleLimit?: number;
  }): ImportDryRunSummary {
    return createImportDryRunSummary({
      preview: getStoredPreviewForRead(input),
      generatedAt: input.generatedAt,
      ...(input.sampleLimit !== undefined ? { sampleLimit: input.sampleLimit } : {})
    });
  }

  function recordFailedApply(
    input: {
      tenantId: string;
      actorId: string;
      previewId: string;
      batchId: string;
      idempotencyKey: string;
      auditEventId: string;
      appliedAt: string;
    },
    failureInput: Parameters<typeof createAdapterFailure>[0],
    preview?: MockAdapterCanonicalImportPreview
  ): void {
    const failure = createAdapterFailure(failureInput);
    let auditEventId = input.auditEventId;
    if (state.auditEvents.has(auditStorageKey(input.tenantId, auditEventId))) {
      auditEventId = `audit-${input.batchId}-failure`;
    }
    recordSyncAudit(
      createSyncAuditEvent({
        id: auditEventId,
        tenantId: input.tenantId,
        actorId: input.actorId,
        adapterId: preview?.adapterId ?? "unknown-adapter",
        connectionId: preview?.connectionId ?? "unknown-connection",
        command: "import_apply",
        result: "failed",
        target: {
          entityType: "import_batch",
          entityId: input.batchId
        },
        timestamp: input.appliedAt,
        correlationId: `corr-${input.batchId}`,
        failure,
        details: {
          previewId: input.previewId,
          idempotencyKey: input.idempotencyKey
        }
      })
    );
  }

  function listImportBatches(tenantId: string): ImportBatch[] {
    return Array.from(state.batches.values())
      .filter((batch) => batch.tenantId === tenantId)
      .map(clone);
  }

  function listMappings(tenantId: string): ExternalMapping[] {
    return Array.from(state.mappings.values())
      .filter((mapping) => mapping.tenantId === tenantId)
      .map(clone);
  }

  function listSyncAudit(tenantId: string): SyncAuditEvent[] {
    return Array.from(state.auditEvents.values())
      .filter((event) => event.tenantId === tenantId)
      .map(clone);
  }

  function reset(): void {
    state.tenantVersions.clear();
    state.previews.clear();
    state.batches.clear();
    state.mappings.clear();
    state.auditEvents.clear();
    state.failureModes.clear();
  }

  return {
    setConnectionFailureMode,
    clearConnectionFailureMode,
    getConnectionFailureMode,
    previewMockImport,
    applyImport,
    getImportPreview: getStoredPreviewForRead,
    getMigrationValidationReport,
    getImportDryRunSummary,
    listImportBatches,
    listMappings,
    listSyncAudit,
    reset
  };
}
