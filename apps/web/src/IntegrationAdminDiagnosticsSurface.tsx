import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type {
  IntegrationAdminDiagnosticsApiClient,
  IntegrationDiagnosticDto,
  IntegrationImportApplyResponseDto,
  IntegrationImportPreviewResponseDto
} from "./integrationAdminDiagnosticsApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";

type IntegrationAdminDiagnosticsSurfaceProps = {
  apiClient: IntegrationAdminDiagnosticsApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type PendingCommand = "preview" | "apply" | "failure" | "recover" | "refresh" | null;

const queryKeys = {
  adapters: (testUser: string) => ["p11", "integration-adapters", testUser] as const,
  connections: (testUser: string) => ["p11", "integration-connections", testUser] as const,
  diagnostics: (testUser: string) => ["p11", "integration-diagnostics", testUser] as const,
  batches: (testUser: string) => ["p11", "integration-batches", testUser] as const,
  mappings: (testUser: string) => ["p11", "integration-mappings", testUser] as const,
  audit: (testUser: string) => ["p11", "integration-audit", testUser] as const
};

function hasPermission(currentTenant: CurrentTenantDto, permission: string): boolean {
  return currentTenant.permissions.includes(permission);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : "Неизвестная ошибка";
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function diagnosticLine(diagnostic: IntegrationDiagnosticDto): string {
  if (diagnostic.failure !== undefined) {
    const retry = diagnostic.failure.retryAfterSeconds !== undefined ? ` / retry ${diagnostic.failure.retryAfterSeconds}s` : "";
    return `${diagnostic.connectionId}: ${diagnostic.status} / ${diagnostic.failure.code}${retry}`;
  }

  return `${diagnostic.connectionId}: ${diagnostic.status}`;
}

function sampleMappingLine(preview: IntegrationImportPreviewResponseDto): string {
  return preview.validationReport.sampleMappings.map((mapping) => `${mapping.action}: ${mapping.mappingKey}`).join(" / ") || "Нет sample mappings";
}

function commandIds(previewId: string) {
  return {
    batchId: `batch-ui-${previewId}`,
    idempotencyKey: `idem-ui-${previewId}`
  };
}

export function IntegrationAdminDiagnosticsSurface({
  apiClient,
  currentTenant,
  testUser
}: IntegrationAdminDiagnosticsSurfaceProps) {
  const canRead = hasPermission(currentTenant, "integration.read");
  const canPreview = hasPermission(currentTenant, "integration.preview");
  const canApply = hasPermission(currentTenant, "integration.apply");
  const canReadMappings = hasPermission(currentTenant, "integration.mapping.read");
  const canReadAudit = hasPermission(currentTenant, "integration.audit.read");
  const canAdmin = hasPermission(currentTenant, "integration.admin");
  const [payloadFixtureKey, setPayloadFixtureKey] = useState<"mock-crm-valid" | "mock-crm-invalid">("mock-crm-valid");
  const [preview, setPreview] = useState<IntegrationImportPreviewResponseDto | null>(null);
  const [applyResult, setApplyResult] = useState<IntegrationImportApplyResponseDto | null>(null);
  const [status, setStatus] = useState("Загрузка интеграций");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const commandInFlight = pendingCommand !== null;
  const readEnabled = canRead;
  const adaptersQuery = useQuery({
    queryKey: queryKeys.adapters(testUser),
    queryFn: () => apiClient.listAdapters(testUser),
    enabled: readEnabled,
    retry: false
  });
  const connectionsQuery = useQuery({
    queryKey: queryKeys.connections(testUser),
    queryFn: () => apiClient.listConnections(testUser),
    enabled: readEnabled,
    retry: false
  });
  const diagnosticsQuery = useQuery({
    queryKey: queryKeys.diagnostics(testUser),
    queryFn: () => apiClient.listDiagnostics(testUser),
    enabled: readEnabled,
    retry: false
  });
  const batchesQuery = useQuery({
    queryKey: queryKeys.batches(testUser),
    queryFn: () => apiClient.listBatches(testUser),
    enabled: readEnabled,
    retry: false
  });
  const mappingsQuery = useQuery({
    queryKey: queryKeys.mappings(testUser),
    queryFn: () => apiClient.listMappings(testUser),
    enabled: readEnabled && canReadMappings,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.audit(testUser),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: readEnabled && canReadAudit,
    retry: false
  });
  const previewMutation = useMutation({
    mutationFn: () => {
      const connection = connectionsQuery.data?.[0];
      if (connection === undefined) {
        throw new Error("Нет активного подключения");
      }

      return apiClient.previewImport(testUser, {
        adapterId: connection.adapterId,
        connectionId: connection.id,
        payloadFixtureKey
      });
    }
  });
  const applyMutation = useMutation({
    mutationFn: (request: { previewId: string; batchId: string; idempotencyKey: string; confirmed: true }) =>
      apiClient.applyImport(testUser, request)
  });
  const failureMutation = useMutation({
    mutationFn: (connectionId: string) => apiClient.setFailureMode(testUser, connectionId)
  });
  const clearFailureMutation = useMutation({
    mutationFn: (connectionId: string) => apiClient.clearFailureMode(testUser, connectionId)
  });
  const adapters = adaptersQuery.data ?? [];
  const connections = connectionsQuery.data ?? [];
  const diagnostics = diagnosticsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const mappings = mappingsQuery.data ?? [];
  const audit = auditQuery.data?.audit ?? [];
  const selectedConnection = connections[0] ?? null;
  const hasCriticalLoadError = adaptersQuery.isError || connectionsQuery.isError || diagnosticsQuery.isError || batchesQuery.isError;
  const hasReadModelError = hasCriticalLoadError || mappingsQuery.isError || auditQuery.isError;
  const initialError = [
    adaptersQuery.error,
    connectionsQuery.error,
    diagnosticsQuery.error,
    batchesQuery.error,
    mappingsQuery.error,
    auditQuery.error
  ].find((error) => error !== null);
  const isLoading = [adaptersQuery, connectionsQuery, diagnosticsQuery, batchesQuery].some((query) => query.isFetching && query.data === undefined);
  const displayStatus = isLoading ? "Загрузка интеграций" : status === "Загрузка интеграций" ? "Интеграции загружены из API" : status;
  const applyDisabled = commandInFlight || preview === null || !preview.dryRunSummary.canApply || !canApply;
  const latestBatchId = useMemo(() => applyResult?.result.batch.id ?? batches[0]?.id ?? "Нет batch readback", [applyResult, batches]);

  async function refreshReadModel(nextStatus = "Данные интеграций обновлены") {
    await Promise.all([
      adaptersQuery.refetch({ throwOnError: true }),
      connectionsQuery.refetch({ throwOnError: true }),
      diagnosticsQuery.refetch({ throwOnError: true }),
      batchesQuery.refetch({ throwOnError: true }),
      canReadMappings ? mappingsQuery.refetch({ throwOnError: true }) : Promise.resolve(),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runPreview() {
    if (commandInFlight || !canPreview) return;
    setPendingCommand("preview");
    setCommandError("");
    setApplyResult(null);
    setStatus("Готовим preview импорта");
    try {
      const nextPreview = await previewMutation.mutateAsync();
      setPreview(nextPreview);
      setStatus(nextPreview.dryRunSummary.canApply ? "Preview готов: мутации еще нет" : "Preview содержит блокеры");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Preview отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function runApply() {
    if (applyDisabled || preview === null) return;
    setPendingCommand("apply");
    setCommandError("");
    setStatus("Применяем импорт через governed command");
    const activePreview = preview;
    try {
      const ids = commandIds(activePreview.preview.id);
      const result = await applyMutation.mutateAsync({
        previewId: activePreview.preview.id,
        batchId: ids.batchId,
        idempotencyKey: ids.idempotencyKey,
        confirmed: true
      });
      setApplyResult(result);
      setPreview(null);
      setStatus("Импорт применен, обновляем readback");
      try {
        await refreshReadModel("Импорт применен и перечитан из API");
      } catch (readbackError) {
        setCommandError(`Импорт применен, но readback не обновился: ${getErrorMessage(readbackError)}`);
        setStatus("Импорт применен, readback требует повтора");
      }
    } catch (error) {
      setPreview(null);
      setCommandError(getErrorMessage(error));
      setStatus(getErrorCode(error) === "stale_preview" ? "Preview устарел" : "Импорт отклонен");
      try {
        await refreshReadModel("Readback обновлен после отказа");
      } catch (readbackError) {
        setCommandError(`${getErrorMessage(error)} / readback: ${getErrorMessage(readbackError)}`);
        setStatus("Импорт отклонен, readback требует повтора");
      }
    } finally {
      setPendingCommand(null);
    }
  }

  async function refresh() {
    if (commandInFlight) return;
    setPendingCommand("refresh");
    setCommandError("");
    setPreview(null);
    try {
      await refreshReadModel();
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Обновление отклонено");
    } finally {
      setPendingCommand(null);
    }
  }

  async function setFailure() {
    if (commandInFlight || !canAdmin || selectedConnection === null) return;
    setPendingCommand("failure");
    setCommandError("");
    try {
      await failureMutation.mutateAsync(selectedConnection.id);
      await diagnosticsQuery.refetch({ throwOnError: true });
      setStatus("Failure mode включен и перечитан");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Failure mode отклонен");
    } finally {
      setPendingCommand(null);
    }
  }

  async function clearFailure() {
    if (commandInFlight || !canAdmin || selectedConnection === null) return;
    setPendingCommand("recover");
    setCommandError("");
    try {
      await clearFailureMutation.mutateAsync(selectedConnection.id);
      await diagnosticsQuery.refetch({ throwOnError: true });
      setStatus("Failure mode снят и перечитан");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Восстановление отклонено");
    } finally {
      setPendingCommand(null);
    }
  }

  if (!canRead) {
    return (
      <section className="integration-admin-surface" data-testid="integration-admin-denied" id="integration-admin-diagnostics">
        <div className="readonly-notice">Нет разрешения integration.read для просмотра интеграций.</div>
      </section>
    );
  }

  return (
    <section className="integration-admin-surface" data-testid="integration-admin-surface" id="integration-admin-diagnostics">
      <div className="surface-heading">
        <div>
          <h2>Диагностика интеграций</h2>
          <p>Preview, apply, mappings и audit evidence для управляемого импорта.</p>
        </div>
        <p className="status-pill" data-testid="integration-admin-status">
          {displayStatus}
        </p>
      </div>

      {hasReadModelError ? (
        <section className="phase2-panel" data-testid="integration-admin-error">
          <h3>Интеграции недоступны</h3>
          <p>{getErrorMessage(initialError)}</p>
          <button disabled={commandInFlight} type="button" onClick={() => void refresh()}>
            Повторить
          </button>
        </section>
      ) : null}

      {isLoading ? (
        <p className="phase2-panel" data-testid="integration-admin-loading">
          Загрузка интеграций
        </p>
      ) : null}

      {!hasCriticalLoadError ? (
        <div className="integration-admin-layout">
          <section className="phase2-panel" data-testid="integration-adapter-list">
            <h3>Адаптеры</h3>
            <div className="compact-list">
              {adapters.length > 0
                ? adapters.map((adapter) => (
                    <span key={adapter.id}>
                      {adapter.label}: {adapter.sourceSystem} / {adapter.active ? "active" : "disabled"}
                    </span>
                  ))
                : "Нет адаптеров"}
            </div>
          </section>

          <section className="phase2-panel" data-testid="integration-connection-list">
            <h3>Подключения</h3>
            <div className="compact-list">
              {connections.length > 0
                ? connections.map((connection) => (
                    <span key={connection.id}>
                      {connection.id}: {connection.status}
                    </span>
                  ))
                : "Нет подключений"}
            </div>
          </section>

          <section className="phase2-panel" data-testid="integration-diagnostics-panel">
            <h3>Failure diagnostics</h3>
            <div className="compact-list">
              {diagnostics.length > 0 ? diagnostics.map((diagnostic) => <span key={diagnostic.connectionId}>{diagnosticLine(diagnostic)}</span>) : "Нет diagnostics"}
            </div>
            {canAdmin ? (
              <div className="button-row">
                <button disabled={commandInFlight || selectedConnection === null} type="button" onClick={() => void setFailure()}>
                  Включить rate-limit
                </button>
                <button disabled={commandInFlight || selectedConnection === null} type="button" onClick={() => void clearFailure()}>
                  Снять сбой
                </button>
              </div>
            ) : null}
          </section>

          <section className="phase2-panel">
            <h3>Import preview</h3>
            {!canPreview || !canApply ? (
              <p className="readonly-notice" data-testid="integration-command-denied">
                preview/apply недоступны по backend permissions. UI не показывает управляющие кнопки.
              </p>
            ) : (
              <div className="form-grid">
                <label className="field-stack">
                  <span>Фикстура импорта</span>
                  <select
                    aria-label="Фикстура импорта"
                    disabled={commandInFlight}
                    onChange={(event) => setPayloadFixtureKey(event.target.value as "mock-crm-valid" | "mock-crm-invalid")}
                    value={payloadFixtureKey}
                  >
                    <option value="mock-crm-valid">mock-crm-valid</option>
                    <option value="mock-crm-invalid">mock-crm-invalid</option>
                  </select>
                </label>
                <div className="button-row">
                  <button disabled={commandInFlight || selectedConnection === null} type="button" onClick={() => void runPreview()}>
                    Предпросмотреть импорт
                  </button>
                  <button disabled={applyDisabled} type="button" onClick={() => void runApply()}>
                    Применить preview
                  </button>
                  <button disabled={commandInFlight} type="button" onClick={() => void refresh()}>
                    Обновить
                  </button>
                </div>
              </div>
            )}
          </section>

          {commandError ? (
            <section className="phase2-panel warning-list" data-testid="integration-command-error">
              <h3>Команда отклонена</h3>
              <p>{commandError}</p>
            </section>
          ) : null}

          {preview !== null ? (
            <section className="phase2-panel preview-panel" data-testid="integration-import-preview">
              <h3>Dry-run preview</h3>
              <p>Состояние еще не изменено</p>
              <p>
                Создать: {preview.validationReport.summary.creates}; Обновить: {preview.validationReport.summary.updates}; Ошибки:{" "}
                {preview.validationReport.summary.errors}
              </p>
              <p>{sampleMappingLine(preview)}</p>
              <p>{preview.validationReport.blockers.map((blocker) => `${blocker.code}: ${blocker.recoveryText ?? blocker.severity}`).join(" / ")}</p>
              <p>
                mutatesState={String(preview.dryRunSummary.mutatesState)} / total={preview.dryRunSummary.expectedTotalAffected}
              </p>
            </section>
          ) : null}

          {applyResult !== null ? (
            <section className="phase2-panel" data-testid="integration-import-result">
              <h3>Результат импорта</h3>
              <p>{latestBatchId}</p>
              <p>
                {applyResult.result.status}: {applyResult.result.audit.command} / {applyResult.result.audit.result}
              </p>
            </section>
          ) : null}

          <section className="phase2-panel" data-testid="integration-mapping-table">
            <h3>External mappings</h3>
            <div className="compact-list">
              {mappings.length > 0
                ? mappings.map((mapping) => (
                    <span key={mapping.id}>
                      {mapping.sourceSystem}:{mapping.externalEntityType}:{mapping.externalEntityId} {"->"} {mapping.canonicalEntityId} /{" "}
                      {mapping.lastSyncStatus}
                    </span>
                  ))
                : "Пока нет mappings"}
            </div>
          </section>

          <section className="phase2-panel" data-testid="integration-audit-panel">
            <h3>Audit evidence</h3>
            <div className="compact-list">
              {audit.length > 0
                ? audit.map((event) => (
                    <span key={event.id}>
                      {event.command}: {event.result} / {event.correlationId}
                    </span>
                  ))
                : "Нет audit events"}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
