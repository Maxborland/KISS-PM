import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ActionAuditPreview,
  KPIStrip,
  OperationalDataGrid,
  SignalSummaryBar,
  type KpiMetric,
  type OperationalGridColumn,
  type OperationalGridRow,
  type OperationalSeverity
} from "./operationalSurfacePrimitives";
import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  retrospectiveSeverityLabel,
  retrospectiveTrendLabel,
  type ClosedPortfolioReadModelDto,
  type RetrospectiveApiClient,
  type RetrospectiveInsightDto,
  type TemplateImprovementApplyResultDto,
  type TemplateImprovementPreviewDto,
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

function operationalSeverity(severity: RetrospectiveReadRowDto["severity"] | RetrospectiveInsightDto["severity"] | RetrospectiveTrendDto["severity"]): OperationalSeverity {
  if (severity === "critical" || severity === "warning" || severity === "attention") return severity;
  return "ok";
}

function sourceRefsLine(row: RetrospectiveReadRowDto): string {
  return row.sourceRefs.map((sourceRef) => `${sourceRef.entityType}:${sourceRef.entityId}`).join(" / ");
}

const snapshotGridColumns: OperationalGridColumn[] = [
  { key: "snapshot", label: "Snapshot", group: "Снимок", sticky: "left", width: 210 },
  { key: "project", label: "Проект", group: "Снимок", width: 180 },
  { key: "planFact", label: "План/факт", group: "Метрики", width: 190 },
  { key: "variance", label: "Текущий / предыдущий", group: "Метрики", width: 240 },
  { key: "quality", label: "Качество", group: "Метрики", width: 160 },
  { key: "versions", label: "Версии", group: "Readback", width: 170 },
  { key: "proof", label: "Proof", group: "Readback", width: 190 }
];

function SnapshotOperationalGrid({
  activeRowId,
  onSelectRow,
  rows
}: {
  activeRowId: string | null;
  onSelectRow(rowId: string): void;
  rows: RetrospectiveReadRowDto[];
}) {
  const gridRows: OperationalGridRow[] = rows.map((row) => {
    const planned = numberField(row, "planned_work_hours") ?? 0;
    const actual = numberField(row, "actual_work_hours") ?? 0;
    const currentVariance = numberField(row, "schedule_variance_days");
    const previousVariance = numberField(row, "previous_schedule_variance_days");
    const quality = numberField(row, "quality_score");
    const csi = numberField(row, "csi_score");
    const templateVersion = numberField(row, "template_version");
    const kpiVersion = numberField(row, "kpi_version");

    return {
      id: row.id,
      label: row.label,
      severity: operationalSeverity(row.severity),
      values: {
        snapshot: stringField(row, "snapshot_id") || row.entityId,
        project: stringField(row, "project_title") || row.label,
        planFact: `План/факт: ${planned} -> ${actual} ч`,
        variance:
          currentVariance === null
            ? "нет отклонения"
            : previousVariance === null
              ? `Текущий/предыдущий: ${currentVariance} -> no_previous`
              : `Текущий/предыдущий: ${currentVariance} -> ${previousVariance} дн.`,
        quality: `${quality === null ? "Quality: no_previous" : `Quality: ${quality}`} / ${
          csi === null ? "CSI: no_previous" : `CSI: ${csi}`
        }`,
        versions: `${templateVersion === null ? "template v?" : `template v${templateVersion}`} / ${
          kpiVersion === null ? "KPI v?" : `KPI v${kpiVersion}`
        }`,
        proof: "Снимок immutable"
      },
      actions: []
    };
  });

  return (
    <OperationalDataGrid
      columns={snapshotGridColumns}
      emptyLabel="Закрытых снимков пока нет. После закрытия проектов здесь появятся стабильные plan/fact результаты."
      rows={gridRows}
      selectedRowId={activeRowId}
      onSelectRow={onSelectRow}
    />
  );
}

function RetrospectiveSummaryStrip({ portfolio }: { portfolio: ClosedPortfolioReadModelDto | undefined }) {
  const criticalTrendCount =
    portfolio?.widgets.find((widget) => widget.key === "critical_trend_count")?.value ?? 0;
  const attentionTrendCount =
    portfolio?.widgets.find((widget) => widget.key === "attention_trend_count")?.value ?? 0;
  const metrics: KpiMetric[] = [
    {
      id: "retrospective-snapshot-count",
      label: "Снимки",
      value: portfolio?.summary.totalSnapshots ?? 0,
      severity: "ok",
      sourceLabel: "ProjectSnapshot",
      helpText: "Immutable closed project snapshot count"
    },
    {
      id: "retrospective-critical-trends",
      label: "Критичные тренды",
      value: criticalTrendCount,
      severity: criticalTrendCount > 0 ? "critical" : "ok",
      requiresAction: criticalTrendCount > 0,
      deltaLabel: `attention: ${attentionTrendCount}`
    },
    {
      id: "retrospective-open-insights",
      label: "Open insights",
      value: portfolio?.summary.openInsightCount ?? 0,
      severity: (portfolio?.summary.openInsightCount ?? 0) > 0 ? "attention" : "ok",
      sourceLabel: "template-improvement"
    }
  ];

  return <KPIStrip metrics={metrics} />;
}

function SnapshotProof({ row }: { row: RetrospectiveReadRowDto }) {
  const snapshotId = stringField(row, "snapshot_id") || row.entityId;
  const snapshotVersion = numberField(row, "snapshot_version");
  const closureAuditEventId = stringField(row, "closure_audit_event_id");

  return (
    <section className="phase2-panel retrospective-snapshot-proof" data-testid="retrospective-snapshot-proof">
      <h3>Snapshot readback proof</h3>
      <div className="compact-list">
        <span>ProjectSnapshot:{snapshotId}</span>
        <span>Snapshot version: {snapshotVersion ?? "stable"}</span>
        <span>Closure audit: {closureAuditEventId || "closure audit unavailable"}</span>
        <span>Source refs: {sourceRefsLine(row)}</span>
        <span>Readback proves closed metrics are not live project state</span>
      </div>
    </section>
  );
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
  applyPending,
  applyResult,
  errorMessage,
  insight,
  onApply,
  onPreview,
  preview,
  previewPending
}: {
  insight: RetrospectiveInsightDto;
  actions: RetrospectiveReadActionDto[];
  preview: TemplateImprovementPreviewDto | null;
  applyResult: TemplateImprovementApplyResultDto | null;
  errorMessage: string | null;
  previewPending: boolean;
  applyPending: boolean;
  onPreview(): void;
  onApply(): void;
}) {
  const improvementAction = actions.find((action) => action.actionDefinitionKey === "template_improvement.apply");
  const canApplyImprovement = improvementAction?.available === true;

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
      <p>Статус: {insight.status}</p>
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
      <section className="compact-list retrospective-improvement-contract" data-testid="retrospective-improvement-contract">
        <strong>Template-improvement contract</strong>
        <span>Trend: {insight.sourceTrendId}</span>
        <span>Source snapshots: {insight.sourceSnapshotIds.join(", ")}</span>
        <span>Source metrics: {insight.sourceMetricIds.join(", ")}</span>
        <span>Recommended action: {improvementAction?.actionDefinitionKey ?? "template_improvement.apply"}</span>
        <span>{improvementAction?.dryRunRequired !== false ? "Dry-run preview required" : "Preview optional"}</span>
        <span>No snapshot rewrite</span>
      </section>
      {canApplyImprovement ? (
        <div className="compact-action-row">
          <button className="secondary-button" disabled={previewPending} type="button" onClick={onPreview}>
            {preview === null ? "Предпросмотр улучшения" : "Повторить предпросмотр"}
          </button>
          <button className="primary-button" disabled={preview === null || applyPending} type="button" onClick={onApply}>
            Применить улучшение
          </button>
        </div>
      ) : null}
      {preview ? (
        <div className="compact-list template-improvement-preview" data-testid="template-improvement-preview">
          <strong>Без мутации</strong>
          <span>{preview.template.label}</span>
          <span>
            Версия {preview.before.templateVersion} -&gt; {preview.after.templateVersion}
          </span>
          <span>{preview.after.recommendedLabel}</span>
          <span>mutatesState={String(preview.mutatesState)}</span>
          <span>source snapshot immutable: {preview.sourceSnapshotIds.join(", ")}</span>
          <span>{preview.sourceSnapshotIds.join(", ")}</span>
        </div>
      ) : null}
      {applyResult ? (
        <>
          <div className="compact-list template-improvement-result" data-testid="template-improvement-result">
            <strong>{applyResult.actionExecution.commandType}</strong>
            <span>
              Версия {applyResult.template.previousVersion} -&gt; {applyResult.template.version}
            </span>
            <span>{applyResult.actionExecution.auditEventIds?.join(", ")}</span>
          </div>
          <ActionAuditPreview
            actionExecutionId={applyResult.actionExecution.id}
            auditEventId={applyResult.actionExecution.auditEventIds?.[0]}
            readbackLabel={`future template v${applyResult.template.version}; snapshot readback unchanged`}
            resultLabel={applyResult.actionExecution.commandType}
            targetLabel={`template:${applyResult.template.id}`}
          />
        </>
      ) : null}
      {errorMessage ? (
        <p className="readonly-notice" data-testid="template-improvement-error">
          {errorMessage}
        </p>
      ) : null}
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
  const [templatePreview, setTemplatePreview] = useState<TemplateImprovementPreviewDto | null>(null);
  const [templateApplyResult, setTemplateApplyResult] = useState<TemplateImprovementApplyResultDto | null>(null);
  const [templateActionError, setTemplateActionError] = useState<string | null>(null);
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
  const previewMutation = useMutation({
    mutationFn: (insightId: string) =>
      apiClient.previewTemplateImprovement(testUser, insightId, {
        improvementKey: "add_acceptance_checkpoint",
        reason: "Повторяющаяся задержка из ретроспективного insight"
      }),
    onSuccess(data) {
      setTemplatePreview(data.preview);
      setTemplateApplyResult(null);
      setTemplateActionError(null);
    },
    onError(error) {
      setTemplateActionError(getErrorMessage(error));
    }
  });
  const applyMutation = useMutation({
    mutationFn: (input: { insightId: string; previewId?: string }) =>
      apiClient.applyTemplateImprovement(testUser, input.insightId, { previewId: input.previewId }),
    async onSuccess(data) {
      setTemplateApplyResult(data.result);
      setTemplateActionError(null);
      await refreshReadback();
      if (selectedInsightId !== null) {
        await queryClient.invalidateQueries({ queryKey: retrospectiveQueryKeys.insight(testUser, selectedInsightId) });
      }
    },
    onError(error) {
      setTemplateActionError(getErrorMessage(error));
    }
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
    setTemplatePreview(null);
    setTemplateApplyResult(null);
    setTemplateActionError(null);
  }

  function selectInsight(insightId: string) {
    setSelectedInsightId(insightId);
    setTemplatePreview(null);
    setTemplateApplyResult(null);
    setTemplateActionError(null);
  }

  function previewTemplateImprovementAction() {
    if (selectedInsightId === null) return;
    previewMutation.mutate(selectedInsightId);
  }

  function applyTemplateImprovementAction() {
    if (selectedInsightId === null) return;
    applyMutation.mutate({ insightId: selectedInsightId, previewId: templatePreview?.id });
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

      <SignalSummaryBar
        disabledReason={(trends?.insights.length ?? 0) === 0 ? "Нет открытых ретроспективных insight" : undefined}
        highestSeverity={operationalSeverity(trends?.trends[0]?.severity ?? "none")}
        nextActionLabel="Открыть следующий trend"
        onNextAction={() => {
          const nextInsight = trends?.insights.find((insight) => insight.id !== selectedInsightId) ?? trends?.insights[0];
          if (nextInsight) selectInsight(nextInsight.id);
        }}
        requiresActionCount={trends?.insights.filter((insight) => insight.status === "open").length ?? 0}
        summary={`${trends?.trends.length ?? 0} retrospective трендов`}
      />

      <RetrospectiveSummaryStrip portfolio={portfolio} />

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
          <SnapshotOperationalGrid activeRowId={activeRow?.id ?? null} onSelectRow={selectRow} rows={rows} />
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
            onOpenInsight={selectInsight}
            trends={trends?.trends ?? []}
          />
        </section>
      </div>

      {activeRow ? (
        <>
          <SnapshotDetail row={activeRow} />
          <SnapshotProof row={activeRow} />
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
        <InsightPanel
          actions={insightQuery.data.allowedActions}
          applyPending={applyMutation.isPending}
          applyResult={templateApplyResult}
          errorMessage={templateActionError}
          insight={insightQuery.data.insight}
          onApply={applyTemplateImprovementAction}
          onPreview={previewTemplateImprovementAction}
          preview={templatePreview}
          previewPending={previewMutation.isPending}
        />
      ) : null}
    </section>
  );
}
