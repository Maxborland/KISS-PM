import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  kpiSeverityLabel,
  type KpiActionExecutionDto,
  type KpiAuditDto,
  type KpiDefinitionApiClient,
  type KpiDefinitionConfigDto,
  type KpiDefinitionListItemDto,
  type KpiDefinitionPreviewDto
} from "./kpiDefinitionApiClient";

type KpiDefinitionAdminSurfaceProps = {
  apiClient: KpiDefinitionApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "preview" | "create" | "publish" | "retire" | "refresh" | null;

const kpiDefinitionQueryKeys = {
  definitions: (testUser: string) => ["kpi-definition-admin", testUser, "definitions"] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["kpi-definition-admin", testUser, "audit", { canReadAudit }] as const
};

const defaultDraft: KpiDefinitionConfigDto = {
  id: "kpi-api-draft-a",
  systemKey: "api_draft_variance",
  label: "Отклонение API",
  entityType: "project",
  ownerRoleKey: "project_manager",
  unit: "percent",
  evaluationCadence: "weekly",
  formula: {
    id: "formula-api-draft-a",
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
    ]
  },
  thresholdRuleSet: {
    id: "threshold-api-draft-a",
    rules: [
      {
        id: "api-draft-critical",
        severity: "critical",
        condition: { operator: "lte", value: -25 },
        explanation: "Отклонение API критическое",
        recommendedActionKeys: ["create_corrective_action"]
      }
    ]
  }
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

function statusLabel(definition: KpiDefinitionListItemDto): string {
  return definition.active ? "Опубликована" : "Черновик";
}

function actionExecutionLine(actionExecution: KpiActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function latestAction(audit: KpiAuditDto): KpiActionExecutionDto | null {
  return audit.actionExecutions.at(-1) ?? null;
}

function pickPublishTarget(definitions: KpiDefinitionListItemDto[]): KpiDefinitionListItemDto | null {
  return definitions.find((definition) => !definition.active) ?? null;
}

function pickRetireTarget(definitions: KpiDefinitionListItemDto[]): KpiDefinitionListItemDto | null {
  return definitions.find((definition) => definition.active) ?? null;
}

function DefinitionList({ definitions }: { definitions: KpiDefinitionListItemDto[] }) {
  if (definitions.length === 0) {
    return (
      <div className="compact-list" data-testid="kpi-definition-empty">
        Нет KPI. Проверьте безопасную формулу и создайте первый черновик.
      </div>
    );
  }

  return (
    <div className="compact-list" data-testid="kpi-definition-list">
      {definitions.map((definition) => (
        <article className="kpi-definition-row" data-testid={`kpi-definition-${definition.id}`} key={definition.id}>
          <div>
            <strong>{definition.label}</strong>
            <span>{definition.id}</span>
          </div>
          <dl className="compact-facts">
            <div>
              <dt>Версия</dt>
              <dd>{definition.version}</dd>
            </div>
            <div>
              <dt>Период</dt>
              <dd>{definition.evaluationCadence}</dd>
            </div>
            <div>
              <dt>Формула</dt>
              <dd>{definition.formula.id}</dd>
            </div>
          </dl>
          <span className={`kpi-status-badge ${definition.active ? "active" : "draft"}`}>{statusLabel(definition)}</span>
        </article>
      ))}
    </div>
  );
}

function PreviewPanel({ preview }: { preview: KpiDefinitionPreviewDto }) {
  return (
    <section className="phase2-panel preview-panel" data-testid="kpi-definition-preview">
      <h3>Предпросмотр до публикации</h3>
      <p>Состояние еще не изменено. Черновик и версия будут созданы только через серверную команду.</p>
      <div className="preview-facts">
        <span>Значение: {preview.value}</span>
        <span>Серьезность: {kpiSeverityLabel(preview.severity)}</span>
        <span>Правило: {preview.matchedRuleId ?? "нет"}</span>
        <span>Действия: {preview.recommendedActionKeys.join(", ") || "нет"}</span>
      </div>
      <p>{preview.formulaTrace.join(" / ")}</p>
      <p>{preview.thresholdTrace.join(" / ")}</p>
    </section>
  );
}

export function KpiDefinitionAdminSurface({ apiClient, currentTenant, testUser }: KpiDefinitionAdminSurfaceProps) {
  const canReadKpi = hasPermission(currentTenant, "kpi:read");
  const canWriteKpiConfig = hasPermission(currentTenant, "kpi.config:write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const [draft, setDraft] = useState<KpiDefinitionConfigDto>(defaultDraft);
  const [sampleValues, setSampleValues] = useState({ plannedWorkHours: 80, actualWorkHours: 100 });
  const [preview, setPreview] = useState<KpiDefinitionPreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка KPI");
  const [commandError, setCommandError] = useState("");
  const [lastActionExecution, setLastActionExecution] = useState<KpiActionExecutionDto | null>(null);
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const definitionsQuery = useQuery<KpiDefinitionListItemDto[]>({
    queryKey: kpiDefinitionQueryKeys.definitions(testUser),
    queryFn: () => apiClient.listDefinitions(testUser),
    enabled: canReadKpi,
    retry: false
  });
  const auditQuery = useQuery<KpiAuditDto>({
    queryKey: kpiDefinitionQueryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getKpiAudit(testUser),
    enabled: canReadKpi && canReadAudit,
    retry: false
  });
  const definitions = definitionsQuery.data ?? [];
  const publishTarget = useMemo(() => pickPublishTarget(definitions), [definitions]);
  const retireTarget = useMemo(() => pickRetireTarget(definitions), [definitions]);
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const commandInFlight = pendingCommand !== null;
  const canCreateDraft = canWriteKpiConfig && preview !== null && publishTarget === null;
  const canPublish = canWriteKpiConfig && publishTarget !== null;
  const canRetire = canWriteKpiConfig && retireTarget !== null;

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      definitionsQuery.refetch({ throwOnError: true }),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  const previewMutation = useMutation({
    mutationFn: () => apiClient.previewDefinition(testUser, { ...draft, sampleValues })
  });
  const createMutation = useMutation({
    mutationFn: () => apiClient.createDefinition(testUser, draft)
  });
  const publishMutation = useMutation({
    mutationFn: (definition: KpiDefinitionListItemDto) =>
      apiClient.publishDefinition(testUser, definition.id, { expectedVersion: definition.version })
  });
  const retireMutation = useMutation({
    mutationFn: (definition: KpiDefinitionListItemDto) =>
      apiClient.retireDefinition(testUser, definition.id, {
        expectedVersion: definition.version,
        reason: "Заменено новой версией KPI"
      })
  });

  if (!canReadKpi) {
    return (
      <section className="kpi-definition-surface" data-testid="kpi-definition-denied" id="kpi-definition-admin">
        <div className="surface-heading">
          <div>
            <h2>Настройка KPI</h2>
            <p>Нет доступа к KPI. Обратитесь к администратору доступа.</p>
          </div>
          <p className="status-pill">Доступ закрыт</p>
        </div>
      </section>
    );
  }

  async function runPreview() {
    if (commandInFlight) return;
    setPendingCommand("preview");
    setCommandError("");
    setStatus("Проверяем формулу и пороги");
    try {
      const nextPreview = await previewMutation.mutateAsync();
      setPreview(nextPreview);
      setLastActionExecution(null);
      setStatus("Предпросмотр готов: бизнес-состояние не изменено");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Предпросмотр отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function createDraft() {
    if (commandInFlight || !canCreateDraft) return;
    setPendingCommand("create");
    setCommandError("");
    setStatus("Создаем KPI черновик");
    try {
      const result = await createMutation.mutateAsync();
      setPreview(null);
      await refetchReadModel("Черновик создан через управляемую команду");
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Черновик не создан");
    } finally {
      setPendingCommand(null);
    }
  }

  async function publishDefinition() {
    if (commandInFlight || !publishTarget) return;
    setPendingCommand("publish");
    setCommandError("");
    setStatus("Публикуем KPI версию");
    try {
      const result = await publishMutation.mutateAsync(publishTarget);
      await refetchReadModel("KPI версия опубликована");
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Публикация не выполнена");
    } finally {
      setPendingCommand(null);
    }
  }

  async function retireDefinition() {
    if (commandInFlight || !retireTarget) return;
    setPendingCommand("retire");
    setCommandError("");
    setStatus("Выводим KPI из публикации");
    try {
      const result = await retireMutation.mutateAsync(retireTarget);
      await refetchReadModel("KPI выведен из публикации");
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Команда вывода из публикации не выполнена");
    } finally {
      setPendingCommand(null);
    }
  }

  async function refresh() {
    if (commandInFlight) return;
    setPendingCommand("refresh");
    setCommandError("");
    try {
      await refetchReadModel("KPI данные обновлены из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Обновление не выполнено");
    } finally {
      setPendingCommand(null);
    }
  }

  const queryLoading = definitionsQuery.isFetching && definitionsQuery.data === undefined;
  const displayStatus = queryLoading ? "Загрузка KPI" : status === "Загрузка KPI" ? "KPI данные загружены" : status;
  const latestAuditAction = latestAction(audit);

  return (
    <section className="kpi-definition-surface" data-testid="kpi-definition-admin" id="kpi-definition-admin">
      <div className="surface-heading">
        <div>
          <h2>Настройка KPI</h2>
          <p>Безопасная настройка формулы, порогов и публикации версии KPI.</p>
        </div>
        <p className="status-pill" data-testid="kpi-definition-status">
          {displayStatus}
        </p>
      </div>

      {!canWriteKpiConfig ? (
        <p className="readonly-notice" data-testid="kpi-definition-readonly">
          Публикация недоступна: нет права kpi.config:write. Данные доступны только для чтения.
        </p>
      ) : null}

      {definitionsQuery.isError ? (
        <section className="phase2-panel" data-testid="kpi-definition-error">
          <h3>Ошибка загрузки</h3>
          <p>{getErrorMessage(definitionsQuery.error)}</p>
          <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
            Обновить
          </button>
        </section>
      ) : (
        <div className="kpi-definition-layout">
          <section className="phase2-panel">
            <h3>Определения KPI</h3>
            {queryLoading ? <div className="compact-list">Загрузка определений</div> : <DefinitionList definitions={definitions} />}
            <div className="button-row">
              <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
                Обновить
              </button>
              {canWriteKpiConfig ? (
                <>
                  {canPublish ? (
                    <button disabled={commandInFlight} onClick={() => void publishDefinition()} type="button">
                      Опубликовать версию
                    </button>
                  ) : null}
                  {canRetire ? (
                    <button disabled={commandInFlight} onClick={() => void retireDefinition()} type="button">
                      Вывести из публикации
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>

          <section className="phase2-panel kpi-definition-editor">
            <h3>Черновик KPI</h3>
            <label className="field-stack">
              <span>Название</span>
              <input
                aria-label="Название KPI"
                disabled={!canWriteKpiConfig || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, label: event.target.value }));
                }}
                value={draft.label}
              />
            </label>
            <label className="field-stack">
              <span>Формула</span>
              <textarea
                aria-label="Формула KPI"
                disabled={!canWriteKpiConfig || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({
                    ...current,
                    formula: { ...current.formula, expression: event.target.value }
                  }));
                }}
                value={draft.formula.expression}
              />
            </label>
            <div className="kpi-sample-grid">
              <label className="field-stack">
                <span>Плановые часы</span>
                <input
                  aria-label="Плановые часы"
                  disabled={!canWriteKpiConfig || commandInFlight}
                  onChange={(event) => {
                    setPreview(null);
                    setSampleValues((current) => ({ ...current, plannedWorkHours: Number(event.target.value) }));
                  }}
                  type="number"
                  value={sampleValues.plannedWorkHours}
                />
              </label>
              <label className="field-stack">
                <span>Фактические часы</span>
                <input
                  aria-label="Фактические часы"
                  disabled={!canWriteKpiConfig || commandInFlight}
                  onChange={(event) => {
                    setPreview(null);
                    setSampleValues((current) => ({ ...current, actualWorkHours: Number(event.target.value) }));
                  }}
                  type="number"
                  value={sampleValues.actualWorkHours}
                />
              </label>
            </div>
            <div className="button-row">
              {canWriteKpiConfig ? (
                <>
                  <button
                    data-testid="kpi-definition-primary-action"
                    disabled={commandInFlight}
                    onClick={() => void runPreview()}
                    type="button"
                  >
                    Проверить формулу
                  </button>
                  <button disabled={commandInFlight || !canCreateDraft} onClick={() => void createDraft()} type="button">
                    Создать черновик
                  </button>
                </>
              ) : null}
            </div>
            <p className="kpi-definition-formula-note">
              Источники: plannedWorkHours из расписания, actualWorkHours из журнала работ. Критический порог при -25%.
            </p>
          </section>
        </div>
      )}

      {preview ? <PreviewPanel preview={preview} /> : null}

      {commandError ? (
        <p className="readonly-notice" data-testid="kpi-definition-command-error">
          {commandError}
        </p>
      ) : null}

      <section className="phase2-panel kpi-definition-result-panel">
        <h3>Результат и аудит</h3>
        <div className="compact-list" data-testid="kpi-definition-result">
          {lastActionExecution ? actionExecutionLine(lastActionExecution) : "Команда еще не выполнялась"}
        </div>
        <div className="compact-list" data-testid="kpi-definition-audit">
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
