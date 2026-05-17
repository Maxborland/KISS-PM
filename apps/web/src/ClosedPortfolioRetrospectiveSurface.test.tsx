import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClosedPortfolioRetrospectiveSurface } from "./ClosedPortfolioRetrospectiveSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ClosedPortfolioReadModelDto,
  RetrospectiveApiClient,
  RetrospectiveInsightReadModelDto,
  TemplateImprovementApplyResultDto,
  TemplateImprovementPreviewDto,
  RetrospectiveTrendsReadModelDto
} from "./retrospectiveApiClient";
import { withTestQueryClient } from "./testQueryClient";

function currentTenant(permissions = ["tenant.read", "retrospective.read", "retrospective.improvement.write", "audit.read"]): CurrentTenantDto {
  return {
    tenant: { id: "tenant-a", label: "Студия A", configurationVersion: 1 },
    actor: { id: "tenant-admin-a", displayName: "Администратор", accessProfileId: "profile-tenant-admin-a" },
    labels: {},
    permissions
  };
}

function portfolioModel(rows: ClosedPortfolioReadModelDto["rows"] = defaultRows()): ClosedPortfolioReadModelDto {
  return {
    surface: {
      id: "surface-p9-closed-portfolio-tenant-a",
      tenantId: "tenant-a",
      key: "retrospectives.closed_portfolio",
      label: "Закрытый портфель",
      viewType: "hybrid",
      version: 1,
      updatedAt: "2026-07-15T00:00:00.000Z"
    },
    fields: [],
    widgets: [
      { key: "critical_trend_count", label: "Критичные тренды", widgetType: "severity_summary", value: 1, severity: "critical" },
      { key: "attention_trend_count", label: "Требуют внимания", widgetType: "severity_summary", value: 1, severity: "attention" }
    ],
    rows,
    pagination: { offset: 0, limit: 25, total: rows.length },
    summary: { totalSnapshots: rows.length, trendSignalCount: rows.length, openInsightCount: rows.length },
    filters: {}
  };
}

function defaultRows(): ClosedPortfolioReadModelDto["rows"] {
  return [
    {
      id: "closed-portfolio-row-snapshot-project-alpha-1",
      entityType: "project",
      entityId: "snapshot-project-alpha-1",
      label: "CRM внедрение",
      severity: "critical",
      explanation: "Найден повторяющийся тренд schedule_delay по 2 снимкам.",
      fieldValues: {
        snapshot_id: "snapshot-project-alpha-1",
        project_title: "CRM внедрение",
        closed_at: "2026-07-15T00:02:00.000Z",
        planned_work_hours: 20,
        actual_work_hours: 26,
        schedule_variance_days: 15,
        severity: "critical"
      },
      sourceRefs: [
        { entityType: "project", entityId: "project-alpha-a" },
        { entityType: "control_signal", entityId: "tenant-a:template:process-template-integrations-tenant-a:schedule_delay" }
      ],
      drilldowns: [
        {
          key: "open_snapshot",
          label: "Открыть снимок",
          targetSurfaceKey: "retrospectives.snapshot",
          targetEntityType: "project",
          href: "/retrospectives/snapshots/snapshot-project-alpha-1",
          available: true
        }
      ],
      actions: [
        {
          key: "prepare_template_improvement",
          label: "Подготовить улучшение шаблона",
          actionDefinitionKey: "template_improvement.prepare",
          slotType: "row",
          targetEntityType: "project",
          dryRunRequired: true,
          available: true
        }
      ]
    }
  ];
}

function trendsModel(): RetrospectiveTrendsReadModelDto {
  return {
    trends: [
      {
        id: "tenant-a:template:process-template-integrations-tenant-a:schedule_delay",
        tenantId: "tenant-a",
        trendKey: "schedule_delay",
        groupBy: "template",
        groupKey: "process-template-integrations-tenant-a",
        occurrenceCount: 2,
        severity: "critical",
        averageVarianceValue: 15,
        averageVariancePercent: 50,
        sourceSnapshotIds: ["snapshot-project-alpha-1"],
        sourceMetricIds: ["snapshot-project-alpha-1:schedule_days"]
      }
    ],
    insights: [
      {
        id: "insight-tenant-a:template:process-template-integrations-tenant-a:schedule_delay",
        tenantId: "tenant-a",
        status: "open",
        title: "Recurring schedule delay",
        recommendation: "Добавить раннюю приемку в будущий шаблон.",
        severity: "critical",
        sourceTrendId: "tenant-a:template:process-template-integrations-tenant-a:schedule_delay",
        sourceSnapshotIds: ["snapshot-project-alpha-1"],
        sourceMetricIds: ["snapshot-project-alpha-1:schedule_days"],
        sourceLessonIds: ["snapshot-project-alpha-1:lesson-a"],
        sourceLessons: [
          {
            id: "snapshot-project-alpha-1:lesson-a",
            snapshotId: "snapshot-project-alpha-1",
            categoryKey: "process",
            summary: "Поздний старт приемки повторяется в закрытых проектах.",
            recommendation: "Добавить раннюю приемку в будущий шаблон.",
            severity: "attention"
          }
        ],
        generatedAt: "2026-07-15T00:00:00.000Z"
      }
    ],
    pagination: { offset: 0, limit: 25, total: 1 }
  };
}

function insightModel(): RetrospectiveInsightReadModelDto {
  return {
    insight: trendsModel().insights[0]!,
    allowedActions: [
      {
        key: "apply_template_improvement",
        label: "Улучшить шаблон",
        actionDefinitionKey: "template_improvement.apply",
        slotType: "primary",
        targetEntityType: "control_signal",
        dryRunRequired: true,
        available: true
      }
    ]
  };
}

function templateImprovementPreview(): TemplateImprovementPreviewDto {
  return {
    id: "preview-template-improvement-insight-1",
    tenantId: "tenant-a",
    actorId: "tenant-admin-a",
    sourceInsightId: "insight-tenant-a:template:process-template-integrations-tenant-a:schedule_delay",
    sourceTrendId: "tenant-a:template:process-template-integrations-tenant-a:schedule_delay",
    sourceSnapshotIds: ["snapshot-project-alpha-1"],
    sourceMetricIds: ["snapshot-project-alpha-1:schedule_days"],
    improvementKey: "add_acceptance_checkpoint",
    reason: "Повторяющаяся задержка приемки",
    mutatesState: false,
    stateVersion: 3,
    template: {
      id: "process-template-integrations-tenant-a",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      currentVersion: 2,
      nextVersion: 3
    },
    before: { templateVersion: 2 },
    after: {
      templateVersion: 3,
      addedChecklistItemKey: "add_acceptance_checkpoint",
      recommendedLabel: "Ранняя приемка результата"
    },
    createdAt: "2026-07-15T00:05:00.000Z"
  };
}

function templateImprovementResult(): TemplateImprovementApplyResultDto {
  return {
    preview: templateImprovementPreview(),
    insight: { ...trendsModel().insights[0]!, status: "handled", handledBy: "tenant-admin-a", handledAt: "2026-07-15T00:06:00.000Z" },
    template: {
      id: "process-template-integrations-tenant-a",
      tenantId: "tenant-a",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      active: true,
      previousVersion: 2,
      version: 3,
      improvementSourceInsightId: "insight-tenant-a:template:process-template-integrations-tenant-a:schedule_delay",
      improvementSourceSnapshotIds: ["snapshot-project-alpha-1"],
      improvementKey: "add_acceptance_checkpoint",
      improvedAt: "2026-07-15T00:06:00.000Z"
    },
    actionExecution: {
      id: "action-template-improvement-insight-1",
      commandType: "template_improvement.apply",
      auditEventIds: ["audit-template-improvement-insight-1"]
    }
  };
}

function apiClient(portfolio = portfolioModel(), trends = trendsModel(), insight = insightModel()): RetrospectiveApiClient {
  return {
    getClosedPortfolio: vi.fn(async () => portfolio),
    getTrends: vi.fn(async () => trends),
    getInsight: vi.fn(async () => insight),
    previewTemplateImprovement: vi.fn(async () => ({ preview: templateImprovementPreview() })),
    applyTemplateImprovement: vi.fn(async () => ({ result: templateImprovementResult() }))
  };
}

function renderSurface(client = apiClient(), tenant = currentTenant()) {
  render(
    withTestQueryClient(
      <ClosedPortfolioRetrospectiveSurface apiClient={client} currentTenant={tenant} testUser="tenant-admin-a" />
    )
  );
}

describe("ClosedPortfolioRetrospectiveSurface", () => {
  it("renders an R2 snapshot grid with immutable proof and current-vs-previous summary", async () => {
    renderSurface(apiClient());

    expect(await screen.findByTestId("kpi-strip")).toHaveTextContent("Снимки");
    await waitFor(() => expect(screen.getByTestId("kpi-strip")).toHaveTextContent("1"));
    await waitFor(() => expect(screen.getByTestId("kpi-strip")).toHaveTextContent("Критичные тренды"));

    const grid = await screen.findByTestId("operational-data-grid");
    expect(grid).toHaveTextContent("snapshot-project-alpha-1");
    expect(grid).toHaveTextContent("План/факт: 20 -> 26 ч");
    expect(grid).toHaveTextContent("Текущий/предыдущий: 15 -> no_previous");
    expect(grid).toHaveTextContent("API: snapshot, plan/fact, schedule variance, source refs");
    expect(grid).toHaveTextContent("Снимок immutable");

    const proof = await screen.findByTestId("retrospective-snapshot-proof");
    expect(proof).toHaveTextContent("ProjectSnapshot:snapshot-project-alpha-1");
    expect(proof).toHaveTextContent("Snapshot version: not supplied by closed-portfolio read model");
    expect(proof).toHaveTextContent("Closure audit: not supplied by closed-portfolio read model");
    expect(proof).toHaveTextContent("Readback proves closed metrics are not live project state");
  });

  it("summarizes the highest trend severity across the full trends readback", async () => {
    const base = trendsModel();
    const warningTrend = { ...base.trends[0]!, id: "trend-warning-first", severity: "warning" as const };
    const criticalTrend = { ...base.trends[0]!, id: "trend-critical-second", severity: "critical" as const };
    const warningInsight = {
      ...base.insights[0]!,
      id: "insight-warning-first",
      sourceTrendId: warningTrend.id,
      severity: "warning" as const
    };
    const criticalInsight = {
      ...base.insights[0]!,
      id: "insight-critical-second",
      sourceTrendId: criticalTrend.id,
      severity: "critical" as const,
      title: "Critical retrospective insight"
    };
    const client = apiClient(portfolioModel(), {
      trends: [warningTrend, criticalTrend],
      insights: [warningInsight, criticalInsight],
      pagination: { offset: 0, limit: 25, total: 2 }
    });
    renderSurface(client);

    await waitFor(() => expect(screen.getByTestId("signal-summary-bar")).toHaveTextContent("Критично"));
    fireEvent.click(screen.getByRole("button", { name: "Открыть следующий trend" }));

    await waitFor(() => expect(client.getInsight).toHaveBeenCalledWith("tenant-admin-a", "insight-critical-second"));
  });

  it("requests later trend pages before summarizing the highest retrospective severity", async () => {
    const base = trendsModel();
    const warningTrend = { ...base.trends[0]!, id: "trend-warning-page-1", severity: "warning" as const };
    const criticalTrend = { ...base.trends[0]!, id: "trend-critical-page-2", severity: "critical" as const };
    const warningInsight = {
      ...base.insights[0]!,
      id: "insight-warning-page-1",
      sourceTrendId: warningTrend.id,
      severity: "warning" as const
    };
    const criticalInsight = {
      ...base.insights[0]!,
      id: "insight-critical-page-2",
      sourceTrendId: criticalTrend.id,
      severity: "critical" as const,
      title: "Critical paged retrospective insight"
    };
    const client = apiClient(portfolioModel(), trendsModel(), insightModel());
    vi.mocked(client.getTrends)
      .mockResolvedValueOnce({
        trends: [warningTrend],
        insights: [warningInsight],
        pagination: { offset: 0, limit: 1, total: 2 }
      })
      .mockResolvedValueOnce({
        trends: [criticalTrend],
        insights: [criticalInsight],
        pagination: { offset: 1, limit: 1, total: 2 }
      });
    renderSurface(client);

    await waitFor(() => expect(screen.getByTestId("signal-summary-bar")).toHaveTextContent("Критично"));
    expect(client.getTrends).toHaveBeenCalledWith("tenant-admin-a", { limit: 50, offset: 0 });
    expect(client.getTrends).toHaveBeenCalledWith("tenant-admin-a", { limit: 50, offset: 1 });
  });

  it("renders an R2 template-improvement action contract from trend to preview and immutable readback", async () => {
    renderSurface(apiClient());

    fireEvent.click(await screen.findByRole("button", { name: /Открыть insight/i }));

    const contract = await screen.findByTestId("retrospective-improvement-contract");
    expect(contract).toHaveTextContent("Trend: tenant-a:template:process-template-integrations-tenant-a:schedule_delay");
    expect(contract).toHaveTextContent("Source snapshots: snapshot-project-alpha-1");
    expect(contract).toHaveTextContent("Recommended action: template_improvement.apply");
    expect(contract).toHaveTextContent("Dry-run preview required");
    expect(contract).toHaveTextContent("No snapshot rewrite");

    fireEvent.click(screen.getByRole("button", { name: /Предпросмотр улучшения/i }));
    const previewPanel = await screen.findByTestId("template-improvement-preview");
    expect(previewPanel).toHaveTextContent("mutatesState=false");
    expect(previewPanel).toHaveTextContent("source snapshot immutable: snapshot-project-alpha-1");

    fireEvent.click(screen.getByRole("button", { name: /Применить улучшение/i }));
    const audit = await screen.findByTestId("action-audit-preview");
    expect(audit).toHaveTextContent("ActionExecution: action-template-improvement-insight-1");
    expect(audit).toHaveTextContent("AuditEvent: audit-template-improvement-insight-1");
    expect(audit).toHaveTextContent("future template v3");
    expect(audit).toHaveTextContent("snapshot readback unchanged");
  });

  it("loads closed portfolio rows, trend signal, snapshot metrics, and insight source trace", async () => {
    const client = apiClient();
    renderSurface(client);

    const surface = await screen.findByTestId("closed-portfolio-surface");
    expect(surface).toHaveTextContent("Закрытый портфель");
    await waitFor(() => expect(screen.getByTestId("closed-portfolio-summary")).toHaveTextContent("Снимки: 1"));
    expect(screen.getByTestId("closed-portfolio-summary")).toHaveTextContent("Тренды: 1");
    expect(screen.getByTestId("closed-portfolio-row-list")).toHaveTextContent("CRM внедрение");
    expect(screen.getByTestId("closed-portfolio-row-list")).toHaveTextContent("15 дн.");
    expect(screen.getByTestId("retrospective-trend-list")).toHaveTextContent("schedule_delay");
    expect(screen.getByTestId("retrospective-trend-list")).toHaveTextContent("snapshot-project-alpha-1:schedule_days");

    fireEvent.click(screen.getByRole("button", { name: /Открыть insight/i }));

    const insight = await screen.findByTestId("retrospective-insight-panel");
    expect(insight).toHaveTextContent("Поздний старт приемки");
    expect(insight).toHaveTextContent("snapshot-project-alpha-1:lesson-a");
    expect(insight).toHaveTextContent("Улучшить шаблон");
    expect(client.getInsight).toHaveBeenCalledWith("tenant-admin-a", "insight-tenant-a:template:process-template-integrations-tenant-a:schedule_delay");
  });

  it("renders loading, empty, denied, and API error states", async () => {
    const emptyClient = apiClient(portfolioModel([]), { ...trendsModel(), trends: [], insights: [], pagination: { offset: 0, limit: 25, total: 0 } });
    renderSurface(emptyClient);
    expect(await screen.findByTestId("closed-portfolio-empty")).toHaveTextContent("Закрытых снимков пока нет");

    const deniedClient = apiClient();
    renderSurface(deniedClient, currentTenant(["tenant.read"]));
    expect(await screen.findByTestId("closed-portfolio-denied")).toHaveTextContent("Нет доступа");
    expect(deniedClient.getClosedPortfolio).not.toHaveBeenCalled();

    const errorClient = apiClient();
    vi.mocked(errorClient.getClosedPortfolio).mockRejectedValueOnce(new Error("Retrospective API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("closed-portfolio-error")).toHaveTextContent("Retrospective API недоступен");
  });

  it("keeps read-only users on API readback and disables improvement entry without mutation calls", async () => {
    const readOnlyRows = defaultRows().map((row) => ({
      ...row,
      actions: row.actions.map((action) => ({ ...action, available: false, unavailableReason: "permission_denied" as const }))
    }));
    const readOnlyInsight = {
      ...insightModel(),
      allowedActions: insightModel().allowedActions.map((action) => ({
        ...action,
        available: false,
        unavailableReason: "permission_denied" as const
      }))
    };
    const client = apiClient(portfolioModel(readOnlyRows), trendsModel(), readOnlyInsight);
    renderSurface(client, currentTenant(["tenant.read", "retrospective.read"]));

    await screen.findByTestId("closed-portfolio-row-list");
    expect(screen.getByTestId("closed-portfolio-row-action-state")).toHaveTextContent("нет права");
    fireEvent.click(screen.getByRole("button", { name: /Открыть insight/i }));
    expect(await screen.findByTestId("retrospective-insight-panel")).toHaveTextContent("нет права");
    expect(screen.queryByRole("button", { name: /Предпросмотр улучшения/i })).not.toBeInTheDocument();
    expect(client.previewTemplateImprovement).not.toHaveBeenCalled();
    expect(client.applyTemplateImprovement).not.toHaveBeenCalled();
  });

  it("refetches closed portfolio and trends through API readback instead of mutating local rows", async () => {
    const first = portfolioModel();
    const second = portfolioModel([
      ...defaultRows(),
      {
        ...defaultRows()[0]!,
        id: "closed-portfolio-row-snapshot-project-beta-1",
        entityId: "snapshot-project-beta-1",
        label: "ERP стабилизация",
        fieldValues: { ...defaultRows()[0]!.fieldValues, snapshot_id: "snapshot-project-beta-1", project_title: "ERP стабилизация" }
      }
    ]);
    const client = apiClient(first, trendsModel(), insightModel());
    vi.mocked(client.getClosedPortfolio).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    renderSurface(client);

    expect(await screen.findByTestId("closed-portfolio-row-list")).toHaveTextContent("CRM внедрение");
    expect(screen.getByTestId("closed-portfolio-row-list")).not.toHaveTextContent("ERP стабилизация");
    fireEvent.click(screen.getByRole("button", { name: "Обновить readback" }));

    await waitFor(() => expect(client.getClosedPortfolio).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("closed-portfolio-row-list")).toHaveTextContent("ERP стабилизация");
  });

  it("previews template improvement before apply and refreshes insight readback with audit evidence", async () => {
    const handledInsight = {
      ...insightModel(),
      insight: { ...insightModel().insight, status: "handled" as const, handledBy: "tenant-admin-a", handledAt: "2026-07-15T00:06:00.000Z" }
    };
    const client = apiClient();
    vi.mocked(client.getInsight).mockResolvedValueOnce(insightModel()).mockResolvedValueOnce(handledInsight);
    renderSurface(client);

    fireEvent.click(await screen.findByRole("button", { name: /Открыть insight/i }));
    expect(await screen.findByTestId("retrospective-insight-panel")).toHaveTextContent("Улучшить шаблон");

    fireEvent.click(screen.getByRole("button", { name: /Предпросмотр улучшения/i }));
    const previewPanel = await screen.findByTestId("template-improvement-preview");
    expect(previewPanel).toHaveTextContent("Без мутации");
    expect(previewPanel).toHaveTextContent("Версия 2 -> 3");
    expect(client.applyTemplateImprovement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Применить улучшение/i }));

    const resultPanel = await screen.findByTestId("template-improvement-result");
    expect(resultPanel).toHaveTextContent("template_improvement.apply");
    expect(resultPanel).toHaveTextContent("audit-template-improvement-insight-1");
    await waitFor(() => expect(client.getInsight).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("retrospective-insight-panel")).toHaveTextContent("handled");
  });

  it("shows stale preview errors and allows retrying preview", async () => {
    const client = apiClient();
    vi.mocked(client.applyTemplateImprovement).mockRejectedValueOnce(new Error("Предпросмотр устарел"));
    renderSurface(client);

    fireEvent.click(await screen.findByRole("button", { name: /Открыть insight/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Предпросмотр улучшения/i }));
    await screen.findByTestId("template-improvement-preview");
    fireEvent.click(screen.getByRole("button", { name: /Применить улучшение/i }));

    expect(await screen.findByTestId("template-improvement-error")).toHaveTextContent("Предпросмотр устарел");

    fireEvent.click(screen.getByRole("button", { name: /Повторить предпросмотр/i }));
    await waitFor(() => expect(client.previewTemplateImprovement).toHaveBeenCalledTimes(2));
  });
});
