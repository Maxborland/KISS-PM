import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomFieldBuilderSurface } from "./CustomFieldBuilderSurface";
import type {
  CustomFieldAuditDto,
  CustomFieldBuilderApiClient,
  CustomFieldDefinitionDto,
  CustomFieldPreviewDto,
  CustomFieldPublishResultDto
} from "./customFieldBuilderApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type { ControlSurfaceReadModelDto } from "./portfolioControlApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "tenant.config.read", "tenant.config.write", "custom_field.write", "control.surface:read", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createDefinition(): CustomFieldDefinitionDto {
  return {
    id: "cf-project-risk_level",
    tenantId: "tenant-a",
    targetEntityType: "project",
    key: "risk_level",
    label: "Уровень риска",
    valueType: "single_select",
    required: false,
    active: true,
    version: 1,
    validationRules: { options: ["low", "medium", "high"] },
    visibilityRules: [{ surfaceKey: "portfolio.control", visible: true }],
    permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
    bindingFlags: {
      usableInFilters: true,
      usableInControlSurfaces: true,
      usableInKpiSourceBindings: false
    },
    updatedAt: "2026-08-01T00:01:00.000Z"
  };
}

function createPreview(): CustomFieldPreviewDto {
  return {
    id: "preview-custom-field-tenant-a-1-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    mutatesState: false,
    before: { registryVersion: 1, definitionCount: 0 },
    after: { registryVersion: 2, definitionCount: 1 },
    definition: createDefinition(),
    affectedRuntimeSurfaces: ["portfolio.control"],
    createdAt: "2026-08-01T00:02:00.000Z"
  };
}

function emptySurface(): ControlSurfaceReadModelDto {
  return {
    surface: {
      id: "portfolio-control",
      tenantId: "tenant-a",
      key: "portfolio.control",
      label: "Портфельный контроль",
      viewType: "hybrid",
      version: 1,
      updatedAt: "2026-08-01T00:00:00.000Z"
    },
    fields: [],
    widgets: [],
    rows: [],
    pagination: { offset: 0, limit: 50, total: 0 }
  };
}

function surfaceWithValue(): ControlSurfaceReadModelDto {
  return {
    ...emptySurface(),
    fields: [{ key: "custom.risk_level", label: "Уровень риска", valueType: "single_select", visible: true }],
    rows: [
      {
        id: "row-project-custom-fields-project-p10-custom-field",
        entityType: "project",
        entityId: "project-p10-custom-field",
        label: "Проект P10",
        severity: "attention",
        explanation: "Проект с пользовательскими полями тенанта",
        fieldValues: {
          project_label: "Проект P10",
          signal_label: "Пользовательские поля проекта",
          severity: "attention",
          "custom.risk_level": "high"
        },
        sourceRefs: [{ entityType: "project", entityId: "project-p10-custom-field" }],
        drilldowns: [],
        actions: []
      }
    ],
    pagination: { offset: 0, limit: 50, total: 1 }
  };
}

function createAudit(includeValueWrite = true): CustomFieldAuditDto {
  const publishEvent = {
    id: "audit-custom-field-publish",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    actionKey: "custom_field.publish",
    target: { entityType: "customFieldDefinition", entityId: "cf-project-risk_level" },
    result: "success",
    timestamp: "2026-08-01T00:03:00.000Z",
    correlationId: "custom-field-tenant-a-cf-project-risk_level-1"
  };
  const valueEvent = {
    id: "audit-project-custom-field",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    actionKey: "project.custom_field.set",
    target: { entityType: "project", entityId: "project-p10-custom-field" },
    result: "success",
    timestamp: "2026-08-01T00:05:00.000Z",
    correlationId: "corr-project-custom-field-project-p10-custom-field-risk_level"
  };
  const publishAction = {
    id: "action-custom-field-publish",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    commandType: "custom_field.publish",
    requiredPermission: "custom_field.write",
    status: "succeeded",
    source: { entityType: "customFieldRegistry", entityId: "tenant-a" },
    target: { entityType: "customFieldDefinition", entityId: "cf-project-risk_level" },
    before: null,
    after: { registryVersion: 2 },
    timestamp: "2026-08-01T00:03:00.000Z",
    correlationId: "custom-field-tenant-a-cf-project-risk_level-1",
    auditEventIds: ["audit-custom-field-publish"],
    trace: ["custom_field:published"]
  };
  const valueAction = {
    id: "action-project-custom-field",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    commandType: "project.custom_field.set",
    requiredPermission: "custom_field.write",
    status: "succeeded",
    source: { entityType: "customFieldDefinition", entityId: "risk_level" },
    target: { entityType: "project", entityId: "project-p10-custom-field" },
    before: { fieldKey: "risk_level", value: null },
    after: { fieldKey: "risk_level", value: "high" },
    timestamp: "2026-08-01T00:05:00.000Z",
    correlationId: "corr-project-custom-field-project-p10-custom-field-risk_level",
    auditEventIds: ["audit-project-custom-field"],
    trace: ["project_custom_field:value persisted"]
  };

  return {
    events: includeValueWrite ? [publishEvent, valueEvent] : [publishEvent],
    actionExecutions: includeValueWrite ? [publishAction, valueAction] : [publishAction]
  };
}

function createApiClient(): CustomFieldBuilderApiClient {
  let published = false;
  let valueWritten = false;
  let audit: CustomFieldAuditDto = { events: [], actionExecutions: [] };

  return {
    getCustomFieldRegistry: vi.fn(async () => ({
      registry: {
        tenantId: "tenant-a",
        version: published ? 2 : 1,
        definitions: published ? [createDefinition()] : [],
        updatedAt: "2026-08-01T00:00:00.000Z"
      }
    })),
    previewCustomField: vi.fn(async () => createPreview()),
    publishCustomField: vi.fn(async () => {
      published = true;
      audit = createAudit(false);
      return {
        result: {
          registry: {
            tenantId: "tenant-a",
            version: 2,
            definitions: [createDefinition()],
            updatedAt: "2026-08-01T00:03:00.000Z"
          },
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-custom-field-publish",
            commandType: "custom_field.publish",
            definitionId: "cf-project-risk_level",
            beforeRegistryVersion: 1,
            afterRegistryVersion: 2,
            publishedAt: "2026-08-01T00:03:00.000Z"
          },
          actionExecution: createAudit(false).actionExecutions[0]!
        },
        readback: {
          registry: {
            tenantId: "tenant-a",
            version: 2,
            definitions: [createDefinition()],
            updatedAt: "2026-08-01T00:03:00.000Z"
          }
        }
      } satisfies CustomFieldPublishResultDto;
    }),
    setProjectCustomFieldValue: vi.fn(async () => {
      valueWritten = true;
      audit = createAudit();
      return {
        result: {
          valueRecord: {
            id: "project-p10-custom-field:custom-field:risk_level",
            tenantId: "tenant-a",
            projectId: "project-p10-custom-field",
            definitionId: "cf-project-risk_level",
            definitionVersion: 1,
            fieldKey: "risk_level",
            valueType: "single_select",
            value: "high",
            updatedBy: "tenant-admin-a",
            updatedAt: "2026-08-01T00:05:00.000Z",
            correlationId: "corr-project-custom-field-project-p10-custom-field-risk_level",
            auditEventId: "audit-project-custom-field"
          },
          actionExecution: createAudit().actionExecutions[1]!
        },
        readback: { project: { id: "project-p10-custom-field", customFieldValues: [] } }
      } satisfies Awaited<ReturnType<CustomFieldBuilderApiClient["setProjectCustomFieldValue"]>>;
    }),
    getPortfolioSurfaceView: vi.fn(async () => (valueWritten ? surfaceWithValue() : emptySurface())),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(<CustomFieldBuilderSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />)
  );
}

describe("CustomFieldBuilderSurface", () => {
  it("loads registry, empty surface, and API error states", async () => {
    renderSurface();
    expect(screen.getByTestId("custom-field-status")).toHaveTextContent("Загрузка пользовательских полей");
    await waitFor(() => expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Нет опубликованных полей"));
    expect(screen.getByTestId("custom-field-surface-readback")).toHaveTextContent("Значение еще не видно");

    cleanup();
    const errorClient = createApiClient();
    vi.mocked(errorClient.getCustomFieldRegistry).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("custom-field-error")).toHaveTextContent("API недоступен");
  });

  it("previews without publishing, then publishes through API readback", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Нет опубликованных полей"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    const preview = await screen.findByTestId("custom-field-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("Версия после");
    expect(apiClient.publishCustomField).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    await waitFor(() => expect(apiClient.publishCustomField).toHaveBeenCalledWith("tenant-admin-a", { previewId: "preview-custom-field-tenant-a-1-1" }));
    await waitFor(() => expect(apiClient.getCustomFieldRegistry).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Уровень риска");
    expect(screen.getByTestId("custom-field-result")).toHaveTextContent("custom_field.publish");
    expect(screen.getByTestId("custom-field-audit")).toHaveTextContent("audit-custom-field-publish");
  });

  it("writes project value and refetches portfolio surface/audit readback", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Нет опубликованных полей"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("custom-field-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    await waitFor(() => expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Уровень риска"));

    fireEvent.click(screen.getByRole("button", { name: "Записать значение" }));
    await waitFor(() => expect(apiClient.setProjectCustomFieldValue).toHaveBeenCalledWith("tenant-admin-a", "project-p10-custom-field", "risk_level", { value: "high" }));
    await waitFor(() => expect(apiClient.getPortfolioSurfaceView).toHaveBeenCalledTimes(3));
    expect(screen.getByTestId("custom-field-surface-readback")).toHaveTextContent("Проект P10: high");
    expect(screen.getByTestId("custom-field-result")).toHaveTextContent("project.custom_field.set");
    expect(screen.getByTestId("custom-field-audit")).toHaveTextContent("audit-project-custom-field");
  });

  it("shows read-only state and recovers from stale preview", async () => {
    const readOnlyClient = createApiClient();
    renderSurface(readOnlyClient, createCurrentTenant(["tenant.read", "tenant.config.read", "control.surface:read", "audit.read"]));
    await waitFor(() => expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Нет опубликованных полей"));
    expect(screen.getByTestId("custom-field-readonly")).toHaveTextContent("custom_field.write");
    expect(screen.queryByRole("button", { name: "Предпросмотр" })).not.toBeInTheDocument();
    cleanup();

    const apiClient = createApiClient();
    vi.mocked(apiClient.publishCustomField).mockRejectedValueOnce(Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" }));
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("custom-field-registry")).toHaveTextContent("Нет опубликованных полей"));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("custom-field-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(await screen.findByTestId("custom-field-command-error")).toHaveTextContent("Предпросмотр устарел");

    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getCustomFieldRegistry).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewCustomField).toHaveBeenCalledTimes(2));
  });
});
