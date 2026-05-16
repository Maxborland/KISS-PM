import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  retrospectiveSeverityLabel,
  retrospectiveTrendLabel,
  type ClosedPortfolioReadModelDto,
  type RetrospectiveApiClient,
  type RetrospectiveInsightDto,
  type RetrospectiveReadActionDto,
  type RetrospectiveReadRowDto,
  type RetrospectiveTrendDto
} from "./retrospectiveApiClient";

type ClosedPortfolioRetrospectiveSurfaceProps = {
  apiClient: RetrospectiveApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

const retrospectiveQueryKeys = {
  portfolio: (testUser: string) => ["retrospectives", testUser, "closed-portfolio"] as const,
  trends: (testUser: string) => ["retrospectives", testUser, "trends"] as const,
  insight: (testUser: string, insightId: string | null) => ["retrospectives", testUser, "insight", insightId] as const
};

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

function actionLine(action: RetrospectiveReadActionDto): string {
  if (action.available) return `${action.label}${action.dryRunRequired ? " / preview required" : ""}`;
  return `${action.label}: ${action.unavailableReason === "permission_denied" ? "нет права" : "не рекомендовано"}`;
}

function numberField(row: RetrospectiveReadRowDto, key: string): number | null {
  const value = row.fieldValues[key];
  return typeof value === "number" ? value : null;
}

function stringField(row: RetrospectiveReadRowDto, key: string): string {
  const value = row.fieldValues[key];
  return typeof value === "string" ? value : "";
}

function RowList({
  activeRowId,
  onSelectRow,
  rows
}: {
  activeRowId: string | null;
  rows: RetrospectiveReadRowDto[];
  onSelectRow(rowId: string): void;
}) {
  if (rows.length === 0) {
    return (
      <div className="compact-list" data-testid="closed-portfolio-empty">
        Закрытых снимков пока нет. После закрытия проектов здесь появятся стабильные plan/fact результаты.
      </div>
    );
  }

  return (
    <div className="compact-list closed-portfolio-row-list" data-testid="closed-portfolio-row-list">
      {rows.map((row) => {
        const scheduleVariance = numberField(row, "schedule_variance_days");

        return (
          <button
            className={`kpi-signal-card closed-portfolio-row ${row.id === activeRowId ? "active" : ""}`}
            key={row.id}
            onClick={() => onSelectRow(row.id)}
            type="button"
          >
            <strong>{retrospectiveSeverityLabel(row.severity)}</strong>
            <span>{stringField(row, "project_title") || row.label}</span>
            <span>{row.explanation}</span>
            <span>{scheduleVariance === null ? "нет отклонения" : `${scheduleVariance} дн.`}</span>
          </button>
        );
      })}
    </div>
  );
}

function SnapshotDetail({ row }: { row: RetrospectiveReadRowDto }) {
  return (
    <section className="phase2-panel retrospective-detail-panel" data-testid="closed-portfolio-detail">
      <div className="surface-heading compact">
        <div>
          <h3>Снимок закрытого проекта</h3>
          <p>{stringField(row, "snapshot_id") || row.entityId}</p>
        </div>
        <span className={`signal-severity-badge severity-${row.severity === "attention" ? "watch" : row.severity}`}>
          {retrospectiveSeverityLabel(row.severity)}
        </span>
      </div>
      <dl className="compact-facts">
        <div>
          <dt>Проект</dt>
          <dd>{stringField(row, "project_title") || row.label}</dd>
        </div>
        <div>
          <dt>Закрыт</dt>
          <dd>{stringField(row, "closed_at")}</dd>
        </div>
        <div>
          <dt>План</dt>
          <dd>{numberField(row, "planned_work_hours") ?? 0} ч</dd>
        </div>
        <div>
          <dt>Факт</dt>
          <dd>{numberField(row, "actual_work_hours") ?? 0} ч</dd>
        </div>
      </dl>
      <p>{row.sourceRefs.map((sourceRef) => `${sourceRef.entityType}:${sourceRef.entityId}`).join(" / ")}</p>
    </section>
  );
}

function TrendList({
  insights,
  onOpenInsight,
  trends
}: {
  trends: RetrospectiveTrendDto[];
  insights: RetrospectiveInsightDto[];
  onOpenInsight(insightId: string): void;
}) {
  if (trends.length === 0) {
    return (
      <div className="compact-list" data-testid="retrospective-trend-empty">
        Повторяющихся ретроспективных трендов пока нет.
      </div>
    );
  }

  return (
    <div className="compact-list retrospective-trend-list" data-testid="retrospective-trend-list">
      {trends.map((trend) => {
        const insight = insights.find((candidate) => candidate.sourceTrendId === trend.id);

        return (
          <article className={`retrospective-trend-card severity-${trend.severity}`} key={trend.id}>
            <div>
              <strong>{retrospectiveTrendLabel(trend.trendKey)}</strong>
              <span>{trend.trendKey}</span>
            </div>
            <p>
              {trend.groupBy}: {trend.groupKey} / {trend.occurrenceCount} снимка / среднее отклонение{" "}
              {trend.averageVarianceValue}
            </p>
            <p>{trend.sourceMetricIds.join(", ")}</p>
            {insight ? (
              <button className="secondary-button" type="button" onClick={() => onOpenInsight(insight.id)}>
                Открыть insight
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function InsightPanel({
  actions,
  insight
}: {
  insight: RetrospectiveInsightDto;
  actions: RetrospectiveReadActionDto[];
}) {
  return (
    <section className="phase2-panel retrospective-insight-panel" data-testid="retrospective-insight-panel">
      <div className="surface-heading compact">
        <div>
          <h3>Ретроспективный insight</h3>
          <p>{insight.id}</p>
        </div>
        <span className={`signal-severity-badge severity-${insight.severity === "attention" ? "watch" : insight.severity}`}>
          {retrospectiveSeverityLabel(insight.severity)}
        </span>
      </div>
      <p>{insight.title}</p>
      <p>{insight.recommendation}</p>
      <div className="compact-list">
        {insight.sourceLessons.map((lesson) => (
          <span key={lesson.id}>
            {lesson.id}: {lesson.summary}
          </span>
        ))}
      </div>
      <div className="compact-list" data-testid="closed-portfolio-action-state">
        {actions.map((action) => (
          <span key={action.key}>{actionLine(action)}</span>
        ))}
      </div>
    </section>
  );
}

export function ClosedPortfolioRetrospectiveSurface({
  apiClient,
  currentTenant,
  testUser
}: ClosedPortfolioRetrospectiveSurfaceProps) {
  const queryClient = useQueryClient();
  const canReadRetrospectives = hasPermission(currentTenant, "retrospective.read");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const portfolioQuery = useQuery<ClosedPortfolioReadModelDto>({
    queryKey: retrospectiveQueryKeys.portfolio(testUser),
    queryFn: () => apiClient.getClosedPortfolio(testUser),
    enabled: canReadRetrospectives,
    retry: false
  });
  const trendsQuery = useQuery({
    queryKey: retrospectiveQueryKeys.trends(testUser),
    queryFn: () => apiClient.getTrends(testUser),
    enabled: canReadRetrospectives,
    retry: false
  });
  const insightQuery = useQuery({
    queryKey: retrospectiveQueryKeys.insight(testUser, selectedInsightId),
    queryFn: () => apiClient.getInsight(testUser, selectedInsightId as string),
    enabled: canReadRetrospectives && selectedInsightId !== null,
    retry: false
  });

  if (!canReadRetrospectives) {
    return (
      <section className="closed-portfolio-surface" data-testid="closed-portfolio-denied" id="closed-portfolio-retrospectives">
        <div className="surface-heading">
          <div>
            <h2>Закрытый портфель</h2>
            <p>Нет доступа к ретроспективам. Закрытые снимки скрыты политикой доступа.</p>
          </div>
          <p className="status-pill">Нет доступа</p>
        </div>
      </section>
    );
  }

  const portfolio = portfolioQuery.data;
  const trends = trendsQuery.data;
  const rows = portfolio?.rows ?? [];
  const activeRow = rows.find((row) => row.id === (selectedRowId ?? rows[0]?.id)) ?? null;
  const activeRowActions = activeRow?.actions ?? [];
  const status =
    portfolioQuery.isFetching && portfolio === undefined
      ? "Загрузка закрытого портфеля"
      : "Readback закрытого портфеля получен";

  async function refreshReadback() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: retrospectiveQueryKeys.portfolio(testUser) }),
      queryClient.invalidateQueries({ queryKey: retrospectiveQueryKeys.trends(testUser) })
    ]);
  }

  function selectRow(rowId: string) {
    setSelectedRowId(rowId);
    setSelectedInsightId(null);
  }

  return (
    <section className="closed-portfolio-surface" data-testid="closed-portfolio-surface" id="closed-portfolio-retrospectives">
      <div className="surface-heading">
        <div>
          <h2>Закрытый портфель</h2>
          <p>Стабильные снимки, повторяющиеся отклонения и вход в улучшение будущих шаблонов.</p>
        </div>
        <p className="status-pill" data-testid="closed-portfolio-status">
          {status}
        </p>
      </div>

      {portfolioQuery.isLoading ? (
        <p className="phase2-panel" data-testid="closed-portfolio-loading">
          Загрузка закрытого портфеля
        </p>
      ) : null}

      {portfolioQuery.isError ? (
        <p className="readonly-notice" data-testid="closed-portfolio-error">
          {getErrorMessage(portfolioQuery.error)}
        </p>
      ) : null}

      <div className="surface-heading compact">
        <p className="status-pill" data-testid="closed-portfolio-summary">
          Снимки: {portfolio?.summary.totalSnapshots ?? 0} / Тренды: {portfolio?.summary.trendSignalCount ?? 0} /
          Insights: {portfolio?.summary.openInsightCount ?? 0}
        </p>
        <button className="secondary-button" type="button" onClick={() => void refreshReadback()}>
          Обновить readback
        </button>
      </div>

      <div className="closed-portfolio-layout">
        <section className="phase2-panel">
          <h3>{portfolio?.surface.label ?? "Закрытый портфель"}</h3>
          <div className="portfolio-widget-grid">
            {(portfolio?.widgets ?? []).map((widget) => (
              <div className="portfolio-widget" data-testid={`closed-portfolio-widget-${widget.key}`} key={widget.key}>
                <span>{widget.label}</span>
                <strong>{widget.value}</strong>
              </div>
            ))}
          </div>
          <RowList activeRowId={activeRow?.id ?? null} onSelectRow={selectRow} rows={rows} />
        </section>

        <section className="phase2-panel">
          <h3>Тренды и управляющий вход</h3>
          {trendsQuery.isError ? (
            <p className="readonly-notice" data-testid="retrospective-trends-error">
              {getErrorMessage(trendsQuery.error)}
            </p>
          ) : null}
          <TrendList
            insights={trends?.insights ?? []}
            onOpenInsight={setSelectedInsightId}
            trends={trends?.trends ?? []}
          />
        </section>
      </div>

      {activeRow ? (
        <>
          <SnapshotDetail row={activeRow} />
          <div className="compact-list" data-testid="closed-portfolio-row-action-state">
            {activeRowActions.map((action) => (
              <span key={action.key}>{actionLine(action)}</span>
            ))}
          </div>
        </>
      ) : null}

      {insightQuery.isError ? (
        <p className="readonly-notice" data-testid="retrospective-insight-error">
          {getErrorMessage(insightQuery.error)}
        </p>
      ) : null}

      {insightQuery.data ? (
        <InsightPanel actions={insightQuery.data.allowedActions} insight={insightQuery.data.insight} />
      ) : null}
    </section>
  );
}
