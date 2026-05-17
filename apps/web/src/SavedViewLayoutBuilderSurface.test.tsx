import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavedViewLayoutBuilderSurface } from "./SavedViewLayoutBuilderSurface";
import type {
  SavedViewAuditDto,
  SavedViewLayoutBuilderApiClient,
  SavedViewLayoutPreviewDto,
  SavedViewLayoutReadModelDto,
  SavedViewLayoutPublishResultDto
} from "./savedViewLayoutBuilderApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = [
    "tenant.read",
    "tenant.config.read",
    "tenant.config.write",
    "control.surface:read",
    "control_surface.config.write",
    "audit.read"
  ]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createReadModel(version = 1): SavedViewLayoutReadModelDto {
  return {
    activeSurface: {
      id: "portfolio-control",
      tenantId: "tenant-a",
      key: "portfolio.control",
      label: "Контроль портфеля",
      version,
      status: "active",
      surfaceType: "portfolio",
      updatedAt: "2026-08-01T00:00:00.000Z",
      view: {
        id: "portfolio-control-default-view",
        key: "default",
        label: version === 1 ? "Операционный контроль" : "Портфель без технических полей",
        viewType: "hybrid",
        version,
        fields: [
          { key: "project_label", label: "Проект", visible: true, sortable: true, filterable: true },
          { key: "signal_label", label: "Сигнал", visible: true, sortable: false, filterable: true },
          { key: "severity", label: "Риск", visible: true, sortable: true, filterable: true },
          {
            key: "suggested_resource_profile_id",
            label: "Ресурс",
            visible: version === 1,
            sortable: false,
            filterable: false
          }
        ],
        widgets: [{ key: "critical_signal_count", label: "Критичные сигналы", widgetType: "severity_summary" }],
        actionSlots: [
          { key: "create_corrective_action", label: "Создать корректирующую задачу" },
          { key: "accept_risk", label: "Принять риск" }
        ],
        savedViews:
          version === 1
            ? []
            : [
                {
                  id: "saved-view-critical-portfolio",
                  key: "critical_portfolio",
                  label: "Критичный портфель",
                  ownerType: "tenant",
                  filterKeys: ["severity"],
                  sortKeys: ["project_label"],
                  groupKeys: ["severity"],
                  scope: "tenant"
                }
              ]
      }
    },
    previousVersions: version === 1 ? [] : [{ id: "portfolio-control", version: 1, viewLabel: "Операционный контроль" }]
  };
}

function createPreview(): SavedViewLayoutPreviewDto {
  return {
    id: "preview-layout-tenant-a-1-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    surfaceDefinitionId: "portfolio-control",
    surfaceKey: "portfolio.control",
    mutatesState: false,
    before: {
      surfaceVersion: 1,
      viewVersion: 1,
      visibleFieldKeys: ["project_label", "signal_label", "severity", "suggested_resource_profile_id"],
      widgetKeys: ["critical_signal_count"],
      actionSlotKeys: ["create_corrective_action", "accept_risk"],
      savedViewKeys: []
    },
    after: {
      surfaceVersion: 2,
      viewVersion: 2,
      visibleFieldKeys: ["project_label", "signal_label", "severity"],
      widgetKeys: ["critical_signal_count"],
      actionSlotKeys: ["create_corrective_action", "accept_risk"],
      savedViewKeys: ["critical_portfolio"]
    },
    unavailable: {
      fields: ["suggested_resource_profile_id"],
      widgets: [],
      actionSlots: [],
      reasons: ["поле suggested_resource_profile_id будет скрыто опубликованным макетом"]
    },
    affectedRuntimeSurfaces: ["portfolio.control"],
    createdAt: "2026-08-01T00:01:00.000Z"
  };
}

function createBlockingPreview(): SavedViewLayoutPreviewDto {
  return {
    ...createPreview(),
    id: "preview-layout-blocked",
    unavailable: {
      fields: [],
      widgets: ["critical_signal_count"],
      actionSlots: ["accept_risk"],
      reasons: ["runtime configuration references unavailable controls"]
    }
  };
}

function createAudit(): SavedViewAuditDto {
  return {
    events: [
      {
        id: "audit-layout-tenant-a-2",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "control_surface_layout.publish",
        target: { entityType: "controlSurface", entityId: "portfolio-control" },
        result: "success",
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "layout-tenant-a-portfolio-control-1"
      }
    ],
    actionExecutions: [
      {
        id: "action-layout-publish",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        commandType: "control_surface_layout.publish",
        requiredPermission: "control_surface.config.write",
        status: "succeeded",
        source: { entityType: "controlSurface", entityId: "portfolio-control" },
        target: { entityType: "savedView", entityId: "critical_portfolio" },
        before: { surfaceVersion: 1 },
        after: { surfaceVersion: 2 },
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "layout-tenant-a-portfolio-control-1",
        trace: ["control_surface_layout:preview confirmed"]
      }
    ]
  };
}

function createApiClient(): SavedViewLayoutBuilderApiClient {
  let published = false;
  let audit: SavedViewAuditDto = { events: [], actionExecutions: [] };

  return {
    getSavedViews: vi.fn(async () => createReadModel(published ? 2 : 1)),
    previewLayout: vi.fn(async () => createPreview()),
    publishLayout: vi.fn(async () => {
      published = true;
      audit = createAudit();
      return {
        result: {
          surface: createReadModel(2).activeSurface,
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-layout-tenant-a-2",
            commandType: "control_surface_layout.publish",
            surfaceDefinitionId: "portfolio-control",
            beforeSurfaceVersion: 1,
            afterSurfaceVersion: 2,
            savedViewKey: "critical_portfolio",
            publishedAt: "2026-08-01T00:03:00.000Z"
          },
          actionExecution: audit.actionExecutions[0]!
        },
        readback: createReadModel(2)
      } satisfies SavedViewLayoutPublishResultDto;
    }),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <SavedViewLayoutBuilderSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("SavedViewLayoutBuilderSurface", () => {
  it("loads active layout and API error state", async () => {
    renderSurface();
    expect(screen.getByTestId("saved-view-layout-status")).toHaveTextContent("Загрузка сохраненных видов");
    await waitFor(() => expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("saved-view-layout-fields")).toHaveTextContent("suggested_resource_profile_id");

    cleanup();
    const apiClient = createApiClient();
    vi.mocked(apiClient.getSavedViews).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(apiClient);
    expect(await screen.findByTestId("saved-view-layout-error")).toHaveTextContent("API недоступен");
  });

  it("previews without mutation, then publishes through API readback and audit", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("v1"));

    fireEvent.change(screen.getByLabelText("Ключ сохраненного вида"), { target: { value: "critical_portfolio" } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр макета" }));
    const preview = await screen.findByTestId("saved-view-layout-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("suggested_resource_profile_id");
    const runtimePreview = screen.getByTestId("runtime-config-preview");
    expect(runtimePreview).toHaveTextContent("portfolio.control");
    expect(runtimePreview).toHaveTextContent("v1 -> v2");
    expect(runtimePreview).toHaveTextContent("После reload");
    expect(runtimePreview).toHaveTextContent("critical_portfolio");
    expect(apiClient.publishLayout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать макет" }));
    await waitFor(() => expect(apiClient.publishLayout).toHaveBeenCalledWith("tenant-admin-a", { previewId: "preview-layout-tenant-a-1-1" }));
    await waitFor(() => expect(apiClient.getSavedViews).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("v2");
    expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("critical_portfolio");
    expect(screen.getByTestId("saved-view-layout-previous")).toHaveTextContent("v1");
    expect(screen.getByTestId("saved-view-layout-result")).toHaveTextContent("control_surface_layout.publish");
    expect(screen.getByTestId("saved-view-layout-audit")).toHaveTextContent("audit-layout");
  });

  it("blocks publish when preview reports unavailable runtime widgets or action slots", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.previewLayout).mockResolvedValueOnce(createBlockingPreview());
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("v1"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр макета" }));

    const preview = await screen.findByTestId("runtime-config-preview");
    expect(preview).toHaveTextContent("Блокер: Виджет critical_signal_count недоступен");
    expect(preview).toHaveTextContent("Блокер: Действие accept_risk недоступно");
    expect(screen.getByRole("button", { name: "Опубликовать макет" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать макет" }));

    expect(apiClient.publishLayout).not.toHaveBeenCalled();
  });

  it("shows read-only state and recovers from stale preview", async () => {
    renderSurface(
      createApiClient(),
      createCurrentTenant(["tenant.read", "tenant.config.read", "control.surface:read", "audit.read"])
    );
    await waitFor(() => expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("v1"));
    expect(screen.getByTestId("saved-view-layout-readonly")).toHaveTextContent("control_surface.config.write");
    expect(screen.queryByRole("button", { name: "Предпросмотр макета" })).not.toBeInTheDocument();
    cleanup();

    const apiClient = createApiClient();
    vi.mocked(apiClient.publishLayout).mockRejectedValueOnce(Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" }));
    renderSurface(apiClient);
    await waitFor(() => expect(screen.getByTestId("saved-view-layout-readback")).toHaveTextContent("v1"));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр макета" }));
    await screen.findByTestId("saved-view-layout-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать макет" }));
    expect(await screen.findByTestId("saved-view-layout-command-error")).toHaveTextContent("Предпросмотр устарел");
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getSavedViews).toHaveBeenCalledTimes(2));
  });
});
