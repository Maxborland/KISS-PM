export type IntegrationAdapterDto = {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  sourceSystem: string;
  capabilities: string[];
  active: boolean;
};

export type IntegrationConnectionDto = {
  id: string;
  tenantId: string;
  adapterId: string;
  label: string;
  sourceSystem: string;
  status: string;
  configuredAt: string;
};

export type IntegrationAdapterFailureDto = {
  code: "adapter_rate_limited" | "adapter_unavailable" | "adapter_failure";
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  occurredAt: string;
};

export type IntegrationDiagnosticDto = {
  tenantId: string;
  adapterId: string;
  connectionId: string;
  status: "healthy" | "rate_limited" | "failed";
  failure?: IntegrationAdapterFailureDto;
};

export type IntegrationCanonicalRefDto = {
  entityType: string;
  entityId: string;
};

export type IntegrationImportPreviewDto = {
  id: string;
  tenantId: string;
  adapterId: string;
  connectionId: string;
  sourceSystem: string;
  payloadFingerprint: string;
  receivedAt: string;
  previewedAt: string;
  mutatesState: false;
  report: { creates: number; updates: number; skips: number; errors: number };
  mappingPreview: Array<{ mappingKey: string; action: string }>;
  affectedCanonicalRefs: IntegrationCanonicalRefDto[];
  validationIssues: Array<{ code: string; severity: string; path: string; message: string }>;
};

export type IntegrationValidationReportDto = {
  previewId: string;
  safeToApply: boolean;
  summary: { creates: number; updates: number; skips: number; errors: number; totalAffected: number };
  blockers: Array<{ code: string; severity: string; recoveryText?: string }>;
  sampleMappings: Array<{ mappingKey: string; action: string }>;
  affectedCanonicalRefs: IntegrationCanonicalRefDto[];
  generatedAt: string;
};

export type IntegrationDryRunSummaryDto = {
  previewId: string;
  canApply: boolean;
  mutatesState: false;
  expectedCreates: number;
  expectedUpdates: number;
  expectedSkips: number;
  expectedErrors: number;
  expectedTotalAffected: number;
  recoveryActions: string[];
  generatedAt: string;
};

export type IntegrationImportPreviewResponseDto = {
  preview: IntegrationImportPreviewDto;
  validationReport: IntegrationValidationReportDto;
  dryRunSummary: IntegrationDryRunSummaryDto;
};

export type IntegrationImportBatchDto = {
  id: string;
  tenantId: string;
  adapterId: string;
  connectionId: string;
  previewId: string;
  idempotencyKey: string;
  status: string;
  appliedAt: string;
  mappingKeys: string[];
  canonicalRefs: IntegrationCanonicalRefDto[];
};

export type IntegrationMappingDto = {
  id: string;
  tenantId: string;
  sourceSystem: string;
  externalEntityType: string;
  externalEntityId: string;
  canonicalEntityType: string;
  canonicalEntityId: string;
  mappingKey: string;
  lastBatchId?: string;
  lastSyncStatus: string;
  updatedAt: string;
};

export type IntegrationAuditEventDto = {
  id: string;
  tenantId: string;
  actorId: string;
  adapterId?: string;
  connectionId?: string;
  command: string;
  result: string;
  timestamp: string;
  correlationId: string;
  target?: { entityType: string; entityId: string };
};

export type IntegrationAuditDto = {
  audit: IntegrationAuditEventDto[];
};

export type IntegrationImportApplyResponseDto = {
  result: {
    tenantId: string;
    status: "applied" | "idempotent_replay";
    idempotentReplay: boolean;
    batch: IntegrationImportBatchDto;
    mappings: IntegrationMappingDto[];
    audit: IntegrationAuditEventDto;
  };
  readback: {
    batches: IntegrationImportBatchDto[];
    mappings: IntegrationMappingDto[];
    audit: IntegrationAuditEventDto[];
  };
};

export type IntegrationImportPreviewRequestDto = {
  adapterId: string;
  connectionId: string;
  payloadFixtureKey: "mock-crm-valid" | "mock-crm-invalid";
};

export type IntegrationImportApplyRequestDto = {
  previewId: string;
  batchId: string;
  idempotencyKey: string;
  confirmed: true;
};

export type IntegrationAdminDiagnosticsApiClient = {
  listAdapters(testUser: string): Promise<IntegrationAdapterDto[]>;
  listConnections(testUser: string): Promise<IntegrationConnectionDto[]>;
  listDiagnostics(testUser: string): Promise<IntegrationDiagnosticDto[]>;
  previewImport(testUser: string, request: IntegrationImportPreviewRequestDto): Promise<IntegrationImportPreviewResponseDto>;
  applyImport(testUser: string, request: IntegrationImportApplyRequestDto): Promise<IntegrationImportApplyResponseDto>;
  listBatches(testUser: string): Promise<IntegrationImportBatchDto[]>;
  listMappings(testUser: string): Promise<IntegrationMappingDto[]>;
  getAudit(testUser: string): Promise<IntegrationAuditDto>;
  setFailureMode(testUser: string, connectionId: string): Promise<IntegrationDiagnosticDto[]>;
  clearFailureMode(testUser: string, connectionId: string): Promise<IntegrationDiagnosticDto[]>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message || `HTTP ${response.status}`), {
      code: errorBody.code,
      message: errorBody.message || `HTTP ${response.status}`
    });
  }

  return body as T;
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

function jsonBody(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    body: JSON.stringify(body)
  };
}

export function createIntegrationAdminDiagnosticsApiClient(basePath = "/api/api"): IntegrationAdminDiagnosticsApiClient {
  return {
    async listAdapters(testUser) {
      const body = await requestJson<{ adapters: IntegrationAdapterDto[] }>(withUser(`${basePath}/integrations/adapters`, testUser));
      return body.adapters;
    },
    async listConnections(testUser) {
      const body = await requestJson<{ connections: IntegrationConnectionDto[] }>(
        withUser(`${basePath}/integrations/connections`, testUser)
      );
      return body.connections;
    },
    async listDiagnostics(testUser) {
      const body = await requestJson<{ diagnostics: IntegrationDiagnosticDto[] }>(
        withUser(`${basePath}/integrations/diagnostics`, testUser)
      );
      return body.diagnostics;
    },
    previewImport(testUser, request) {
      return requestJson<IntegrationImportPreviewResponseDto>(
        withUser(`${basePath}/integrations/import/preview`, testUser),
        jsonBody(request)
      );
    },
    applyImport(testUser, request) {
      return requestJson<IntegrationImportApplyResponseDto>(
        withUser(`${basePath}/integrations/import/apply`, testUser),
        jsonBody(request)
      );
    },
    async listBatches(testUser) {
      const body = await requestJson<{ batches: IntegrationImportBatchDto[] }>(
        withUser(`${basePath}/integrations/import/batches`, testUser)
      );
      return body.batches;
    },
    async listMappings(testUser) {
      const body = await requestJson<{ mappings: IntegrationMappingDto[] }>(
        withUser(`${basePath}/integrations/mappings`, testUser)
      );
      return body.mappings;
    },
    getAudit(testUser) {
      return requestJson<IntegrationAuditDto>(withUser(`${basePath}/integrations/audit`, testUser));
    },
    async setFailureMode(testUser, connectionId) {
      const body = await requestJson<{ diagnostics: IntegrationDiagnosticDto[] }>(
        withUser(`${basePath}/integrations/connections/${encodeURIComponent(connectionId)}/failure-mode`, testUser),
        jsonBody({
          code: "adapter_rate_limited",
          message: "Лимит адаптера",
          retryAfterSeconds: 60
        })
      );
      return body.diagnostics;
    },
    async clearFailureMode(testUser, connectionId) {
      const body = await requestJson<{ diagnostics: IntegrationDiagnosticDto[] }>(
        withUser(`${basePath}/integrations/connections/${encodeURIComponent(connectionId)}/failure-mode`, testUser),
        { method: "DELETE" }
      );
      return body.diagnostics;
    }
  };
}
