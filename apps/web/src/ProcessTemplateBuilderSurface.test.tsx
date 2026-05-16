import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProcessTemplateBuilderSurface } from "./ProcessTemplateBuilderSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ProcessTemplateAuditDto,
  ProcessTemplateBuilderApiClient,
  ProcessTemplatePublishResultDto,
  ProcessTemplateReadModelDto,
  ProcessTemplatePreviewDto
} from "./processTemplateBuilderApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "tenant.config.read", "tenant.config.write", "project.template.write", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function createReadModel(version = 2, label = "Внедрение с интеграциями"): ProcessTemplateReadModelDto {
  const deliveryLabel = version > 2 ? "Поставка" : "Исполнение";
  const initiationLabel = version > 2 ? "Старт" : "Инициация";
  return {
    templates: [
      {
        id: "process-template-integrations-tenant-a",
        tenantId: "tenant-a",
        key: "implementation.integration_heavy",
        label,
        active: true,
        version,
        updatedAt: "2026-08-01T00:00:00.000Z",
        stages: [
          {
            id: "stage-delivery",
            tenantId: "tenant-a",
            key: "delivery",
            label: deliveryLabel,
            sortOrder: 10,
            active: true,
            version: version > 2 ? 2 : 1,
            updatedAt: "2026-08-01T00:00:00.000Z",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: [
              {
                id: "task-template-delivery",
                tenantId: "tenant-a",
                key: "delivery_work",
                label: version > 2 ? "Поставить результат" : "Выполнить поставку",
                defaultParticipantRoleKeys: version > 2 ? ["executor", "controller"] : ["executor"],
                required: true
              }
            ]
          },
          {
            id: "stage-initiation",
            tenantId: "tenant-a",
            key: "initiation",
            label: initiationLabel,
            sortOrder: 20,
            active: true,
            version: version > 2 ? 2 : 1,
            updatedAt: "2026-08-01T00:00:00.000Z",
            requiredArtifactTemplates: [],
            approvalTemplates: [],
            taskTemplates: [
              {
                id: "task-template-kickoff",
                tenantId: "tenant-a",
                key: "kickoff",
                label: "Провести старт проекта",
                defaultParticipantRoleKeys: ["executor"],
                required: true
              }
            ]
          }
        ]
      }
    ]
  };
}

function createPreview(): ProcessTemplatePreviewDto {
  return {
    id: "preview-process-template-tenant-a-2-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    mutatesState: false,
    draft: {},
    before: {
      templateId: "process-template-integrations-tenant-a",
      templateVersion: 2,
      label: "Внедрение с интеграциями",
      activeProjectTemplateVersions: [2]
    },
    after: {
      templateId: "process-template-integrations-tenant-a",
      templateVersion: 3,
      label: "Внедрение enterprise",
      activeStageKeys: ["delivery", "initiation"],
      template: createReadModel(3, "Внедрение enterprise").templates[0]!
    },
    stageChanges: [{ stageId: "stage-delivery", beforeSortOrder: 20, afterSortOrder: 10, beforeLabel: "Исполнение", afterLabel: "Поставка" }],
    taskTemplateChanges: [
      {
        stageId: "stage-delivery",
        taskTemplateId: "task-template-delivery",
        taskTemplateKey: "delivery_work",
        beforeLabel: "Выполнить поставку",
        afterLabel: "Поставить результат",
        beforeDefaultParticipantRoleKeys: ["executor"],
        afterDefaultParticipantRoleKeys: ["executor", "controller"],
        beforeRequired: true,
        afterRequired: true
      }
    ],
    affectedRuntimeSurfaces: ["project.create_from_template", "project.stage.header"],
    createdAt: "2026-08-01T00:01:00.000Z"
  };
}

function createAudit(): ProcessTemplateAuditDto {
  return {
    events: [
      {
        id: "audit-p10-process-template-tenant-a-3",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        actionKey: "process_template.publish",
        target: { entityType: "processTemplate", entityId: "process-template-integrations-tenant-a" },
        result: "success",
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "process-template-tenant-a-process-template-integrations-tenant-a-2"
      }
    ],
    actionExecutions: [
      {
        id: "action-process-template-a",
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        commandType: "process_template.publish",
        requiredPermission: "project.template.write",
        status: "succeeded",
        source: { entityType: "processTemplate", entityId: "process-template-integrations-tenant-a" },
        target: { entityType: "processTemplate", entityId: "process-template-integrations-tenant-a" },
        before: null,
        after: { templateVersion: 3 },
        timestamp: "2026-08-01T00:03:00.000Z",
        correlationId: "process-template-tenant-a-process-template-integrations-tenant-a-2",
        auditEventIds: ["audit-p10-process-template-tenant-a-3"],
        trace: ["process_template:future version published"]
      }
    ]
  };
}

function createApiClient(): ProcessTemplateBuilderApiClient {
  let version = 2;
  let audit: ProcessTemplateAuditDto = { events: [], actionExecutions: [] };
  return {
    getProcessTemplates: vi.fn(async () =>
      version > 2 ? createReadModel(3, "Внедрение enterprise") : createReadModel(2)
    ),
    previewProcessTemplate: vi.fn(async () => createPreview()),
    publishProcessTemplate: vi.fn(async () => {
      version = 3;
      audit = createAudit();
      return {
        result: {
          template: createReadModel(3, "Внедрение enterprise").templates[0]!,
          audit: {
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            auditEventId: "audit-p10-process-template-tenant-a-3",
            commandType: "process_template.publish",
            templateId: "process-template-integrations-tenant-a",
            beforeTemplateVersion: 2,
            afterTemplateVersion: 3,
            publishedAt: "2026-08-01T00:02:00.000Z"
          },
          actionExecution: createAudit().actionExecutions[0]!
        },
        readback: { activeTemplate: createReadModel(3, "Внедрение enterprise").templates[0]! }
      } satisfies ProcessTemplatePublishResultDto;
    }),
    getAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <ProcessTemplateBuilderSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("ProcessTemplateBuilderSurface", () => {
  it("loads template stages and task-template role bindings", async () => {
    renderSurface();

    expect(screen.getByTestId("process-template-status")).toHaveTextContent("Загрузка шаблонов");
    const list = await screen.findByTestId("process-template-stage-list");
    expect(list).toHaveTextContent("Исполнение");
    expect(list).toHaveTextContent("executor");
    expect(screen.getByLabelText("Название шаблона")).toHaveValue("Внедрение с интеграциями");
  });

  it("renders empty, loading, and API error states", async () => {
    const emptyClient = createApiClient();
    vi.mocked(emptyClient.getProcessTemplates).mockResolvedValueOnce({ templates: [] });
    renderSurface(emptyClient);
    expect(await screen.findByTestId("process-template-empty")).toHaveTextContent("Нет активных шаблонов");

    const errorClient = createApiClient();
    vi.mocked(errorClient.getProcessTemplates).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("process-template-error")).toHaveTextContent("API недоступен");
  });

  it("previews without applying and publishes only after API readback with audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("process-template-stage-list");

    fireEvent.change(screen.getByLabelText("Название шаблона"), { target: { value: "Внедрение enterprise" } });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    const preview = await screen.findByTestId("process-template-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("3");
    expect(apiClient.publishProcessTemplate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    await waitFor(() =>
      expect(apiClient.publishProcessTemplate).toHaveBeenCalledWith("tenant-admin-a", {
        templateId: "process-template-integrations-tenant-a",
        previewId: "preview-process-template-tenant-a-2-1"
      })
    );
    await waitFor(() => expect(apiClient.getProcessTemplates).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("process-template-stage-list")).toHaveTextContent("Поставка");
    expect(screen.getByTestId("process-template-result")).toHaveTextContent("process_template.publish");
    expect(screen.getByTestId("process-template-audit")).toHaveTextContent("audit-p10-process-template-tenant-a-3");
  });

  it("does not show success when post-publish readback fails", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("process-template-stage-list");
    vi.mocked(apiClient.getProcessTemplates).mockRejectedValueOnce(new Error("Readback недоступен"));

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("process-template-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));

    expect(await screen.findByTestId("process-template-command-error")).toHaveTextContent("Readback недоступен");
    expect(screen.getByTestId("process-template-result")).toHaveTextContent("Команда еще не выполнялась");
  });

  it("shows read-only state and recovers from stale preview", async () => {
    const readOnlyClient = createApiClient();
    renderSurface(readOnlyClient, createCurrentTenant(["tenant.read", "tenant.config.read", "audit.read"]));
    await screen.findByTestId("process-template-stage-list");
    expect(screen.getByTestId("process-template-readonly")).toHaveTextContent("project.template.write");
    expect(screen.queryByRole("button", { name: "Предпросмотр" })).not.toBeInTheDocument();
    cleanup();

    const apiClient = createApiClient();
    vi.mocked(apiClient.publishProcessTemplate).mockRejectedValueOnce(Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" }));
    renderSurface(apiClient);
    await screen.findByTestId("process-template-stage-list");
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("process-template-preview");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(await screen.findByTestId("process-template-command-error")).toHaveTextContent("Предпросмотр устарел");

    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.getProcessTemplates).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewProcessTemplate).toHaveBeenCalledTimes(2));
  });
});
