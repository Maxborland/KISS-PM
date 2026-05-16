import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TenantLabelsAdminSurface } from "./TenantLabelsAdminSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  TenantLabelAuditDto,
  TenantLabelPublishResultDto,
  TenantLabelReadModelDto,
  TenantLabelSetPreviewDto,
  TenantLabelsApiClient
} from "./tenantLabelsApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(permissions = ["tenant.read", "tenant.config.read", "tenant.config.write", "audit.read"]): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createReadModel(version = 1): TenantLabelReadModelDto {
  const projectManagerLabel = version > 1 ? "РП" : "Руководитель проекта";
  const initiationLabel = version > 1 ? "Старт проекта" : "Инициация";
  return {
    labelSet: {
      tenantId: "tenant-a",
      configurationVersion: version,
      labels: {
        "runtime.role.project_manager": projectManagerLabel,
        "runtime.stage.initiation": initiationLabel
      },
      updatedAt: "2026-08-01T00:00:00.000Z"
    },
    runtimeProjection: {
      roles: [{ key: "project_manager", label: projectManagerLabel }],
      stages: [{ key: "initiation", label: initiationLabel }],
      controlSurfaces: [{ key: "portfolio.control", label: "Портфель" }]
    }
  };
}

function createPreview(): TenantLabelSetPreviewDto {
  return {
    id: "preview-tenant-labels-tenant-a-1-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    mutatesState: false,
    before: {
      configurationVersion: 1,
      labels: createReadModel(1).labelSet.labels
    },
    after: {
      configurationVersion: 2,
      labels: createReadModel(2).labelSet.labels
    },
    changes: [
      { key: "runtime.role.project_manager", beforeLabel: "Руководитель проекта", afterLabel: "РП" },
      { key: "runtime.stage.initiation", beforeLabel: "Инициация", afterLabel: "Старт проекта" }
    ],
    affectedRuntimeSurfaces: ["project.stage.header", "task.participant.role"],
    createdAt: "2026-08-01T00:01:00.000Z"
  };
}

function createAudit(): TenantLabelAuditDto {
  return {
    events: [
      {
        id: "audit-p10-labels-tenant-a-2",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "tenant_label_set.publish",
        target: { entityType: "tenantLabelSet", entityId: "tenant-a" },
        result: "success",
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "tenant-labels-tenant-a-1"
      }
    ],
    actionExecutions: [
      {
        id: "action-labels-a",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        commandType: "tenant_label_set.publish",
        requiredPermission: "tenant.config.write",
        status: "succeeded",
        source: { entityType: "tenantLabelSet", entityId: "tenant-a" },
        target: { entityType: "tenantLabelSet", entityId: "tenant-a" },
        before: null,
        after: { configurationVersion: 2 },
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "tenant-labels-tenant-a-1",
        auditEventIds: ["audit-p10-labels-tenant-a-2"],
        trace: ["tenant_labels:runtime projection refreshed"]
      }
    ]
  };
}

function createApiClient(): TenantLabelsApiClient {
  let version = 1;
  let audit: TenantLabelAuditDto = { events: [], actionExecutions: [] };
  return {
    getLabels: vi.fn(async () => createReadModel(version)),
    previewLabels: vi.fn(async () => createPreview()),
    publishLabels: vi.fn(async () => {
      version = 2;
      audit = createAudit();
      return {
        result: {
          labelSet: createReadModel(2).labelSet,
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-p10-labels-tenant-a-2",
            commandType: "tenant_label_set.publish",
            beforeConfigurationVersion: 1,
            afterConfigurationVersion: 2,
            changedKeys: ["runtime.role.project_manager", "runtime.stage.initiation"],
            publishedAt: "2026-08-01T00:02:00.000Z"
          },
          actionExecution: createAudit().actionExecutions[0]!
        },
        readback: {
          runtimeProjection: createReadModel(2).runtimeProjection
        }
      } satisfies TenantLabelPublishResultDto;
    }),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <TenantLabelsAdminSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("TenantLabelsAdminSurface", () => {
  it("loads label versions and runtime projection", async () => {
    renderSurface();

    expect(screen.getByTestId("tenant-labels-status")).toHaveTextContent("Загрузка меток");
    const projection = await screen.findByTestId("tenant-labels-runtime-projection");
    expect(projection).toHaveTextContent("Руководитель проекта");
    expect(projection).toHaveTextContent("Инициация");
    expect(screen.getByLabelText("Роль руководителя проекта")).toHaveValue("Руководитель проекта");
    expect(screen.getByLabelText("Начальная стадия")).toHaveValue("Инициация");
  });

  it("renders empty, loading, and API error states", async () => {
    const emptyClient = createApiClient();
    vi.mocked(emptyClient.getLabels).mockResolvedValueOnce({
      ...createReadModel(),
      runtimeProjection: { roles: [], stages: [], controlSurfaces: [] }
    });
    renderSurface(emptyClient);
    expect(await screen.findByTestId("tenant-labels-empty")).toHaveTextContent("Нет runtime-проекций");

    const errorClient = createApiClient();
    vi.mocked(errorClient.getLabels).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("tenant-labels-error")).toHaveTextContent("API недоступен");
  });

  it("previews without applying and publishes only through API readback with audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("tenant-labels-runtime-projection");

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    const preview = await screen.findByTestId("tenant-labels-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("РП");
    expect(apiClient.publishLabels).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    await waitFor(() => expect(apiClient.publishLabels).toHaveBeenCalledWith("tenant-admin-a", { previewId: "preview-tenant-labels-tenant-a-1-1" }));
    await waitFor(() => expect(apiClient.getLabels).toHaveBeenCalledTimes(2));
    const projection = screen.getByTestId("tenant-labels-runtime-projection");
    expect(projection).toHaveTextContent("РП");
    expect(projection).toHaveTextContent("Старт проекта");
    expect(screen.getByTestId("tenant-labels-result")).toHaveTextContent("tenant_label_set.publish");
    expect(screen.getByTestId("tenant-labels-audit")).toHaveTextContent("audit-p10-labels-tenant-a-2");
  });

  it("does not show success when post-publish readback fails", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("tenant-labels-runtime-projection");
    vi.mocked(apiClient.getLabels).mockRejectedValueOnce(new Error("Readback недоступен"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("tenant-labels-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));

    expect(await screen.findByTestId("tenant-labels-command-error")).toHaveTextContent("Readback недоступен");
    expect(screen.getByTestId("tenant-labels-result")).toHaveTextContent("Команда еще не выполнялась");
  });

  it("shows read-only and audit permission states without calling mutations", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "tenant.config.read"]));

    await screen.findByTestId("tenant-labels-runtime-projection");
    expect(screen.getByTestId("tenant-labels-readonly")).toHaveTextContent("нет права tenant.config.write");
    expect(screen.queryByRole("button", { name: "Предпросмотр" })).not.toBeInTheDocument();
    expect(apiClient.previewLabels).not.toHaveBeenCalled();
    expect(screen.getByTestId("tenant-labels-audit")).toHaveTextContent("Аудит недоступен");
  });

  it("recovers from stale preview through refetch and retry", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.publishLabels).mockRejectedValueOnce(Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" }));
    renderSurface(apiClient);
    await screen.findByTestId("tenant-labels-runtime-projection");

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("tenant-labels-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(await screen.findByTestId("tenant-labels-command-error")).toHaveTextContent("Предпросмотр устарел");

    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getLabels).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewLabels).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    await waitFor(() => expect(apiClient.publishLabels).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("tenant-labels-result")).toHaveTextContent("tenant_label_set.publish");
  });
});
