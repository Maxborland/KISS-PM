import {
  applyMockAdapterImportPreview,
  createMockAdapterImportPreview,
  type ExternalMapping,
  type ImportApplyResult,
  type ImportBatch,
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

export function createPhase11RuntimeState() {
  const state: Phase11RuntimeState = {
    tenantVersions: new Map(),
    previews: new Map(),
    batches: new Map(),
    mappings: new Map(),
    auditEvents: new Map()
  };

  function currentTenantVersion(tenantId: string): number {
    return state.tenantVersions.get(tenantId) ?? 0;
  }

  function advanceTenantVersion(tenantId: string): number {
    const nextVersion = currentTenantVersion(tenantId) + 1;
    state.tenantVersions.set(tenantId, nextVersion);
    return nextVersion;
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
    const preview = createMockAdapterImportPreview({
      ...input,
      existingMappings: listMappings(input.tenantId)
    });
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
        throw new IntegrationDomainError("tenant_mismatch", "import preview tenant mismatch");
      }
      throw new IntegrationDomainError("stale_preview", "import preview is missing");
    }
    if (storedPreview.stateVersion !== currentTenantVersion(input.tenantId)) {
      throw new IntegrationDomainError("stale_preview", "import preview is stale");
    }

    const result = applyMockAdapterImportPreview({
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

    if (!result.idempotentReplay) {
      state.batches.set(batchStorageKey(result.batch.tenantId, result.batch.id), clone(result.batch));
      for (const mapping of result.mappings) {
        state.mappings.set(mapping.mappingKey, clone(mapping));
      }
      state.auditEvents.set(auditStorageKey(result.audit.tenantId, result.audit.id), clone(result.audit));
    }

    return clone(result);
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
  }

  return {
    previewMockImport,
    applyImport,
    listImportBatches,
    listMappings,
    listSyncAudit,
    reset
  };
}
