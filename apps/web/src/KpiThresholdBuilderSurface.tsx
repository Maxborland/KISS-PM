import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { kpiSeverityLabel, type KpiActionExecutionDto, type KpiThresholdRuleDto } from "./kpiDefinitionApiClient";
import type { KpiThresholdAuditDto, KpiThresholdBuilderApiClient, KpiThresholdPreviewDto } from "./kpiThresholdBuilderApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";

type KpiThresholdBuilderSurfaceProps = {
  apiClient: KpiThresholdBuilderApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "preview" | "publish" | "refresh" | null;

const queryKeys = {
  thresholds: (testUser: string) => ["kpi-threshold-builder", testUser, "thresholds"] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["kpi-threshold-builder", testUser, "audit", { canReadAudit }] as const
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

function actionExecutionLine(actionExecution: KpiActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function latestThresholdAction(audit: KpiThresholdAuditDto): KpiActionExecutionDto | null {
  return audit.actionExecutions.filter((entry) => entry.commandType === "kpi_threshold.publish").at(-1) ?? null;
}

function valueCondition(rule: KpiThresholdRuleDto, nextValue: number): KpiThresholdRuleDto {
  if (!("value" in rule.condition)) return rule;

  return {
    ...rule,
    condition: {
      ...rule.condition,
      value: nextValue
    }
  };
}

function PreviewPanel({ preview }: { preview: KpiThresholdPreviewDto }) {
  return (
    <section className="phase2-panel preview-panel" data-testid="kpi-threshold-preview">
      <h3>Предпросмотр влияния</h3>
      <p>Состояние еще не изменено. Новая версия порогов будет опубликована только после команды.</p>
      <dl className="compact-facts">
        <div>
          <dt>Версия до</dt>
          <dd>v{preview.before.version}</dd>
        </div>
        <div>
          <dt>Версия после</dt>
          <dd>v{preview.after.version}</dd>
        </div>
        <div>
          <dt>Сейчас</dt>
          <dd>{preview.before.severity}</dd>
        </div>
        <div>
          <dt>После</dt>
          <dd>{preview.after.severity}</dd>
        </div>
      </dl>
      <p>
        {kpiSeverityLabel(preview.before.severity)} {"->"} {kpiSeverityLabel(preview.after.severity)} / sample {preview.sampleValue}
      </p>
    </section>
  );
}

export function KpiThresholdBuilderSurface({ apiClient, currentTenant, testUser }: KpiThresholdBuilderSurfaceProps) {
  const canReadConfig = hasPermission(currentTenant, "tenant.config.read");
  const canReadKpi = hasPermission(currentTenant, "kpi:read");
  const canWriteConfig = hasPermission(currentTenant, "tenant.config.write");
  const canWriteKpi = hasPermission(currentTenant, "kpi.config:write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canPublish = canWriteConfig && canWriteKpi;
  const [criticalThreshold, setCriticalThreshold] = useState(-30);
  const [sampleValue, setSampleValue] = useState(-25);
  const [preview, setPreview] = useState<KpiThresholdPreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка KPI порогов");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastActionExecution, setLastActionExecution] = useState<KpiActionExecutionDto | null>(null);
  const thresholdsQuery = useQuery({
    queryKey: queryKeys.thresholds(testUser),
    queryFn: () => apiClient.getThresholds(testUser),
    enabled: canReadConfig && canReadKpi,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: canReadConfig && canReadKpi && canReadAudit,
    retry: false
  });
  const threshold = thresholdsQuery.data?.thresholds[0];
  const latestEvaluation = thresholdsQuery.data?.latestEvaluation;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestThresholdAction(audit);
  const commandInFlight = pendingCommand !== null;
  const displayStatus =
    thresholdsQuery.isFetching && thresholdsQuery.data === undefined
      ? "Загрузка KPI порогов"
      : status === "Загрузка KPI порогов"
        ? "Пороги загружены из API"
        : status;

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      thresholdsQuery.refetch({ throwOnError: true }),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  function buildRules(): KpiThresholdRuleDto[] {
    const baseRules = threshold?.thresholdRuleSet.rules ?? [];
    return baseRules.map((rule) =>
      rule.severity === "critical"
        ? {
            ...valueCondition(rule, criticalThreshold),
            explanation: "Критическое отклонение после настройки P10"
          }
        : rule
    );
  }

  async function runPreview() {
    if (commandInFlight || threshold === undefined) return;
    setPendingCommand("preview");
    setCommandError("");
    setStatus("Считаем влияние порогов");
    try {
      const nextPreview = await previewMutation.mutateAsync();
      setPreview(nextPreview);
      setLastActionExecution(null);
      setStatus("Предпросмотр готов: состояние не изменено");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Предпросмотр отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function publishPreview() {
    if (commandInFlight || preview === null) return;
    setPendingCommand("publish");
    setCommandError("");
    setStatus("Публикуем версию порогов");
    try {
      const result = await publishMutation.mutateAsync(preview.id);
      await refetchReadModel("Пороги опубликованы и перечитаны из API");
      setPreview(null);
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Публикация отклонена");
    } finally {
      setPendingCommand(null);
    }
  }

  async function refresh() {
    if (commandInFlight) return;
    setPendingCommand("refresh");
    setCommandError("");
    try {
      await refetchReadModel("Данные обновлены из API");
      setPreview(null);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Обновление отклонено");
    } finally {
      setPendingCommand(null);
    }
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      apiClient.previewThresholds(testUser, {
        definitionId: threshold?.definitionId ?? "",
        expectedVersion: threshold?.thresholdRuleSet.version ?? 1,
        rules: buildRules(),
        sampleValue,
        affectedRuntimeSurfaces: ["kpi.deviation.control"]
      })
  });
  const publishMutation = useMutation({
    mutationFn: (previewId: string) => apiClient.publishThresholds(testUser, { previewId })
  });

  if (!canReadConfig || !canReadKpi) {
    return (
      <section className="phase2-surface" data-testid="kpi-threshold-builder-surface">
        <p className="readonly-notice">Нет доступа к настройкам KPI.</p>
      </section>
    );
  }

  return (
    <section className="phase2-surface kpi-threshold-surface" data-testid="kpi-threshold-builder-surface" id="kpi-threshold-builder">
      <div className="surface-heading">
        <div>
          <h2>Конструктор KPI порогов</h2>
          <p>Настройка порогов идет через предпросмотр, публикацию и контрольное чтение из API.</p>
        </div>
        <p className="status-pill" data-testid="kpi-threshold-status">
          {displayStatus}
        </p>
      </div>

      {!canPublish ? (
        <p className="readonly-notice" data-testid="kpi-threshold-readonly">
          Режим чтения: для публикации нужны tenant.config.write и kpi.config:write.
        </p>
      ) : null}
      {thresholdsQuery.isError ? (
        <p className="readonly-notice" data-testid="kpi-threshold-error">
          {getErrorMessage(thresholdsQuery.error)}
        </p>
      ) : null}
      {commandError ? (
        <p className="readonly-notice" data-testid="kpi-threshold-command-error">
          {commandError}
        </p>
      ) : null}

      <div className="phase2-grid kpi-threshold-layout">
        <section className="phase2-panel">
          <h3>Текущие пороги</h3>
          <div className="compact-list" data-testid="kpi-threshold-readback">
            {threshold === undefined
              ? "Загрузка"
              : `${threshold.label}: ${threshold.thresholdRuleSet.id} / v${threshold.thresholdRuleSet.version}`}
          </div>
          <div className="compact-list" data-testid="kpi-threshold-impact">
            {latestEvaluation
              ? `${latestEvaluation.id}: ${latestEvaluation.severity} / v${latestEvaluation.thresholdRuleSetVersion}`
              : "Оценок пока нет"}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Редактор влияния</h3>
          <label className="field-stack">
            <span>Критический порог KPI</span>
            <input
              aria-label="Критический порог KPI"
              disabled={!canPublish || commandInFlight}
              onChange={(event) => {
                setPreview(null);
                setCriticalThreshold(Number(event.target.value));
              }}
              type="number"
              value={criticalThreshold}
            />
          </label>
          <label className="field-stack">
            <span>Тестовое значение</span>
            <input
              aria-label="Тестовое значение KPI"
              disabled={!canPublish || commandInFlight}
              onChange={(event) => {
                setPreview(null);
                setSampleValue(Number(event.target.value));
              }}
              type="number"
              value={sampleValue}
            />
          </label>
          {canPublish ? (
            <div className="button-row">
              <button disabled={commandInFlight || threshold === undefined} onClick={() => void runPreview()} type="button">
                Предпросмотр влияния
              </button>
              <button disabled={commandInFlight || preview === null} onClick={() => void publishPreview()} type="button">
                Опубликовать пороги
              </button>
              <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
                Обновить
              </button>
            </div>
          ) : null}
        </section>

        {preview ? <PreviewPanel preview={preview} /> : null}

        <section className="phase2-panel">
          <h3>Аудит</h3>
          <div className="compact-list" data-testid="kpi-threshold-audit">
            {audit.events.length > 0
              ? audit.events
                  .filter((event) => event.actionKey === "kpi_threshold.publish")
                  .map((event) => (
                    <span key={event.id}>
                      {event.id}: {event.actionKey} / {event.target.entityId}
                    </span>
                  ))
              : "Пока нет событий"}
          </div>
          <p data-testid="kpi-threshold-result">
            {lastActionExecution
              ? actionExecutionLine(lastActionExecution)
              : latestAuditAction
                ? actionExecutionLine(latestAuditAction)
                : "Команда еще не выполнялась"}
          </p>
        </section>
      </div>
    </section>
  );
}
