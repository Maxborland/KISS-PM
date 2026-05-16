import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { kpiSeverityLabel, type KpiActionExecutionDto } from "./kpiDefinitionApiClient";
import {
  kpiRecommendedActionLabel,
  kpiSignalStatusLabel,
  type KpiDeviationApiClient,
  type KpiDeviationAuditDto,
  type KpiEvaluationDto,
  type KpiSignalDto
} from "./kpiDeviationApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";

type KpiDeviationControlSurfaceProps = {
  apiClient: KpiDeviationApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "evaluate" | "refresh" | null;

const kpiDeviationQueryKeys = {
  signals: (testUser: string) => ["kpi-deviation-control", testUser, "signals"] as const,
  detail: (testUser: string, signalId: string | null) => ["kpi-deviation-control", testUser, "detail", signalId] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["kpi-deviation-control", testUser, "audit", { canReadAudit }] as const
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

function latestAction(audit: KpiDeviationAuditDto): KpiActionExecutionDto | null {
  return audit.actionExecutions.at(-1) ?? null;
}

function formatPeriod(evaluation: KpiEvaluationDto): string {
  return `${evaluation.period.start} - ${evaluation.period.end}`;
}

function SignalList({
  activeSignalId,
  onSelectSignal,
  signals
}: {
  activeSignalId: string | null;
  onSelectSignal(signalId: string): void;
  signals: KpiSignalDto[];
}) {
  if (signals.length === 0) {
    return (
      <div className="compact-list" data-testid="kpi-deviation-empty">
        Нет KPI-отклонений. Запустите оценку KPI после появления проектных данных.
      </div>
    );
  }

  return (
    <div className="compact-list" data-testid="kpi-deviation-list">
      {signals.map((signal) => (
        <button
          className={`kpi-signal-card ${signal.id === activeSignalId ? "active" : ""}`}
          key={signal.id}
          onClick={() => onSelectSignal(signal.id)}
          type="button"
        >
          <strong>{kpiSeverityLabel(signal.severity)}</strong>
          <span>{signal.entityId}</span>
          <span>{signal.explanation}</span>
          <span>{kpiSignalStatusLabel(signal.status)}</span>
        </button>
      ))}
    </div>
  );
}

function SignalDetail({ evaluation, signal }: { evaluation: KpiEvaluationDto; signal: KpiSignalDto }) {
  return (
    <section className="phase2-panel kpi-deviation-detail-panel" data-testid="kpi-deviation-detail">
      <div className="surface-heading compact">
        <div>
          <h3>Трассировка отклонения</h3>
          <p>
            {signal.id} / {signal.kpiDefinitionId}
          </p>
        </div>
        <span className={`kpi-status-badge ${signal.severity}`}>{kpiSeverityLabel(signal.severity)}</span>
      </div>
      <dl className="compact-facts">
        <div>
          <dt>Оценка</dt>
          <dd>{evaluation.id}</dd>
        </div>
        <div>
          <dt>Сигнал из оценки</dt>
          <dd>{signal.sourceEvaluationId}</dd>
        </div>
        <div>
          <dt>Версия KPI</dt>
          <dd>{evaluation.kpiDefinitionVersion}</dd>
        </div>
        <div>
          <dt>Формула</dt>
          <dd>
            {evaluation.formulaDefinitionId}@{evaluation.formulaVersion}
          </dd>
        </div>
        <div>
          <dt>Набор порогов</dt>
          <dd>
            {evaluation.thresholdRuleSetId}@{evaluation.thresholdRuleSetVersion}
          </dd>
        </div>
        <div>
          <dt>Объект</dt>
          <dd>{signal.entityId}</dd>
        </div>
        <div>
          <dt>Период</dt>
          <dd>{formatPeriod(evaluation)}</dd>
        </div>
        <div>
          <dt>Значение</dt>
          <dd>{evaluation.value}</dd>
        </div>
        <div>
          <dt>Порог</dt>
          <dd>{evaluation.matchedThresholdRuleId ?? "нет"}</dd>
        </div>
        <div>
          <dt>Владелец</dt>
          <dd>{evaluation.entityType}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{kpiSignalStatusLabel(signal.status)}</dd>
        </div>
      </dl>
      <div className="kpi-trace-grid">
        <div>
          <h4>Источник</h4>
          {evaluation.sourceTrace.map((sourceValue) => (
            <p key={`${sourceValue.bindingKey}-${sourceValue.sourceField}`}>
              {sourceValue.bindingKey}: {sourceValue.value} / {sourceValue.sourceEntityType}:{sourceValue.sourceEntityId} /{" "}
              {sourceValue.sourceField} / {sourceValue.observedAt}
            </p>
          ))}
        </div>
        <div>
          <h4>Формула</h4>
          <p>{evaluation.formulaTrace.join(" / ")}</p>
        </div>
        <div>
          <h4>Порог</h4>
          <p>{evaluation.thresholdTrace.join(" / ")}</p>
        </div>
      </div>
      <div className="compact-list">
        {signal.recommendedActionKeys.map((actionKey) => (
          <span key={actionKey}>{kpiRecommendedActionLabel(actionKey)}</span>
        ))}
      </div>
    </section>
  );
}

export function KpiDeviationControlSurface({ apiClient, currentTenant, testUser }: KpiDeviationControlSurfaceProps) {
  const queryClient = useQueryClient();
  const canReadKpi = hasPermission(currentTenant, "kpi:read");
  const canRunEvaluation = hasPermission(currentTenant, "kpi.evaluate:execute");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [status, setStatus] = useState("Загрузка KPI-отклонений");
  const [commandError, setCommandError] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const [lastActionExecution, setLastActionExecution] = useState<KpiActionExecutionDto | null>(null);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const signalsQuery = useQuery<KpiSignalDto[]>({
    queryKey: kpiDeviationQueryKeys.signals(testUser),
    queryFn: () => apiClient.listSignals(testUser),
    enabled: canReadKpi,
    retry: false
  });
  const signals = signalsQuery.data ?? [];
  const activeSignalId = selectedSignalId ?? signals[0]?.id ?? null;
  const detailQuery = useQuery({
    queryKey: kpiDeviationQueryKeys.detail(testUser, activeSignalId),
    queryFn: () => {
      if (!activeSignalId) throw new Error("KPI signal не выбран");
      return apiClient.getSignalDetail(testUser, activeSignalId);
    },
    enabled: canReadKpi && activeSignalId !== null,
    retry: false
  });
  const auditQuery = useQuery<KpiDeviationAuditDto>({
    queryKey: kpiDeviationQueryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getKpiAudit(testUser),
    enabled: canReadKpi && canReadAudit,
    retry: false
  });
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestAction(audit);
  const commandInFlight = pendingCommand !== null;
  const queryLoading = signalsQuery.isFetching && signalsQuery.data === undefined;
  const displayStatus =
    queryLoading ? "Загрузка KPI-отклонений" : status === "Загрузка KPI-отклонений" ? "KPI-отклонения загружены" : status;

  const evaluationRequest = useMemo(() => {
    const detail = detailQuery.data;
    if (!detail) return null;

    return {
      definitionId: detail.signal.kpiDefinitionId,
      entity: { type: detail.evaluation.entityType, id: detail.evaluation.entityId },
      period: detail.evaluation.period
    };
  }, [detailQuery.data]);

  const runEvaluationMutation = useMutation({
    mutationFn: () => {
      if (!evaluationRequest) throw new Error("Нет KPI-отклонения для пересчета");
      return apiClient.runEvaluation(testUser, evaluationRequest);
    }
  });

  if (!canReadKpi) {
    return (
      <section className="kpi-deviation-surface" data-testid="kpi-deviation-denied" id="kpi-deviation-control">
        <div className="surface-heading">
          <div>
            <h2>Контроль KPI-отклонений</h2>
            <p>Нет доступа к KPI. Отклонения и трассировка скрыты политикой доступа.</p>
          </div>
          <p className="status-pill">Доступ закрыт</p>
        </div>
      </section>
    );
  }

  async function refresh(nextStatus = "KPI-отклонения обновлены из API") {
    if (commandInFlight) return;
    setPendingCommand("refresh");
    setCommandError("");
    try {
      await signalsQuery.refetch({ throwOnError: true });
      if (activeSignalId) {
        await detailQuery.refetch({ throwOnError: true });
      }
      if (canReadAudit) {
        await auditQuery.refetch({ throwOnError: true });
      }
      setStatus(nextStatus);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Обновление не выполнено");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runEvaluation() {
    if (commandInFlight || !canRunEvaluation || !evaluationRequest) return;
    setPendingCommand("evaluate");
    setCommandError("");
    setStatus("Пересчитываем KPI через управляемую команду");
    try {
      const result = await runEvaluationMutation.mutateAsync();
      const nextSignalId = result.signal?.id ?? activeSignalId;
      await signalsQuery.refetch({ throwOnError: true });
      if (nextSignalId) {
        const detailReadback = await apiClient.getSignalDetail(testUser, nextSignalId);
        queryClient.setQueryData(kpiDeviationQueryKeys.detail(testUser, nextSignalId), detailReadback);
        setSelectedSignalId(nextSignalId);
      }
      if (!canReadAudit) {
        throw new Error("Аудит недоступен: нет права audit.read");
      }
      const auditReadback = await apiClient.getKpiAudit(testUser);
      const verifiedActionExecution =
        auditReadback.actionExecutions.find(
          (actionExecution) => actionExecution.correlationId === result.actionExecution.correlationId
        ) ?? null;
      if (!verifiedActionExecution) {
        throw new Error("Команда выполнена, но audit/readback не подтвердил action evidence");
      }
      queryClient.setQueryData(kpiDeviationQueryKeys.audit(testUser, canReadAudit), auditReadback);
      setLastActionExecution(verifiedActionExecution);
      setStatus("KPI пересчитан, отклонение обновлено из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Пересчет KPI не выполнен");
    } finally {
      setPendingCommand(null);
    }
  }

  return (
    <section className="kpi-deviation-surface" data-testid="kpi-deviation-control" id="kpi-deviation-control">
      <div className="surface-heading">
        <div>
          <h2>Контроль KPI-отклонений</h2>
          <p>Контрольный сигнал KPI с источником, формулой, порогом и следующим управленческим путем.</p>
        </div>
        <p className="status-pill" data-testid="kpi-deviation-status">
          {displayStatus}
        </p>
      </div>

      {!canRunEvaluation ? (
        <p className="readonly-notice" data-testid="kpi-deviation-readonly">
          Пересчет недоступен: нет права kpi.evaluate:execute. Отклонения доступны только для чтения.
        </p>
      ) : null}

      {signalsQuery.isError ? (
        <section className="phase2-panel" data-testid="kpi-deviation-error">
          <h3>Ошибка загрузки</h3>
          <p>{getErrorMessage(signalsQuery.error)}</p>
          <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
            Обновить
          </button>
        </section>
      ) : (
        <div className="kpi-deviation-layout">
          <section className="phase2-panel">
            <h3>Сигналы KPI</h3>
            {queryLoading ? (
              <div className="compact-list">Загрузка сигналов</div>
            ) : (
              <SignalList activeSignalId={activeSignalId} onSelectSignal={setSelectedSignalId} signals={signals} />
            )}
            <div className="button-row">
              <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
                Обновить
              </button>
              {canRunEvaluation ? (
                <button disabled={commandInFlight || !evaluationRequest} onClick={() => void runEvaluation()} type="button">
                  Пересчитать KPI
                </button>
              ) : null}
            </div>
          </section>

          <section className="phase2-panel kpi-deviation-action-panel">
            <h3>Следующий шаг</h3>
            <button
              data-testid="kpi-deviation-primary-action"
              disabled={activeSignalId === null}
              onClick={() =>
                setHandoffMessage("P8 получит сигнал, трассировку KPI и рекомендованные действия без прямой мутации P7.")
              }
              type="button"
            >
              Открыть путь управления
            </button>
            <p>{handoffMessage || "P7 показывает отклонение и готовит передачу в движок управляемых действий P8."}</p>
          </section>
        </div>
      )}

      {detailQuery.isError ? (
        <p className="readonly-notice" data-testid="kpi-deviation-detail-error">
          {getErrorMessage(detailQuery.error)}
        </p>
      ) : null}

      {detailQuery.data ? <SignalDetail evaluation={detailQuery.data.evaluation} signal={detailQuery.data.signal} /> : null}

      {commandError ? (
        <p className="readonly-notice" data-testid="kpi-deviation-command-error">
          {commandError}
        </p>
      ) : null}

      <section className="phase2-panel kpi-definition-result-panel">
        <h3>Результат и аудит</h3>
        <div className="compact-list" data-testid="kpi-deviation-result">
          {lastActionExecution ? actionExecutionLine(lastActionExecution) : "Команда еще не выполнялась"}
        </div>
        <div className="compact-list" data-testid="kpi-deviation-audit">
          {!canReadAudit
            ? "Аудит недоступен: нет права audit.read"
            : latestAuditAction
              ? actionExecutionLine(latestAuditAction)
              : audit.events.length > 0
                ? audit.events.map((event) => `${event.actionKey}: ${event.target.entityId}`).join(" / ")
                : "Аудит пока пуст"}
        </div>
      </section>
    </section>
  );
}
