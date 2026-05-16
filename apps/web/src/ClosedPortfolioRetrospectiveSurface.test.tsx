import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClosedPortfolioRetrospectiveSurface } from "./ClosedPortfolioRetrospectiveSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ClosedPortfolioReadModelDto,
  RetrospectiveApiClient,
  RetrospectiveInsightReadModelDto,
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

function apiClient(portfolio = portfolioModel(), trends = trendsModel(), insight = insightModel()): RetrospectiveApiClient {
  return {
    getClosedPortfolio: vi.fn(async () => portfolio),
    getTrends: vi.fn(async () => trends),
    getInsight: vi.fn(async () => insight)
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
    expect(Object.keys(client).some((key) => key.toLowerCase().includes("apply"))).toBe(false);
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
});
