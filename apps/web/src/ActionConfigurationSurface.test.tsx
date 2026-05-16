import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionConfigurationSurface } from "./ActionConfigurationSurface";
import type {
  ActionConfigurationApiClient,
  ActionConfigurationAuditDto,
  ActionConfigurationPreviewDto,
  ActionConfigurationPublishResultDto,
  ActionConfigurationReadModelDto
} from "./actionConfigurationApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "tenant.config.read", "tenant.config.write", "control.surface:read", "action.config.write", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createReadModel(version = 1, enabled = true): ActionConfigurationReadModelDto {
  return {
    configuration: {
      tenantId: "tenant-a",
      version,
      actionConfigs: enabled ? [] : [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
      updatedAt: `2026-08-01T00:0${version}:00.000Z`
    },
    actions: [
      {
        id: "action-accept-risk",
        key: "accept_risk",
        label: "Принять риск",
        description: "Фиксирует принятие риска",
        version: 1,
        targetEntityType: "kpi_signal",
        commandType: "risk.accept",
        requiredPermission: "risk:accept",
        dryRunRequired: true,
        enabled,
        disabledReason: enabled ? undefined : "configuration_disabled",
        inputSchema: {
          fields: [
            { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
            { key: "expiresAt", label: "Действует до", valueType: "date", required: false, summary: true }
          ]
        },
        formFields: enabled ? [] : [{ fieldKey: "reason", label: "Причина принятия риска", defaultValue: "Риск принят до комитета" }]
      }
    ],
    runtime: {
      affectedRuntimeSurfaces: ["portfolio.control"],
      disabledActionKeys: enabled ? [] : ["accept_risk"]
    }
  };
}

function createPreview(): ActionConfigurationPreviewDto {
  return {
    id: "preview-action-config-tenant-a-1-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    mutatesState: false,
    before: { version: 1, disabledActionKeys: [] },
    after: { version: 2, disabledActionKeys: ["accept_risk"] },
    formChanges: [{ actionKey: "accept_risk", fieldKeys: ["reason"] }],
    affectedRuntimeSurfaces: ["portfolio.control"],
    createdAt: "2026-08-01T00:01:00.000Z"
  };
}

function createAudit(): ActionConfigurationAuditDto {
  return {
    events: [
      {
        id: "audit-action-config-tenant-a-2",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "action_configuration.publish",
        target: { entityType: "actionConfiguration", entityId: "tenant-a" },
        result: "success",
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "action-config-tenant-a-1"
      }
    ],
    actionExecutions: [
      {
        id: "action-action-config-tenant-a-1",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        commandType: "action_configuration.publish",
        requiredPermission: "action.config.write",
        status: "succeeded",
        source: { entityType: "actionConfiguration", entityId: "tenant-a" },
        target: { entityType: "actionConfiguration", entityId: "tenant-a" },
        before: { version: 1 },
        after: { version: 2 },
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "action-config-tenant-a-1",
        trace: ["action_configuration:preview confirmed"]
      }
    ]
  };
}

function createApiClient(): ActionConfigurationApiClient {
  let published = false;
  let audit: ActionConfigurationAuditDto = { events: [], actionExecutions: [] };

  return {
    getActionConfigs: vi.fn(async () => createReadModel(published ? 2 : 1, !published)),
    previewActionConfigs: vi.fn(async () => createPreview()),
    publishActionConfigs: vi.fn(async () => {
      published = true;
      audit = createAudit();
      return {
        result: {
          configuration: createReadModel(2, false).configuration,
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-action-config-tenant-a-2",
            commandType: "action_configuration.publish",
            beforeVersion: 1,
            afterVersion: 2,
            disabledActionKeys: ["accept_risk"],
            publishedAt: "2026-08-01T00:03:00.000Z"
          },
          actionExecution: audit.actionExecutions[0]!
        },
        readback: createReadModel(2, false)
      } satisfies ActionConfigurationPublishResultDto;
    }),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <ActionConfigurationSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("ActionConfigurationSurface", () => {
  it("loads action configuration and error state", async () => {
    renderSurface();
    expect(screen.getByTestId("action-config-status")).toHaveTextContent("Загрузка конфигурации действий");
    await waitFor(() => expect(screen.getByTestId("action-config-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("action-config-actions")).toHaveTextContent("accept_risk");

    cleanup();
    const apiClient = createApiClient();
    vi.mocked(apiClient.getActionConfigs).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(apiClient);
    expect(await screen.findByTestId("action-config-error")).toHaveTextContent("API недоступен");
  });

  it("previews without mutation, publishes through API readback, and shows audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("action-config-readback")).toHaveTextContent("v1"));

    fireEvent.click(screen.getByLabelText("Отключить действие принятия риска"));
    fireEvent.change(screen.getByLabelText("Default причины"), { target: { value: "Риск принят до комитета" } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр действий" }));
    const preview = await screen.findByTestId("action-config-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("accept_risk");
    expect(apiClient.publishActionConfigs).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать действия" }));
    await waitFor(() =>
      expect(apiClient.publishActionConfigs).toHaveBeenCalledWith("tenant-admin-a", { previewId: "preview-action-config-tenant-a-1-1" })
    );
    await waitFor(() => expect(apiClient.getActionConfigs).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("action-config-readback")).toHaveTextContent("v2");
    expect(screen.getByTestId("action-config-result")).toHaveTextContent("action_configuration.publish");
    expect(screen.getByTestId("action-config-audit")).toHaveTextContent("audit-action-config");
  });

  it("shows read-only state and recovers from stale preview", async () => {
    renderSurface(createApiClient(), createCurrentTenant(["tenant.read", "tenant.config.read", "control.surface:read", "audit.read"]));
    await waitFor(() => expect(screen.getByTestId("action-config-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("action-config-readonly")).toHaveTextContent("action.config.write");
    expect(screen.queryByRole("button", { name: "Предпросмотр действий" })).not.toBeInTheDocument();
    cleanup();

    const apiClient = createApiClient();
    vi.mocked(apiClient.publishActionConfigs).mockRejectedValueOnce(Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" }));
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("action-config-readback")).toHaveTextContent("v1"));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр действий" }));
    await screen.findByTestId("action-config-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать действия" }));
    expect(await screen.findByTestId("action-config-command-error")).toHaveTextContent("Предпросмотр устарел");
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getActionConfigs).toHaveBeenCalledTimes(2));
  });
});
