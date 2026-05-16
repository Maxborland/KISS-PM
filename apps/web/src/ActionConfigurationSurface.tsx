import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type {
  ActionConfigurationApiClient,
  ActionConfigurationAuditDto,
  ActionConfigurationDraftDto,
  ActionConfigurationPreviewDto
} from "./actionConfigurationApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

type ActionConfigurationSurfaceProps = {
  apiClient: ActionConfigurationApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "preview" | "publish" | "refresh" | null;

const queryKeys = {
  readback: (testUser: string) => ["action-configuration", testUser, "readback"] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["action-configuration", testUser, "audit", { canReadAudit }] as const
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

function latestActionConfigAction(audit: ActionConfigurationAuditDto): TenantLabelActionExecutionDto | null {
  return audit.actionExecutions.filter((entry) => entry.commandType === "action_configuration.publish").at(-1) ?? null;
}

function actionExecutionLine(actionExecution: TenantLabelActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function buildDraft(disableRiskAction: boolean, reasonDefault: string, expectedVersion: number): ActionConfigurationDraftDto {
  return {
    expectedVersion,
    actionConfigs: [
      {
        actionKey: "accept_risk",
        enabled: !disableRiskAction,
        formFields: reasonDefault.trim().length > 0 ? [{ fieldKey: "reason", label: "Причина принятия риска", defaultValue: reasonDefault }] : []
      }
    ],
    affectedRuntimeSurfaces: ["portfolio.control"]
  };
}

function PreviewPanel({ preview }: { preview: ActionConfigurationPreviewDto }) {
  return (
    <section className="phase2-panel preview-panel" data-testid="action-config-preview">
      <h3>Предпросмотр действий</h3>
      <p>Состояние еще не изменено. Публикация пройдет через управляемую команду.</p>
      <dl className="compact-facts">
        <div>
          <dt>Версия до</dt>
          <dd>{preview.before.version}</dd>
        </div>
        <div>
          <dt>Версия после</dt>
          <dd>{preview.after.version}</dd>
        </div>
        <div>
          <dt>Отключено</dt>
          <dd>{preview.after.disabledActionKeys.join(", ") || "Нет"}</dd>
        </div>
        <div>
          <dt>Форма</dt>
          <dd>{preview.formChanges.map((entry) => `${entry.actionKey}:${entry.fieldKeys.join(",")}`).join(" / ") || "Без изменений"}</dd>
        </div>
      </dl>
    </section>
  );
}

export function ActionConfigurationSurface({ apiClient, currentTenant, testUser }: ActionConfigurationSurfaceProps) {
  const canReadConfig = hasPermission(currentTenant, "tenant.config.read");
  const canReadSurface = hasPermission(currentTenant, "control.surface:read");
  const canWriteConfig = hasPermission(currentTenant, "tenant.config.write");
  const canWriteActionConfig = hasPermission(currentTenant, "action.config.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canPublish = canWriteConfig && canWriteActionConfig;
  const [disableRiskAction, setDisableRiskAction] = useState(false);
  const [reasonDefault, setReasonDefault] = useState("");
  const [preview, setPreview] = useState<ActionConfigurationPreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка конфигурации действий");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastActionExecution, setLastActionExecution] = useState<TenantLabelActionExecutionDto | null>(null);
  const readbackQuery = useQuery({
    queryKey: queryKeys.readback(testUser),
    queryFn: () => apiClient.getActionConfigs(testUser),
    enabled: canReadConfig && canReadSurface,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: canReadConfig && canReadAudit,
    retry: false
  });
  const previewMutation = useMutation({
    mutationFn: () => apiClient.previewActionConfigs(testUser, buildDraft(disableRiskAction, reasonDefault, readbackQuery.data?.configuration.version ?? 1))
  });
  const publishMutation = useMutation({
    mutationFn: (previewId: string) => apiClient.publishActionConfigs(testUser, { previewId })
  });
  const readback = readbackQuery.data;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestActionConfigAction(audit);
  const commandInFlight = pendingCommand !== null;
  const displayStatus =
    readbackQuery.isFetching && readback === undefined
      ? "Загрузка конфигурации действий"
      : status === "Загрузка конфигурации действий"
        ? "Конфигурация действий загружена из API"
        : status;

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      readbackQuery.refetch({ throwOnError: true }),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runPreview() {
    if (commandInFlight || readback === undefined) return;
    setPendingCommand("preview");
    setCommandError("");
    setStatus("Готовим предпросмотр действий");
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
    setStatus("Публикуем конфигурацию действий");
    try {
      const result = await publishMutation.mutateAsync(preview.id);
      await refetchReadModel("Конфигурация действий опубликована и перечитана из API");
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

  if (!canReadConfig || !canReadSurface) {
    return (
      <section className="phase2-surface" data-testid="action-config-surface">
        <div className="readonly-notice" data-testid="action-config-readonly">
          Нет разрешений tenant.config.read и control.surface:read для просмотра конфигурации действий.
        </div>
      </section>
    );
  }

  return (
    <section className="phase2-surface" data-testid="action-config-surface" id="action-config-builder">
      <div className="surface-heading">
        <div>
          <h2>Конфигурация действий</h2>
          <p>Доступность действий и безопасные defaults формы публикуются только после preview и backend-проверки.</p>
        </div>
        <p className="status-pill" data-testid="action-config-status">
          {displayStatus}
        </p>
      </div>

      {readbackQuery.isError ? (
        <p className="readonly-notice" data-testid="action-config-error">
          {getErrorMessage(readbackQuery.error)}
        </p>
      ) : null}

      {readback ? (
        <div className="phase2-grid">
          <section className="phase2-panel" data-testid="action-config-readback">
            <h3>Активная версия</h3>
            <p>v{readback.configuration.version}</p>
            <p>Отключено: {readback.runtime.disabledActionKeys.join(", ") || "Нет"}</p>
            <p>Поверхности: {readback.runtime.affectedRuntimeSurfaces.join(", ")}</p>
          </section>

          <section className="phase2-panel" data-testid="action-config-actions">
            <h3>Действия</h3>
            <div className="compact-list">
              {readback.actions.map((action) => (
                <span key={action.key}>
                  {action.key}: {action.enabled ? "включено" : "отключено"} / {action.commandType}
                </span>
              ))}
            </div>
          </section>

          <section className="phase2-panel">
            <h3>Изменение</h3>
            {!canPublish ? (
              <p className="readonly-notice" data-testid="action-config-readonly">
                Для публикации нужны tenant.config.write и action.config.write.
              </p>
            ) : (
              <div className="form-grid">
                <label className="field-stack">
                  <span>Отключить действие принятия риска</span>
                  <input
                    aria-label="Отключить действие принятия риска"
                    checked={disableRiskAction}
                    disabled={commandInFlight}
                    onChange={(event) => setDisableRiskAction(event.target.checked)}
                    type="checkbox"
                  />
                </label>
                <label className="field-stack">
                  <span>Default причины</span>
                  <input
                    aria-label="Default причины"
                    disabled={commandInFlight}
                    onChange={(event) => setReasonDefault(event.target.value)}
                    value={reasonDefault}
                  />
                </label>
                <div className="button-row">
                  <button disabled={commandInFlight} type="button" onClick={() => void runPreview()}>
                    Предпросмотр действий
                  </button>
                  <button disabled={commandInFlight || preview === null} type="button" onClick={() => void publishPreview()}>
                    Опубликовать действия
                  </button>
                  <button disabled={commandInFlight} type="button" onClick={() => void refresh()}>
                    Обновить
                  </button>
                </div>
              </div>
            )}
          </section>

          {preview ? <PreviewPanel preview={preview} /> : null}

          {commandError ? (
            <p className="readonly-notice" data-testid="action-config-command-error">
              {commandError}
            </p>
          ) : null}

          {lastActionExecution ? (
            <section className="phase2-panel" data-testid="action-config-result">
              <h3>Результат команды</h3>
              <p>{actionExecutionLine(lastActionExecution)}</p>
            </section>
          ) : null}

          <section className="phase2-panel" data-testid="action-config-audit">
            <h3>Audit evidence</h3>
            <p>{latestAuditAction ? actionExecutionLine(latestAuditAction) : "Нет action evidence"}</p>
            <p>{audit.events.map((event) => event.id).join(", ") || "Нет audit events"}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
