import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type {
  ConfigurationAuditDto,
  ConfigurationExportPackageDto,
  ConfigurationImportPreviewDto,
  ConfigurationOverviewApiClient
} from "./configurationOverviewApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

type ConfigurationOverviewSurfaceProps = {
  apiClient: ConfigurationOverviewApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "export" | "preview" | "apply" | "refresh" | null;

const queryKeys = {
  overview: (testUser: string) => ["p10", "configuration-overview", testUser] as const,
  audit: (testUser: string, enabled: boolean) => ["p10", "configuration-overview-audit", testUser, enabled] as const
};

function hasPermission(currentTenant: CurrentTenantDto, permission: string): boolean {
  return currentTenant.permissions.includes(permission);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function latestConfigurationImportAction(audit: ConfigurationAuditDto): TenantLabelActionExecutionDto | undefined {
  return [...audit.actionExecutions].reverse().find((entry) => entry.commandType === "tenant_configuration.import_apply");
}

function actionExecutionLine(action: TenantLabelActionExecutionDto): string {
  return `${action.commandType} / ${action.status} / ${action.correlationId}`;
}

function previewLine(preview: ConfigurationImportPreviewDto): string {
  return `v${preview.before.configurationVersion} -> v${preview.after.configurationVersion}, ${preview.diffs
    .map((diff) => diff.path)
    .join(", ") || "без изменений"}`;
}

export function ConfigurationOverviewSurface({ apiClient, currentTenant, testUser }: ConfigurationOverviewSurfaceProps) {
  const canRead = hasPermission(currentTenant, "tenant.config.read");
  const canExport = hasPermission(currentTenant, "tenant.config.export");
  const canImport = hasPermission(currentTenant, "tenant.config.import") && hasPermission(currentTenant, "tenant.config.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const [packageJson, setPackageJson] = useState("");
  const [preview, setPreview] = useState<ConfigurationImportPreviewDto | null>(null);
  const [lastActionExecution, setLastActionExecution] = useState<TenantLabelActionExecutionDto | null>(null);
  const [status, setStatus] = useState("Загрузка конфигурации");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const overviewQuery = useQuery({
    queryKey: queryKeys.overview(testUser),
    queryFn: () => apiClient.getConfiguration(testUser),
    enabled: canRead,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: canRead && canReadAudit,
    retry: false
  });
  const exportMutation = useMutation({ mutationFn: () => apiClient.exportConfiguration(testUser) });
  const previewMutation = useMutation({
    mutationFn: (configPackage: ConfigurationExportPackageDto) => apiClient.previewImport(testUser, { package: configPackage })
  });
  const applyMutation = useMutation({
    mutationFn: (previewId: string) => apiClient.applyImport(testUser, { previewId })
  });
  const overview = overviewQuery.data;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestConfigurationImportAction(audit);
  const commandInFlight = pendingCommand !== null;
  const displayStatus =
    overviewQuery.isFetching && overview === undefined
      ? "Загрузка конфигурации"
      : status === "Загрузка конфигурации"
        ? "Конфигурация загружена из API"
        : status;

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      overviewQuery.refetch({ throwOnError: true }),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runExport() {
    if (commandInFlight) return;
    setPendingCommand("export");
    setCommandError("");
    try {
      const exported = await exportMutation.mutateAsync();
      setPackageJson(JSON.stringify(exported, null, 2));
      setStatus("Пакет экспортирован из API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Экспорт отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runPreview() {
    if (commandInFlight) return;
    setPendingCommand("preview");
    setCommandError("");
    setStatus("Проверяем пакет импорта");
    try {
      const parsedPackage = JSON.parse(packageJson) as ConfigurationExportPackageDto;
      const nextPreview = await previewMutation.mutateAsync(parsedPackage);
      setPreview(nextPreview);
      setLastActionExecution(null);
      setStatus(nextPreview.canApply ? "Предпросмотр импорта готов" : "Пакет содержит ошибки валидации");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Предпросмотр отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runApply() {
    if (commandInFlight || preview === null || !preview.canApply) return;
    setPendingCommand("apply");
    setCommandError("");
    setStatus("Применяем импорт конфигурации");
    try {
      const result = await applyMutation.mutateAsync(preview.id);
      await refetchReadModel("Импорт применен и перечитан из API");
      setPreview(null);
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Импорт отклонен");
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

  if (!canRead) {
    return (
      <section className="phase2-surface" data-testid="configuration-overview-surface">
        <div className="readonly-notice" data-testid="configuration-overview-readonly">
          Нет разрешения tenant.config.read для просмотра конфигурации.
        </div>
      </section>
    );
  }

  return (
    <section className="phase2-surface" data-testid="configuration-overview-surface" id="configuration-overview">
      <div className="surface-heading">
        <div>
          <h2>Обзор конфигурации</h2>
          <p>Валидация, экспорт и импорт конфигурации проходят через backend preview и audit evidence.</p>
        </div>
        <p className="status-pill" data-testid="configuration-overview-status">
          {displayStatus}
        </p>
      </div>

      {overviewQuery.isError ? (
        <p className="readonly-notice" data-testid="configuration-overview-error">
          {getErrorMessage(overviewQuery.error)}
        </p>
      ) : null}

      {overview ? (
        <div className="phase2-grid">
          <section className="phase2-panel" data-testid="configuration-overview-readback">
            <h3>Активная конфигурация</h3>
            <p>v{overview.active.configurationVersion}</p>
            <p>Labels: v{overview.active.labelSetVersion}</p>
            <p>Actions: v{overview.active.actionConfigurationVersion}</p>
            <p>Custom fields: v{overview.active.customFieldRegistryVersion}</p>
          </section>

          <section className="phase2-panel">
            <h3>Валидация</h3>
            <p>{overview.validation.canPublish ? "Ошибок нет" : "Есть блокирующие ошибки"}</p>
            <p>{overview.validation.issues.map((entry) => entry.code).join(", ") || "Нет issues"}</p>
          </section>

          <section className="phase2-panel">
            <h3>Export / import</h3>
            {!canExport || !canImport ? (
              <p className="readonly-notice" data-testid="configuration-overview-readonly">
                Для import/export нужны tenant.config.export, tenant.config.import и tenant.config.write.
              </p>
            ) : (
              <div className="form-grid">
                <label className="field-stack">
                  <span>JSON пакета импорта</span>
                  <textarea
                    aria-label="JSON пакета импорта"
                    disabled={commandInFlight}
                    onChange={(event) => setPackageJson(event.target.value)}
                    rows={8}
                    value={packageJson}
                  />
                </label>
                <div className="button-row">
                  <button disabled={commandInFlight} type="button" onClick={() => void runExport()}>
                    Экспорт
                  </button>
                  <button disabled={commandInFlight || packageJson.trim().length === 0} type="button" onClick={() => void runPreview()}>
                    Предпросмотр импорта
                  </button>
                  <button disabled={commandInFlight || preview === null || !preview.canApply} type="button" onClick={() => void runApply()}>
                    Применить импорт
                  </button>
                  <button disabled={commandInFlight} type="button" onClick={() => void refresh()}>
                    Обновить
                  </button>
                </div>
              </div>
            )}
          </section>

          {preview ? (
            <section className="phase2-panel" data-testid="configuration-import-preview">
              <h3>Предпросмотр импорта</h3>
              <p>Состояние еще не изменено</p>
              <p>{previewLine(preview)}</p>
              <p>{preview.validationIssues.map((entry) => `${entry.code}: ${entry.recoveryText ?? entry.message}`).join(" / ")}</p>
            </section>
          ) : null}

          {commandError ? (
            <p className="readonly-notice" data-testid="configuration-overview-command-error">
              {commandError}
            </p>
          ) : null}

          {lastActionExecution ? (
            <section className="phase2-panel" data-testid="configuration-import-result">
              <h3>Результат команды</h3>
              <p>{actionExecutionLine(lastActionExecution)}</p>
            </section>
          ) : null}

          <section className="phase2-panel" data-testid="configuration-overview-audit">
            <h3>Audit evidence</h3>
            <p>{latestAuditAction ? actionExecutionLine(latestAuditAction) : "Нет action evidence"}</p>
            <p>{audit.events.map((event) => event.id).join(", ") || "Нет audit events"}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
