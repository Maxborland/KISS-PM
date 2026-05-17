import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntegrationAdminDiagnosticsSurface } from "./IntegrationAdminDiagnosticsSurface";
import type {
  IntegrationAdapterDto,
  IntegrationAdminDiagnosticsApiClient,
  IntegrationAuditDto,
  IntegrationConnectionDto,
  IntegrationDiagnosticDto,
  IntegrationImportApplyResponseDto,
  IntegrationImportBatchDto,
  IntegrationImportPreviewResponseDto,
  IntegrationMappingDto
} from "./integrationAdminDiagnosticsApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = [
    "tenant.read",
    "integration.read",
    "integration.preview",
    "integration.apply",
    "integration.mapping.read",
    "integration.audit.read",
    "integration.admin"
  ]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createAdapter(): IntegrationAdapterDto {
  return {
    id: "adapter-mock-crm",
    tenantId: "tenant-a",
    systemKey: "mock-crm",
    label: "Mock CRM",
    sourceSystem: "mock-crm",
    capabilities: ["import_preview", "import_apply", "health_check"],
    active: true
  };
}

function createConnection(): IntegrationConnectionDto {
  return {
    id: "conn-mock-crm-a",
    tenantId: "tenant-a",
    adapterId: "adapter-mock-crm",
    label: "Mock CRM connection",
    sourceSystem: "mock-crm",
    status: "healthy",
    configuredAt: "2026-05-17T07:00:00+07:00"
  };
}

function createPreviewResponse(canApply = true): IntegrationImportPreviewResponseDto {
  return {
    preview: {
      id: canApply ? "preview-api-import-tenant-a-0001" : "preview-api-import-tenant-a-invalid",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: canApply ? "fingerprint-valid" : "fingerprint-invalid",
      receivedAt: "2026-05-17T07:30:00+07:00",
      previewedAt: "2026-05-17T07:30:00+07:00",
      mutatesState: false,
      report: { creates: canApply ? 5 : 0, updates: 0, skips: 0, errors: canApply ? 0 : 1 },
      mappingPreview: [{ mappingKey: "tenant-a:mock-crm:opportunity:api-opp-100", action: "create" }],
      affectedCanonicalRefs: [{ entityType: "opportunity", entityId: "opp-canonical-api-100" }],
      validationIssues: canApply
        ? []
        : [{ code: "invalid_payload", severity: "blocking", path: "opportunity.title", message: "title required" }]
    },
    validationReport: {
      previewId: canApply ? "preview-api-import-tenant-a-0001" : "preview-api-import-tenant-a-invalid",
      safeToApply: canApply,
      summary: { creates: canApply ? 5 : 0, updates: 0, skips: 0, errors: canApply ? 0 : 1, totalAffected: canApply ? 5 : 0 },
      blockers: canApply ? [] : [{ code: "invalid_payload", severity: "blocking", recoveryText: "Исправьте payload" }],
      sampleMappings: [{ mappingKey: "tenant-a:mock-crm:opportunity:api-opp-100", action: "create" }],
      affectedCanonicalRefs: [{ entityType: "opportunity", entityId: "opp-canonical-api-100" }],
      generatedAt: "2026-05-17T07:30:00+07:00"
    },
    dryRunSummary: {
      previewId: canApply ? "preview-api-import-tenant-a-0001" : "preview-api-import-tenant-a-invalid",
      canApply,
      mutatesState: false,
      expectedCreates: canApply ? 5 : 0,
      expectedUpdates: 0,
      expectedSkips: 0,
      expectedErrors: canApply ? 0 : 1,
      expectedTotalAffected: canApply ? 5 : 0,
      recoveryActions: canApply ? [] : ["Исправьте payload"],
      generatedAt: "2026-05-17T07:30:00+07:00"
    }
  };
}

function createBatch(): IntegrationImportBatchDto {
  return {
    id: "batch-api-import-100",
    tenantId: "tenant-a",
    adapterId: "adapter-mock-crm",
    connectionId: "conn-mock-crm-a",
    previewId: "preview-api-import-tenant-a-0001",
    idempotencyKey: "idem-api-import-100",
    status: "applied",
    appliedAt: "2026-05-17T07:31:00+07:00",
    mappingKeys: ["tenant-a:mock-crm:opportunity:api-opp-100"],
    canonicalRefs: [{ entityType: "opportunity", entityId: "opp-canonical-api-100" }]
  };
}

function createMapping(): IntegrationMappingDto {
  return {
    id: "mapping-api-opp-100",
    tenantId: "tenant-a",
    sourceSystem: "mock-crm",
    externalEntityType: "opportunity",
    externalEntityId: "api-opp-100",
    canonicalEntityType: "opportunity",
    canonicalEntityId: "opp-canonical-api-100",
    mappingKey: "tenant-a:mock-crm:opportunity:api-opp-100",
    lastBatchId: "batch-api-import-100",
    lastSyncStatus: "synced",
    updatedAt: "2026-05-17T07:31:00+07:00"
  };
}

function createAudit(): IntegrationAuditDto {
  return {
    audit: [
      {
        id: "audit-api-import-100",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        command: "import_apply",
        result: "success",
        timestamp: "2026-05-17T07:31:00+07:00",
        correlationId: "batch-api-import-100",
        target: { entityType: "importBatch", entityId: "batch-api-import-100" }
      }
    ]
  };
}

function createApplyResponse(): IntegrationImportApplyResponseDto {
  const batch = createBatch();
  const mapping = createMapping();
  const audit = createAudit().audit;

  return {
    result: {
      tenantId: "tenant-a",
      status: "applied",
      idempotentReplay: false,
      batch,
      mappings: [mapping],
      audit: audit[0]!
    },
    readback: {
      batches: [batch],
      mappings: [mapping],
      audit
    }
  };
}

function createApiClient(
  options: { failLoad?: boolean; staleApplyOnce?: boolean; failMappingReadbackAfterApply?: boolean } = {}
): IntegrationAdminDiagnosticsApiClient {
  let batches: IntegrationImportBatchDto[] = [];
  let mappings: IntegrationMappingDto[] = [];
  let audit: IntegrationAuditDto = { audit: [] };
  let diagnostics: IntegrationDiagnosticDto[] = [
    { tenantId: "tenant-a", adapterId: "adapter-mock-crm", connectionId: "conn-mock-crm-a", status: "healthy" }
  ];
  let staleApply = options.staleApplyOnce ?? false;
  let failMappingReadback = false;

  return {
    listAdapters: vi.fn(async () => {
      if (options.failLoad) throw new Error("API интеграций недоступен");
      return [createAdapter()];
    }),
    listConnections: vi.fn(async () => [createConnection()]),
    listDiagnostics: vi.fn(async () => diagnostics),
    previewImport: vi.fn(async (_testUser, request) => createPreviewResponse(request.payloadFixtureKey === "mock-crm-valid")),
    applyImport: vi.fn(async () => {
      if (staleApply) {
        staleApply = false;
        throw Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" });
      }
      const response = createApplyResponse();
      batches = response.readback.batches;
      mappings = response.readback.mappings;
      audit = { audit: response.readback.audit };
      failMappingReadback = options.failMappingReadbackAfterApply ?? false;
      return response;
    }),
    listBatches: vi.fn(async () => batches),
    listMappings: vi.fn(async () => {
      if (failMappingReadback) {
        failMappingReadback = false;
        throw new Error("mapping readback unavailable");
      }
      return mappings;
    }),
    getAudit: vi.fn(async () => audit),
    setFailureMode: vi.fn(async () => {
      diagnostics = [
        {
          tenantId: "tenant-a",
          adapterId: "adapter-mock-crm",
          connectionId: "conn-mock-crm-a",
          status: "rate_limited",
          failure: {
            code: "adapter_rate_limited",
            message: "Лимит адаптера",
            retryable: true,
            retryAfterSeconds: 60,
            occurredAt: "2026-05-17T07:32:00+07:00"
          }
        }
      ];
      return diagnostics;
    }),
    clearFailureMode: vi.fn(async () => {
      diagnostics = [{ tenantId: "tenant-a", adapterId: "adapter-mock-crm", connectionId: "conn-mock-crm-a", status: "healthy" }];
      return diagnostics;
    })
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <IntegrationAdminDiagnosticsSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("IntegrationAdminDiagnosticsSurface", () => {
  it("loads adapters, connections, diagnostics, empty mappings, and error state", async () => {
    renderSurface();
    expect(screen.getByTestId("integration-admin-status")).toHaveTextContent("Загрузка интеграций");
    await waitFor(() => expect(screen.getByTestId("integration-adapter-list")).toHaveTextContent("Mock CRM"));
    expect(screen.getByTestId("integration-connection-list")).toHaveTextContent("conn-mock-crm-a");
    expect(screen.getByTestId("integration-diagnostics-panel")).toHaveTextContent("healthy");
    expect(screen.getByTestId("integration-mapping-table")).toHaveTextContent("Пока нет mappings");

    cleanup();
    renderSurface(createApiClient({ failLoad: true }));
    expect(await screen.findByTestId("integration-admin-error")).toHaveTextContent("API интеграций недоступен");
  });

  it("previews import without mutation and then applies through API readback with audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("integration-adapter-list")).toHaveTextContent("Mock CRM"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть импорт" }));
    const preview = await screen.findByTestId("integration-import-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("Создать: 5");
    expect(preview).toHaveTextContent("mock-crm:opportunity");
    expect(apiClient.applyImport).not.toHaveBeenCalled();
    expect(screen.getByTestId("integration-mapping-table")).toHaveTextContent("Пока нет mappings");

    fireEvent.click(screen.getByRole("button", { name: "Применить preview" }));
    expect(await screen.findByTestId("integration-import-result")).toHaveTextContent("batch-api-import-100");
    expect(screen.getByTestId("integration-mapping-table")).toHaveTextContent("opp-canonical-api-100");
    expect(screen.getByTestId("integration-audit-panel")).toHaveTextContent("import_apply");
    await waitFor(() => expect(apiClient.listMappings).toHaveBeenCalledTimes(2));
    expect(apiClient.applyImport).toHaveBeenCalledWith("tenant-admin-a", {
      previewId: "preview-api-import-tenant-a-0001",
      batchId: "batch-ui-preview-api-import-tenant-a-0001",
      idempotencyKey: "idem-ui-preview-api-import-tenant-a-0001",
      confirmed: true
    });
  });

  it("shows read-only denial and never calls preview or apply", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "integration.read", "integration.mapping.read", "integration.audit.read"]));

    expect(await screen.findByTestId("integration-command-denied")).toHaveTextContent("preview/apply недоступны");
    expect(screen.queryByRole("button", { name: "Предпросмотреть импорт" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Применить preview" })).not.toBeInTheDocument();
    expect(apiClient.previewImport).not.toHaveBeenCalled();
    expect(apiClient.applyImport).not.toHaveBeenCalled();
  });

  it("keeps applied result visible when post-apply readback refresh fails", async () => {
    const apiClient = createApiClient({ failMappingReadbackAfterApply: true });
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("integration-adapter-list")).toHaveTextContent("Mock CRM"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть импорт" }));
    expect(await screen.findByTestId("integration-import-preview")).toHaveTextContent("Состояние еще не изменено");
    fireEvent.click(screen.getByRole("button", { name: "Применить preview" }));

    expect(await screen.findByTestId("integration-import-result")).toHaveTextContent("batch-api-import-100");
    expect(await screen.findByTestId("integration-command-error")).toHaveTextContent(
      "Импорт применен, но readback не обновился",
    );
    expect(screen.getByTestId("integration-admin-status")).toHaveTextContent("readback требует повтора");
    expect(screen.getByTestId("integration-mapping-table")).toBeInTheDocument();
  });

  it("recovers from stale preview and adapter failure state through API refetch", async () => {
    const apiClient = createApiClient({ staleApplyOnce: true });
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("integration-adapter-list")).toHaveTextContent("Mock CRM"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть импорт" }));
    expect(await screen.findByTestId("integration-import-preview")).toHaveTextContent("Состояние еще не изменено");
    fireEvent.click(screen.getByRole("button", { name: "Применить preview" }));
    expect(await screen.findByTestId("integration-command-error")).toHaveTextContent("Предпросмотр устарел");
    expect(screen.queryByTestId("integration-import-preview")).not.toBeInTheDocument();
    const adapterReadbacksBeforeManualRefresh = vi.mocked(apiClient.listAdapters).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.listAdapters).mock.calls.length).toBeGreaterThan(adapterReadbacksBeforeManualRefresh),
    );

    fireEvent.click(screen.getByRole("button", { name: "Включить rate-limit" }));
    expect(await screen.findByTestId("integration-diagnostics-panel")).toHaveTextContent("adapter_rate_limited");
    fireEvent.click(screen.getByRole("button", { name: "Снять сбой" }));
    expect(await screen.findByTestId("integration-diagnostics-panel")).toHaveTextContent("healthy");
  });

  it("shows validation blockers and keeps apply disabled for unsafe preview", async () => {
    renderSurface();
    await waitFor(() => expect(screen.getByTestId("integration-adapter-list")).toHaveTextContent("Mock CRM"));
    fireEvent.change(screen.getByLabelText("Фикстура импорта"), { target: { value: "mock-crm-invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть импорт" }));

    const preview = await screen.findByTestId("integration-import-preview");
    expect(preview).toHaveTextContent("invalid_payload");
    expect(preview).toHaveTextContent("Исправьте payload");
    expect(screen.getByRole("button", { name: "Применить preview" })).toBeDisabled();
  });
});
