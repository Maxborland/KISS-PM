import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KpiDefinitionAdminSurface } from "./KpiDefinitionAdminSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  KpiActionExecutionDto,
  KpiAuditDto,
  KpiDefinitionApiClient,
  KpiDefinitionConfigDto,
  KpiDefinitionListItemDto,
  KpiDefinitionPreviewDto,
  KpiDefinitionVersionResultDto
} from "./kpiDefinitionApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "kpi:read", "kpi.config:write", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: {
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    },
    actor: {
      id: "tenant-admin-a",
      displayName: "Администратор",
      accessProfileId: "profile-tenant-admin-a"
    },
    labels: {},
    permissions
  };
}

function createDefinition(id = "kpi-schedule-variance-a", active = true): KpiDefinitionListItemDto {
  return {
    id,
    tenantId: "tenant-a",
    systemKey: id === "kpi-schedule-variance-a" ? "schedule_variance" : "api_draft_variance",
    label: id === "kpi-schedule-variance-a" ? "Отклонение трудозатрат" : "Отклонение API",
    entityType: "project",
    ownerRoleKey: "project_manager",
    unit: "percent",
    version: 1,
    formulaDefinitionId: id === "kpi-schedule-variance-a" ? "formula-schedule-variance-a-v1" : "formula-api-draft-a",
    thresholdRuleSetId:
      id === "kpi-schedule-variance-a" ? "threshold-schedule-variance-a-v1" : "threshold-api-draft-a",
    evaluationCadence: "weekly",
    active,
    formula: {
      id: id === "kpi-schedule-variance-a" ? "formula-schedule-variance-a-v1" : "formula-api-draft-a",
      tenantId: "tenant-a",
      version: 1,
      expression: "((plannedWorkHours - actualWorkHours) / plannedWorkHours) * 100",
      sourceBindings: [
        {
          key: "plannedWorkHours",
          label: "Плановые часы",
          sourceType: "schedule",
          sourceField: "plannedWorkHours",
          valueType: "number"
        },
        {
          key: "actualWorkHours",
          label: "Фактические часы",
          sourceType: "worklog",
          sourceField: "actualWorkHours",
          valueType: "number"
        }
      ],
      active: true
    },
    thresholdRuleSet: {
      id: id === "kpi-schedule-variance-a" ? "threshold-schedule-variance-a-v1" : "threshold-api-draft-a",
      tenantId: "tenant-a",
      version: 1,
      rules: [
        {
          id: "api-draft-critical",
          severity: "critical",
          condition: { operator: "lte", value: -25 },
          explanation: "Отклонение критическое",
          recommendedActionKeys: ["create_corrective_action"]
        }
      ],
      active: true
    }
  };
}

function createPreview(): KpiDefinitionPreviewDto {
  return {
    mutatesState: false,
    value: -25,
    severity: "critical",
    matchedRuleId: "api-draft-critical",
    formulaTrace: ["binding:plannedWorkHours=80", "binding:actualWorkHours=100", "result:-25"],
    thresholdTrace: ["matched:api-draft-critical:critical"],
    recommendedActionKeys: ["create_corrective_action"]
  };
}

function createAction(commandType = "kpi.definition.publish"): KpiActionExecutionDto {
  return {
    id: `action-${commandType}`,
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    commandType,
    requiredPermission: "kpi.config:write",
    status: "succeeded",
    source: { entityType: "kpiDefinition", entityId: "kpi-api-draft-a" },
    target: { entityType: "kpiDefinition", entityId: "kpi-api-draft-a" },
    before: null,
    after: { definition: { id: "kpi-api-draft-a" } },
    timestamp: "2026-05-16T12:03:00.000Z",
    correlationId: `corr-${commandType}`,
    trace: ["kpi_config:permission kpi.config:write allowed"]
  };
}

function createVersionResult(commandType = "kpi.definition.publish", active = true): KpiDefinitionVersionResultDto {
  const definition = createDefinition("kpi-api-draft-a", active);

  return {
    result: { actionExecution: createAction(commandType) },
    readback: {
      definition,
      formula: definition.formula,
      thresholdRuleSet: definition.thresholdRuleSet
    }
  };
}

function createApiClient(definitions: KpiDefinitionListItemDto[] = [createDefinition()]): KpiDefinitionApiClient {
  let currentDefinitions = [...definitions];
  let audit: KpiAuditDto = { events: [], actionExecutions: [] };

  return {
    listDefinitions: vi.fn(async () => currentDefinitions),
    previewDefinition: vi.fn(async () => createPreview()),
    createDefinition: vi.fn(async (_testUser: string, request: KpiDefinitionConfigDto) => {
      const created = createDefinition(request.id, false);
      currentDefinitions = [...currentDefinitions.filter((definition) => definition.id !== created.id), created];
      const actionExecution = createAction("kpi.definition.create");
      audit = {
        events: [
          {
            id: "audit-create",
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            actionKey: "kpi.definition.create",
            target: { entityType: "kpiDefinition", entityId: created.id },
            result: "success",
            timestamp: "2026-05-16T12:02:00.000Z",
            correlationId: actionExecution.correlationId
          }
        ],
        actionExecutions: [actionExecution]
      };
      return {
        definition: created,
        formula: created.formula,
        thresholdRuleSet: created.thresholdRuleSet,
        result: { actionExecution },
        readback: { definitions: currentDefinitions }
      };
    }),
    publishDefinition: vi.fn(async (_testUser: string, definitionId: string) => {
      currentDefinitions = currentDefinitions.map((definition) =>
        definition.id === definitionId ? { ...definition, active: true } : definition
      );
      const result = createVersionResult("kpi.definition.publish", true);
      audit = {
        events: [
          {
            id: "audit-publish",
            tenantId: "tenant-a",
            actorId: "tenant-admin-a",
            actionKey: "kpi.definition.publish",
            target: { entityType: "kpiDefinition", entityId: definitionId },
            result: "success",
            timestamp: "2026-05-16T12:04:00.000Z",
            correlationId: result.result.actionExecution.correlationId
          }
        ],
        actionExecutions: [result.result.actionExecution]
      };
      return result;
    }),
    retireDefinition: vi.fn(async (_testUser: string, definitionId: string) => {
      currentDefinitions = currentDefinitions.map((definition) =>
        definition.id === definitionId ? { ...definition, active: false } : definition
      );
      return createVersionResult("kpi.definition.retire", false);
    }),
    getKpiAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <KpiDefinitionAdminSurface apiClient={apiClient} currentTenant={currentTenant} testUser="tenant-admin-a" />
    )
  );
}

describe("KpiDefinitionAdminSurface", () => {
  it("loads KPI definitions and shows the admin control surface", async () => {
    renderSurface();

    expect(screen.getByTestId("kpi-definition-status")).toHaveTextContent("Загрузка KPI");

    const list = await screen.findByTestId("kpi-definition-list");
    expect(within(list).getByText(/Отклонение трудозатрат/)).toBeInTheDocument();
    expect(screen.getByText("Опубликована")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-definition-primary-action")).toHaveTextContent("Проверить формулу");
  });

  it("renders loading, empty, and error states", async () => {
    const emptyClient = createApiClient([]);
    renderSurface(emptyClient);
    expect(await screen.findByTestId("kpi-definition-empty")).toHaveTextContent("Нет KPI");

    const errorClient = createApiClient();
    vi.mocked(errorClient.listDefinitions).mockRejectedValueOnce(new Error("API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("kpi-definition-error")).toHaveTextContent("API недоступен");
  });

  it("previews formula and threshold without creating or publishing", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("kpi-definition-list");

    fireEvent.click(screen.getByRole("button", { name: "Проверить формулу" }));

    const preview = await screen.findByTestId("kpi-definition-preview");
    expect(preview).toHaveTextContent("Состояние еще не изменено");
    expect(preview).toHaveTextContent("-25");
    expect(preview).toHaveTextContent("Критическая");
    expect(apiClient.createDefinition).not.toHaveBeenCalled();
    expect(apiClient.publishDefinition).not.toHaveBeenCalled();
  });

  it("does not show command evidence when post-mutation readback fails", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("kpi-definition-list");
    vi.mocked(apiClient.listDefinitions).mockRejectedValueOnce(new Error("Readback недоступен"));

    fireEvent.click(screen.getByRole("button", { name: "Проверить формулу" }));
    await screen.findByTestId("kpi-definition-preview");
    fireEvent.click(screen.getByRole("button", { name: "Создать черновик" }));

    expect(await screen.findByTestId("kpi-definition-command-error")).toHaveTextContent("Readback недоступен");
    expect(screen.getByTestId("kpi-definition-result")).toHaveTextContent("Команда еще не выполнялась");
  });

  it("creates and publishes only after preview, then refetches definitions and audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("kpi-definition-list");

    expect(screen.getByRole("button", { name: "Создать черновик" })).toBeDisabled();
    expect(screen.getByTestId("kpi-definition-status")).toHaveTextContent("KPI данные загружены");
    fireEvent.click(screen.getByRole("button", { name: "Проверить формулу" }));
    await screen.findByTestId("kpi-definition-preview");
    fireEvent.click(screen.getByRole("button", { name: "Создать черновик" }));

    await waitFor(() => expect(apiClient.createDefinition).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("kpi-definition-result")).toHaveTextContent("kpi.definition.create");

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать версию" }));

    await waitFor(() => expect(apiClient.publishDefinition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiClient.listDefinitions).toHaveBeenCalledTimes(3));
    expect(screen.getByTestId("kpi-definition-result")).toHaveTextContent("kpi.definition.publish");
    expect(screen.getByTestId("kpi-definition-audit")).toHaveTextContent("kpi.definition.publish");
  });

  it("shows read-only permission state and does not call mutation methods", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "kpi:read", "audit.read"]));
    await screen.findByTestId("kpi-definition-list");

    expect(screen.getByTestId("kpi-definition-readonly")).toHaveTextContent("Публикация недоступна");
    expect(screen.queryByRole("button", { name: "Проверить формулу" })).not.toBeInTheDocument();
    expect(apiClient.previewDefinition).not.toHaveBeenCalled();
  });

  it("shows audit permission state instead of empty audit when audit.read is missing", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "kpi:read", "kpi.config:write"]));

    await screen.findByTestId("kpi-definition-list");

    expect(screen.getByTestId("kpi-definition-audit")).toHaveTextContent("Аудит недоступен");
    expect(apiClient.getKpiAudit).not.toHaveBeenCalled();
  });

  it("recovers from publish conflict with retry after API readback", async () => {
    const apiClient = createApiClient([createDefinition("kpi-api-draft-a", false)]);
    vi.mocked(apiClient.publishDefinition).mockRejectedValueOnce(
      Object.assign(new Error("Конфликт данных"), { code: "conflict" })
    );
    renderSurface(apiClient);
    await screen.findByTestId("kpi-definition-list");

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать версию" }));

    expect(await screen.findByTestId("kpi-definition-command-error")).toHaveTextContent("Конфликт данных");
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(apiClient.listDefinitions).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать версию" }));
    await waitFor(() => expect(apiClient.publishDefinition).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("kpi-definition-result")).toHaveTextContent("kpi.definition.publish");
  });

  it("retires the active KPI definition, not an inactive draft", async () => {
    const apiClient = createApiClient([createDefinition(), createDefinition("kpi-api-draft-a", false)]);
    renderSurface(apiClient);
    await screen.findByTestId("kpi-definition-list");

    fireEvent.click(screen.getByRole("button", { name: "Вывести из публикации" }));

    await waitFor(() => expect(apiClient.retireDefinition).toHaveBeenCalledTimes(1));
    expect(apiClient.retireDefinition).toHaveBeenCalledWith(
      "tenant-admin-a",
      "kpi-schedule-variance-a",
      expect.objectContaining({ expectedVersion: 1 })
    );
    expect(screen.getByTestId("kpi-definition-result")).toHaveTextContent("kpi.definition.retire");
  });

  it("denies users without KPI read permission", () => {
    renderSurface(createApiClient(), createCurrentTenant(["tenant.read"]));

    expect(screen.getByTestId("kpi-definition-denied")).toHaveTextContent("Нет доступа к KPI");
  });
});
