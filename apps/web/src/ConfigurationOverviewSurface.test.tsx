import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfigurationOverviewSurface } from "./ConfigurationOverviewSurface";
import type {
  ConfigurationAuditDto,
  ConfigurationExportPackageDto,
  ConfigurationImportPreviewDto,
  ConfigurationOverviewApiClient,
  ConfigurationOverviewDto
} from "./configurationOverviewApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "tenant.config.read", "tenant.config.write", "tenant.config.export", "tenant.config.import", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createOverview(version = 1): ConfigurationOverviewDto {
  return {
    active: {
      tenantId: "tenant-a",
      configurationVersion: version,
      labelSetVersion: version,
      customFieldRegistryVersion: 1,
      actionConfigurationVersion: version
    },
    validation: { canPublish: true, issues: [] },
    runtimeSurfaces: ["tenant.labels", "portfolio.control", "tenant.action_config"],
    versions: {
      labelSet: [{ version, updatedAt: `2026-08-01T00:0${version}:00.000Z` }],
      customFieldRegistry: [{ version: 1, updatedAt: "2026-08-01T00:00:00.000Z" }],
      actionConfiguration: [{ version, updatedAt: `2026-08-01T00:0${version}:00.000Z` }]
    }
  };
}

function createPackage(version = 1): ConfigurationExportPackageDto {
  return {
    schemaVersion: 1,
    tenantId: "tenant-a",
    configurationVersion: version,
    exportedAt: `2026-08-01T00:0${version}:00.000Z`,
    checksum: `cfg-${version}`,
    labelSet: {
      tenantId: "tenant-a",
      configurationVersion: version,
      labels: { "runtime.role.project_manager": version === 1 ? "Руководитель проекта" : "РП импорт" },
      updatedAt: `2026-08-01T00:0${version}:00.000Z`
    },
    customFieldRegistry: {
      tenantId: "tenant-a",
      version: 1,
      definitions: [],
      updatedAt: "2026-08-01T00:00:00.000Z"
    },
    actionConfiguration: {
      tenantId: "tenant-a",
      version,
      actionConfigs: version === 1 ? [] : [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
      updatedAt: `2026-08-01T00:0${version}:00.000Z`
    }
  };
}

function createPreview(): ConfigurationImportPreviewDto {
  return {
    id: "preview-config-import-tenant-a-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    mutatesState: false,
    canApply: true,
    checksum: "cfg-2",
    before: {
      configurationVersion: 1,
      labelSetVersion: 1,
      customFieldRegistryVersion: 1,
      actionConfigurationVersion: 1
    },
    after: {
      configurationVersion: 2,
      labelSetVersion: 2,
      customFieldRegistryVersion: 1,
      actionConfigurationVersion: 2
    },
    diffs: [
      { kind: "label_set", path: "labelSet.configurationVersion", beforeVersion: 1, afterVersion: 2 },
      { kind: "action_configuration", path: "actionConfiguration.version", beforeVersion: 1, afterVersion: 2 }
    ],
    validationIssues: [],
    createdAt: "2026-08-01T00:06:00.000Z"
  };
}

function createAudit(): ConfigurationAuditDto {
  return {
    events: [
      {
        id: "audit-config-import-tenant-a-2",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "tenant_configuration.import_apply",
        target: { entityType: "tenantConfiguration", entityId: "tenant-a" },
        result: "success",
        timestamp: "2026-08-01T00:07:00.000Z",
        correlationId: "configuration-import-tenant-a-1-2"
      }
    ],
    actionExecutions: [
      {
        id: "action-config-import-tenant-a-2",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        commandType: "tenant_configuration.import_apply",
        requiredPermission: "tenant.config.import",
        status: "succeeded",
        source: { entityType: "tenantConfiguration", entityId: "tenant-a" },
        target: { entityType: "tenantConfiguration", entityId: "tenant-a" },
        before: { configurationVersion: 1 },
        after: { configurationVersion: 2 },
        timestamp: "2026-08-01T00:07:00.000Z",
        correlationId: "configuration-import-tenant-a-1-2",
        trace: ["tenant_configuration:import applied"]
      }
    ]
  };
}

function createApiClient(): ConfigurationOverviewApiClient {
  let applied = false;
  let audit: ConfigurationAuditDto = { events: [], actionExecutions: [] };

  return {
    getConfiguration: vi.fn(async () => createOverview(applied ? 2 : 1)),
    validateConfiguration: vi.fn(async () => ({ canPublish: true, issues: [] })),
    exportConfiguration: vi.fn(async () => createPackage(applied ? 2 : 1)),
    previewImport: vi.fn(async () => createPreview()),
    applyImport: vi.fn(async () => {
      applied = true;
      audit = createAudit();
      return {
        result: {
          importedPackage: createPackage(2),
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-config-import-tenant-a-2",
            commandType: "tenant_configuration.import_apply" as const,
            beforeVersion: 1,
            afterVersion: 2,
            importedChecksum: "cfg-2",
            appliedAt: "2026-08-01T00:07:00.000Z"
          },
          actionExecution: audit.actionExecutions[0]!
        },
        readback: createOverview(2)
      };
    }),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <ConfigurationOverviewSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("ConfigurationOverviewSurface", () => {
  it("loads overview and API error state", async () => {
    renderSurface();
    expect(screen.getByTestId("configuration-overview-status")).toHaveTextContent("Загрузка конфигурации");
    await waitFor(() => expect(screen.getByTestId("configuration-overview-readback")).toHaveTextContent("v1"));

    cleanup();
    const apiClient = createApiClient();
    vi.mocked(apiClient.getConfiguration).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(apiClient);
    expect(await screen.findByTestId("configuration-overview-error")).toHaveTextContent("API недоступен");
  });

  it("exports, previews import without mutation, applies through API readback, and shows audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("configuration-overview-readback")).toHaveTextContent("v1"));

    fireEvent.click(screen.getByRole("button", { name: "Экспорт" }));
    await waitFor(() => expect(apiClient.exportConfiguration).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("JSON пакета импорта"), { target: { value: JSON.stringify(createPackage(2)) } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр импорта" }));
    const preview = await screen.findByTestId("configuration-import-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("labelSet.configurationVersion");
    expect(apiClient.applyImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Применить импорт" }));
    await waitFor(() =>
      expect(apiClient.applyImport).toHaveBeenCalledWith("tenant-admin-a", { previewId: "preview-config-import-tenant-a-1" })
    );
    await waitFor(() => expect(apiClient.getConfiguration).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("configuration-overview-readback")).toHaveTextContent("v2");
    expect(screen.getByTestId("configuration-import-result")).toHaveTextContent("tenant_configuration.import_apply");
    expect(screen.getByTestId("configuration-overview-audit")).toHaveTextContent("audit-config-import");
  });

  it("shows read-only state and recoverable validation errors", async () => {
    renderSurface(createApiClient(), createCurrentTenant(["tenant.read", "tenant.config.read", "audit.read"]));
    await waitFor(() => expect(screen.getByTestId("configuration-overview-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("configuration-overview-readonly")).toHaveTextContent("tenant.config.export");
    expect(screen.queryByRole("button", { name: "Экспорт" })).not.toBeInTheDocument();
    cleanup();

    const apiClient = createApiClient();
    vi.mocked(apiClient.previewImport).mockResolvedValueOnce({
      ...createPreview(),
      canApply: false,
      validationIssues: [
        {
          code: "import_checksum_mismatch",
          severity: "error",
          path: "checksum",
          message: "Checksum mismatch",
          recoveryText: "Повторите экспорт"
        }
      ]
    });
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("configuration-overview-readback")).toHaveTextContent("v1"));
    fireEvent.change(screen.getByLabelText("JSON пакета импорта"), { target: { value: JSON.stringify(createPackage(2)) } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр импорта" }));
    expect(await screen.findByTestId("configuration-import-preview")).toHaveTextContent("import_checksum_mismatch");
    expect(screen.getByRole("button", { name: "Применить импорт" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getConfiguration).toHaveBeenCalledTimes(2));
  });
});
