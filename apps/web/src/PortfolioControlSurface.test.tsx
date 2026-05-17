import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortfolioControlSurface } from "./PortfolioControlSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ControlSurfaceReadModelDto,
  PortfolioActionDefinitionDto,
  PortfolioActionPreviewDto,
  PortfolioControlApiClient,
  PortfolioControlAuditDto
} from "./portfolioControlApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "control.surface:read", "control.action:write", "risk:accept", "resource.write", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: {
      id: "tenant-admin-a",
      displayName: "Администратор",
      accessProfileId: "profile-tenant-admin-a"
    },
    labels: {},
    permissions
  };
}

function createSurfaceView(rows: ControlSurfaceReadModelDto["rows"] = defaultRows()): ControlSurfaceReadModelDto {
  return {
    surface: {
      id: "portfolio-control",
      tenantId: "tenant-a",
      key: "portfolio.control",
      label: "Контроль портфеля",
      viewType: "hybrid",
      version: 1,
      updatedAt: "2026-05-16T14:00:00.000Z"
    },
    fields: [
      { key: "project_label", label: "Проект", valueType: "text", visible: true },
      { key: "signal_label", label: "Сигнал", valueType: "text", visible: true },
      { key: "severity", label: "Риск", valueType: "severity", visible: true },
      { key: "primary_assignment_id", label: "Назначение", valueType: "text", visible: true },
      { key: "suggested_resource_profile_id", label: "Новый ресурс", valueType: "text", visible: true }
    ],
    widgets: [
      { key: "critical_signal_count", label: "Критичные сигналы", widgetType: "severity_summary", value: 2, severity: "critical" }
    ],
    rows,
    pagination: { offset: 0, limit: 50, total: rows.length }
  };
}

function defaultRows(): ControlSurfaceReadModelDto["rows"] {
  return [
    {
      id: "row-kpi-signal-kpi-schedule-variance-a",
      entityType: "kpi_signal",
      entityId: "signal-kpi-schedule-variance-a",
      label: "Критическое отклонение трудозатрат",
      severity: "critical",
      explanation: "Критическое отклонение трудозатрат",
      fieldValues: {
        project_label: "project-alpha-a",
        signal_label: "Критическое отклонение трудозатрат",
        severity: "critical"
      },
      sourceRefs: [
        { entityType: "project", entityId: "project-alpha-a" },
        { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" }
      ],
      drilldowns: [
        {
          key: "open_project_gantt",
          label: "Открыть Гантт",
          targetSurfaceKey: "project.gantt",
          targetEntityType: "project",
          href: "/projects/project-alpha-a/gantt",
          available: true
        }
      ],
      actions: [
        {
          key: "create_corrective_action",
          label: "Создать корректирующую задачу",
          actionDefinitionKey: "create_corrective_action",
          slotType: "primary",
          targetEntityType: "control_signal",
          dryRunRequired: false,
          available: true
        },
        {
          key: "accept_risk",
          label: "Принять риск",
          actionDefinitionKey: "accept_risk",
          slotType: "row",
          targetEntityType: "control_signal",
          dryRunRequired: true,
          available: true
        },
        {
          key: "escalate",
          label: "Эскалировать",
          actionDefinitionKey: "escalate",
          slotType: "row",
          targetEntityType: "control_signal",
          dryRunRequired: true,
          available: true
        },
        {
          key: "request_explanation",
          label: "Запросить объяснение",
          actionDefinitionKey: "request_explanation",
          slotType: "row",
          targetEntityType: "control_signal",
          dryRunRequired: true,
          available: true
        }
      ]
    },
    {
      id: "row-resource-overload-resource-architect-a",
      entityType: "resource_overload",
      entityId: "overload:resource-architect-a:2026-06-01:2026-06-05",
      label: "Анна Архитектор",
      severity: "critical",
      explanation: "Перегрузка ресурса Анна Архитектор: 14 ч.",
      fieldValues: {
        project_label: "project-alpha-a",
        signal_label: "Перегрузка 14 ч.",
        severity: "critical",
        primary_assignment_id: "assignment-design-architect-a",
        suggested_resource_profile_id: "resource-engineer-a"
      },
      sourceRefs: [{ entityType: "resource_overload", entityId: "overload:resource-architect-a:2026-06-01:2026-06-05" }],
      drilldowns: [
        {
          key: "open_project_gantt",
          label: "Открыть Гантт",
          targetSurfaceKey: "project.gantt",
          targetEntityType: "project",
          href: "/projects/project-alpha-a/gantt",
          available: true
        }
      ],
      actions: [
        {
          key: "shift_work",
          label: "Сдвинуть работу",
          actionDefinitionKey: "shift_work",
          slotType: "row",
          targetEntityType: "resource_overload",
          dryRunRequired: true,
          available: true
        },
        {
          key: "split_work",
          label: "Разделить работу",
          actionDefinitionKey: "split_work",
          slotType: "row",
          targetEntityType: "resource_overload",
          dryRunRequired: true,
          available: true
        },
        {
          key: "reassign_resource",
          label: "Переназначить ресурс",
          actionDefinitionKey: "reassign_resource",
          slotType: "row",
          targetEntityType: "resource_overload",
          dryRunRequired: true,
          available: true
        }
      ]
    }
  ];
}

function createActions(): PortfolioActionDefinitionDto[] {
  return [
    {
      id: "action-create-corrective-task",
      key: "create_corrective_action",
      label: "Создать корректирующую задачу",
      description: "Создает каноническую задачу",
      targetEntityType: "kpi_signal",
      requiredPermission: "control.action:write",
      dryRunRequired: false,
      inputSchema: { fields: [{ key: "title", label: "Название", valueType: "text", required: true, summary: true }] },
      commandType: "corrective_task.create"
    },
    {
      id: "action-accept-risk",
      key: "accept_risk",
      label: "Принять риск",
      description: "Фиксирует принятие риска",
      targetEntityType: "kpi_signal",
      requiredPermission: "risk:accept",
      dryRunRequired: true,
      inputSchema: { fields: [{ key: "reason", label: "Причина", valueType: "text", required: true, summary: true }] },
      commandType: "risk.accept"
    },
    {
      id: "action-escalate-signal",
      key: "escalate",
      label: "Эскалировать",
      description: "Фиксирует эскалацию",
      targetEntityType: "kpi_signal",
      requiredPermission: "control.action:write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
          { key: "escalationLevel", label: "Уровень", valueType: "text", required: true, summary: true }
        ]
      },
      commandType: "signal.escalate"
    },
    {
      id: "action-request-explanation",
      key: "request_explanation",
      label: "Запросить объяснение",
      description: "Фиксирует запрос объяснения",
      targetEntityType: "kpi_signal",
      requiredPermission: "control.action:write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
          { key: "requestedFrom", label: "Ответственный", valueType: "text", required: true, summary: true }
        ]
      },
      commandType: "signal.request_explanation"
    },
    {
      id: "action-shift-resource-work",
      key: "shift_work",
      label: "Сдвинуть работу",
      description: "Готовит сдвиг работы",
      targetEntityType: "resource_overload",
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "assignmentId", label: "Назначение", valueType: "text", required: true, summary: true },
          { key: "shiftDays", label: "Дней", valueType: "number", required: true, summary: true }
        ]
      },
      commandType: "resource_resolution.shift_work"
    },
    {
      id: "action-split-resource-work",
      key: "split_work",
      label: "Разделить работу",
      description: "Готовит разделение работы",
      targetEntityType: "resource_overload",
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "assignmentId", label: "Назначение", valueType: "text", required: true, summary: true },
          { key: "splitHours", label: "Часы", valueType: "number", required: true, summary: true }
        ]
      },
      commandType: "resource_resolution.split_work"
    },
    {
      id: "action-reassign-resource",
      key: "reassign_resource",
      label: "Переназначить ресурс",
      description: "Готовит переназначение",
      targetEntityType: "resource_overload",
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "assignmentId", label: "Назначение", valueType: "text", required: true, summary: true },
          { key: "targetResourceProfileId", label: "Новый ресурс", valueType: "text", required: true, summary: true }
        ]
      },
      commandType: "resource_resolution.reassign_resource"
    }
  ];
}

function createPreview(): PortfolioActionPreviewDto {
  return {
    id: "preview-p8-1-1",
    tenantId: "tenant-a",
    actionDefinitionId: "action-accept-risk",
    actionKey: "accept_risk",
    commandType: "risk.accept",
    target: {
      surfaceId: "portfolio-control",
      surfaceKey: "portfolio.control",
      rowId: "row-kpi-signal-kpi-schedule-variance-a",
      entityType: "kpi_signal",
      entityId: "signal-kpi-schedule-variance-a"
    },
    input: { reason: "Контролируемый риск до перепланирования", expiresAt: "2026-06-30" },
    mutatesState: false,
    before: { status: "open" },
    after: { status: "would_execute", commandType: "risk.accept" },
    requiredPermission: "risk:accept",
    stateVersion: 1
  };
}

function createApiClient(view = createSurfaceView()): PortfolioControlApiClient {
  const currentView = view;
  const audit: PortfolioControlAuditDto = { events: [], actionExecutions: [] };

  return {
    getSurfaceView: vi.fn(async () => currentView),
    listSurfaceActions: vi.fn(async () => createActions()),
    previewAction: vi.fn(async () => createPreview()),
    executeAction: vi.fn(async () => {
      const error = Object.assign(new Error("domain command binding is not implemented yet"), { code: "not_implemented" });
      throw error;
    }),
    getControlAudit: vi.fn(async () => audit)
  };
}

function renderSurface(
  apiClient = createApiClient(),
  currentTenant = createCurrentTenant(),
  onOpenGanttProject = vi.fn()
) {
  render(
    withTestQueryClient(
      <PortfolioControlSurface
        apiClient={apiClient}
        currentTenant={currentTenant}
        onOpenGanttProject={onOpenGanttProject}
        testUser="tenant-admin-a"
      />
    )
  );
  return { onOpenGanttProject };
}

describe("PortfolioControlSurface", () => {
  it("loads portfolio rows, severity, source refs, and recommended governed actions", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);

    const list = await screen.findByTestId("portfolio-control-row-list");
    expect(screen.getByTestId("operational-surface-shell")).toHaveTextContent("Портфельный контроль");
    expect(screen.getByTestId("signal-summary-bar")).toHaveTextContent("2 сигналов в портфельной поверхности");
    expect(screen.getByTestId("kpi-strip")).toHaveTextContent("Критичные сигналы");
    expect(within(list).getByText("Критическое отклонение трудозатрат")).toBeInTheDocument();
    expect(within(list).getByText("Перегрузка ресурса Анна Архитектор: 14 ч.")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-control-widget-critical_signal_count")).toHaveTextContent("2");
    expect(await screen.findByTestId("portfolio-control-detail")).toHaveTextContent("project:project-alpha-a");
    expect(screen.getByTestId("portfolio-control-action-panel")).toHaveTextContent("Создать корректирующую задачу");
    expect(screen.getByTestId("portfolio-control-action-panel")).toHaveTextContent("Принять риск");
    expect(apiClient.getSurfaceView).toHaveBeenCalledWith("tenant-admin-a", "portfolio-control");
  });

  it("opens related Gantt through the drilldown callback", async () => {
    const apiClient = createApiClient();
    const onOpenGanttProject = vi.fn();
    renderSurface(apiClient, createCurrentTenant(), onOpenGanttProject);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Открыть Гантт" }));

    expect(onOpenGanttProject).toHaveBeenCalledWith("project-alpha-a");
  });

  it("previews a governed action and keeps mutation evidence empty before apply", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));

    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("portfolio-control-preview")).toHaveTextContent("preview-p8-1-1");
    expect(screen.getByTestId("portfolio-control-preview")).toHaveTextContent("no mutation");
    expect(screen.getByTestId("portfolio-control-result")).toHaveTextContent("Команда еще не применялась");
    expect(apiClient.getControlAudit).toHaveBeenCalled();
  });

  it("builds resource action inputs from the selected overload row instead of schema labels", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);

    fireEvent.click(await screen.findByText("Перегрузка ресурса Анна Архитектор: 14 ч."));
    fireEvent.click(screen.getByRole("button", { name: "Сдвинуть работу" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(1));
    expect(apiClient.previewAction).toHaveBeenLastCalledWith(
      "tenant-admin-a",
      "action-shift-resource-work",
      expect.objectContaining({
        input: expect.objectContaining({
          assignmentId: "assignment-design-architect-a",
          shiftDays: 7
        })
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Разделить работу" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(2));
    expect(apiClient.previewAction).toHaveBeenLastCalledWith(
      "tenant-admin-a",
      "action-split-resource-work",
      expect.objectContaining({
        input: expect.objectContaining({
          assignmentId: "assignment-design-architect-a",
          splitHours: 6
        })
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Переназначить ресурс" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(3));
    expect(apiClient.previewAction).toHaveBeenLastCalledWith(
      "tenant-admin-a",
      "action-reassign-resource",
      expect.objectContaining({
        input: expect.objectContaining({
          assignmentId: "assignment-design-architect-a",
          targetResourceProfileId: "resource-engineer-a"
        })
      })
    );
  });

  it("builds governed risk, escalation, and explanation inputs explicitly", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(1));
    expect(apiClient.previewAction).toHaveBeenLastCalledWith(
      "tenant-admin-a",
      "action-accept-risk",
      expect.objectContaining({
        input: {
          reason: "Контролируемый риск до перепланирования",
          expiresAt: "2026-06-30"
        }
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Эскалировать" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(2));
    expect(apiClient.previewAction).toHaveBeenLastCalledWith(
      "tenant-admin-a",
      "action-escalate-signal",
      expect.objectContaining({
        input: {
          reason: "Нужно решение управляющего комитета",
          escalationLevel: "steering_committee"
        }
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Запросить объяснение" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(3));
    expect(apiClient.previewAction).toHaveBeenLastCalledWith(
      "tenant-admin-a",
      "action-request-explanation",
      expect.objectContaining({
        input: {
          reason: "Нужен комментарий по отклонению",
          requestedFrom: "tenant-admin-a"
        }
      })
    );
  });

  it("does not fake success when apply reaches an unwired domain command and refetches readback", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("portfolio-control-preview");
    fireEvent.click(screen.getByRole("button", { name: "Применить после preview" }));

    expect(await screen.findByTestId("portfolio-control-command-error")).toHaveTextContent("domain command binding is not implemented yet");
    expect(screen.getByTestId("portfolio-control-result")).toHaveTextContent("Команда еще не применялась");
    await waitFor(() => expect(apiClient.getSurfaceView).toHaveBeenCalledTimes(2));
    expect(apiClient.getControlAudit).toHaveBeenCalledTimes(2);
  });

  it("surfaces readback failure after an execute error instead of leaving an unhandled mutation state", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("portfolio-control-preview");
    vi.mocked(apiClient.getSurfaceView).mockRejectedValueOnce(new Error("Readback недоступен"));
    fireEvent.click(screen.getByRole("button", { name: "Применить после preview" }));

    expect(await screen.findByTestId("portfolio-control-command-error")).toHaveTextContent(
      "domain command binding is not implemented yet; readback: Readback недоступен"
    );
    expect(screen.getByTestId("portfolio-control-status")).toHaveTextContent("Readback не подтвержден");
    expect(screen.getByTestId("portfolio-control-result")).toHaveTextContent("Команда еще не применялась");
  });

  it("handles successful execute by refetching API readback and audit using the real API response shape", async () => {
    const apiClient = createApiClient();
    const execution = {
      id: "action-p8-1",
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      commandType: "risk.accept",
      requiredPermission: "risk:accept",
      status: "succeeded" as const,
      source: { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" },
      target: { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" },
      before: { status: "open" },
      after: { status: "accepted" },
      timestamp: "2026-05-16T15:00:00.000Z",
      correlationId: "action-p8-1",
      trace: ["risk.accept:executed"]
    };
    vi.mocked(apiClient.executeAction).mockResolvedValueOnce({ result: execution });
    vi.mocked(apiClient.getControlAudit).mockResolvedValueOnce({ events: [], actionExecutions: [] }).mockResolvedValueOnce({
      events: [],
      actionExecutions: [execution]
    });
    renderSurface(apiClient);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("portfolio-control-preview");
    fireEvent.click(screen.getByRole("button", { name: "Применить после preview" }));

    expect(await screen.findByTestId("portfolio-control-result")).toHaveTextContent("risk.accept: succeeded");
    expect(screen.getByTestId("action-audit-preview")).toHaveTextContent("risk.accept: succeeded");
    expect(screen.getByTestId("portfolio-control-status")).toHaveTextContent("Команда применена и подтверждена readback");
    expect(apiClient.getSurfaceView).toHaveBeenCalledTimes(2);
    expect(apiClient.getControlAudit).toHaveBeenCalledTimes(2);
  });

  it("does not report a successful mutation as failed when audit is hidden by permissions", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.executeAction).mockResolvedValueOnce({
      result: {
        id: "action-p8-hidden-audit",
        tenantId: "tenant-a",
        actorId: "resource-manager-a",
        commandType: "resource_resolution.reassign_resource",
        requiredPermission: "resource.write",
        status: "succeeded",
        source: { entityType: "resource_overload", entityId: "overload:resource-architect-a:2026-06-01:2026-06-05" },
        before: null,
        after: { status: "would_refresh" },
        timestamp: "2026-05-16T15:10:00.000Z",
        correlationId: "action-p8-hidden-audit",
        trace: []
      }
    });
    renderSurface(
      apiClient,
      createCurrentTenant(["tenant.read", "control.surface:read", "control.action:write", "risk:accept", "resource.write"])
    );
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("portfolio-control-preview");
    fireEvent.click(screen.getByRole("button", { name: "Применить после preview" }));

    expect(await screen.findByTestId("portfolio-control-result")).toHaveTextContent(
      "resource_resolution.reassign_resource: succeeded / audit.read недоступен"
    );
    expect(screen.getByTestId("portfolio-control-status")).toHaveTextContent("Команда применена, аудит скрыт правами");
    expect(apiClient.getControlAudit).not.toHaveBeenCalled();
  });

  it("shows loading, empty, and API error states", async () => {
    const emptyClient = createApiClient(createSurfaceView([]));
    renderSurface(emptyClient);
    expect(await screen.findByTestId("portfolio-control-empty")).toHaveTextContent("Нет контрольных сигналов");

    const errorClient = createApiClient();
    vi.mocked(errorClient.getSurfaceView).mockRejectedValueOnce(new Error("Control API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("portfolio-control-error")).toHaveTextContent("Control API недоступен");
  });

  it("surfaces action-list and audit API failures explicitly", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.listSurfaceActions).mockRejectedValueOnce(new Error("Actions API недоступен"));
    vi.mocked(apiClient.getControlAudit).mockRejectedValueOnce(new Error("Audit API недоступен"));
    renderSurface(apiClient);

    expect(await screen.findByTestId("portfolio-control-actions-error")).toHaveTextContent("Actions API недоступен");
    expect(await screen.findByTestId("portfolio-control-audit-error")).toHaveTextContent("Audit API недоступен");
    expect(screen.getByTestId("portfolio-control-audit")).toHaveTextContent("Нет action evidence");
  });

  it("renders read-only state and does not call preview/apply", async () => {
    const readonlyRows = defaultRows().map((row) => ({
      ...row,
      actions: row.actions.map((action) => ({ ...action, available: false, unavailableReason: "permission_denied" as const }))
    }));
    const apiClient = createApiClient(createSurfaceView(readonlyRows));
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "control.surface:read", "audit.read"]));

    await screen.findByTestId("portfolio-control-detail");
    expect(screen.getByTestId("portfolio-control-readonly")).toHaveTextContent("Действия недоступны");
    expect(screen.queryByRole("button", { name: "Предпросмотр" })).not.toBeInTheDocument();
    expect(apiClient.previewAction).not.toHaveBeenCalled();
    expect(apiClient.executeAction).not.toHaveBeenCalled();
  });

  it("explains tenant-disabled actions separately from recommendations and permissions", async () => {
    const disabledRows = defaultRows().map((row) => ({
      ...row,
      actions: row.actions.map((action) =>
        action.key === "accept_risk"
          ? { ...action, available: false, unavailableReason: "configuration_disabled" as const }
          : action
      )
    }));
    const apiClient = createApiClient(createSurfaceView(disabledRows));
    renderSurface(apiClient);

    await screen.findByTestId("portfolio-control-detail");
    expect(screen.getByTestId("portfolio-control-action-panel")).toHaveTextContent("Принять риск: отключено конфигурацией");
  });

  it("recovers from stale preview errors with a new preview", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.executeAction).mockRejectedValueOnce(new Error("stale_preview"));
    renderSurface(apiClient);
    await screen.findByTestId("portfolio-control-detail");

    fireEvent.click(screen.getByRole("button", { name: "Принять риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));
    await screen.findByTestId("portfolio-control-preview");
    fireEvent.click(screen.getByRole("button", { name: "Применить после preview" }));
    expect(await screen.findByTestId("portfolio-control-command-error")).toHaveTextContent("stale_preview");

    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }));

    await waitFor(() => expect(apiClient.previewAction).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("portfolio-control-command-error")).toHaveTextContent("Ошибок нет");
  });
});
