import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  TenantLabelActionExecutionDto,
  TenantLabelAuditDto,
  TenantLabelPreviewRequestDto,
  TenantLabelReadModelDto,
  TenantLabelsApiClient,
  TenantLabelSetPreviewDto
} from "./tenantLabelsApiClient";
import { RuntimeConfigPreview } from "./operationalSurfacePrimitives";

type TenantLabelsAdminSurfaceProps = {
  apiClient: TenantLabelsApiClient;
  currentTenant: CurrentTenantDto;
  onCurrentTenantChange?: (tenant: CurrentTenantDto) => void;
  testUser: string;
};

type DraftLabelChange = {
  roleProjectManager: string;
  stageInitiation: string;
};

type PendingCommand = "preview" | "publish" | "refresh" | null;

const queryKeys = {
  labels: (testUser: string) => ["tenant-labels", testUser, "labels"] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["tenant-labels", testUser, "audit", { canReadAudit }] as const
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

function latestAction(audit: TenantLabelAuditDto): TenantLabelActionExecutionDto | null {
  return audit.actionExecutions.at(-1) ?? null;
}

function createDraftFromReadModel(readModel: TenantLabelReadModelDto | undefined): DraftLabelChange {
  return {
    roleProjectManager: readModel?.labelSet.labels["runtime.role.project_manager"] ?? "РП",
    stageInitiation: readModel?.labelSet.labels["runtime.stage.initiation"] ?? "Старт проекта"
  };
}

function createPreviewRequest(draft: DraftLabelChange): TenantLabelPreviewRequestDto {
  return {
    changes: [
      { key: "runtime.role.project_manager", label: draft.roleProjectManager },
      { key: "runtime.stage.initiation", label: draft.stageInitiation }
    ],
    affectedRuntimeSurfaces: ["project.stage.header", "task.participant.role", "control.surface.filters"]
  };
}

function actionExecutionLine(actionExecution: TenantLabelActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function ProjectionList({ readModel }: { readModel: TenantLabelReadModelDto }) {
  const projectionRows = [
    ...readModel.runtimeProjection.roles.map((role) => ({ type: "Роль", ...role })),
    ...readModel.runtimeProjection.stages.map((stage) => ({ type: "Стадия", ...stage }))
  ];

  if (projectionRows.length === 0) {
    return (
      <div className="compact-list" data-testid="tenant-labels-empty">
        Нет runtime-проекций. Проверьте активную конфигурацию.
      </div>
    );
  }

  return (
    <div className="compact-list" data-testid="tenant-labels-runtime-projection">
      {projectionRows.map((row) => (
        <article className="tenant-label-row" key={`${row.type}-${row.key}`}>
          <span>{row.type}</span>
          <strong>{row.label}</strong>
          <small>{row.key}</small>
        </article>
      ))}
    </div>
  );
}

function PreviewPanel({ preview }: { preview: TenantLabelSetPreviewDto }) {
  return (
    <section className="phase2-panel preview-panel" data-testid="tenant-labels-preview">
      <h3>Предпросмотр runtime-меток</h3>
      <p>Состояние еще не изменено. Публикация пойдет только через серверную команду.</p>
      <RuntimeConfigPreview
        affectedSurfaces={preview.affectedRuntimeSurfaces}
        afterVersion={`v${preview.after.configurationVersion}`}
        beforeVersion={`v${preview.before.configurationVersion}`}
        previewId={preview.id}
        reloadEffectLabel={`После reload tenant labels обновляются на ${preview.affectedRuntimeSurfaces.join(", ")}`}
        summary="Tenant labels обновляют runtime-проекции без изменения стабильных system keys."
        warnings={preview.changes.map((change) => `${change.key}: ${change.beforeLabel} -> ${change.afterLabel}`)}
      />
      <dl className="compact-facts">
        <div>
          <dt>Версия до</dt>
          <dd>{preview.before.configurationVersion}</dd>
        </div>
        <div>
          <dt>Версия после</dt>
          <dd>{preview.after.configurationVersion}</dd>
        </div>
        <div>
          <dt>Поверхности</dt>
          <dd>{preview.affectedRuntimeSurfaces.join(", ")}</dd>
        </div>
      </dl>
      <div className="compact-list">
        {preview.changes.map((change) => (
          <span key={change.key}>
            {change.key}: {change.beforeLabel} {"->"} {change.afterLabel}
          </span>
        ))}
      </div>
    </section>
  );
}

export function TenantLabelsAdminSurface({
  apiClient,
  currentTenant,
  onCurrentTenantChange,
  testUser
}: TenantLabelsAdminSurfaceProps) {
  const canReadConfig = hasPermission(currentTenant, "tenant.config.read");
  const canWriteConfig = hasPermission(currentTenant, "tenant.config.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const [draft, setDraft] = useState<DraftLabelChange>(() => createDraftFromReadModel(undefined));
  const [preview, setPreview] = useState<TenantLabelSetPreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка меток");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastActionExecution, setLastActionExecution] = useState<TenantLabelActionExecutionDto | null>(null);
  const labelsQuery = useQuery<TenantLabelReadModelDto>({
    queryKey: queryKeys.labels(testUser),
    queryFn: () => apiClient.getLabels(testUser),
    enabled: canReadConfig,
    retry: false
  });
  const auditQuery = useQuery<TenantLabelAuditDto>({
    queryKey: queryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: canReadConfig && canReadAudit,
    retry: false
  });
  const previewMutation = useMutation({
    mutationFn: () => apiClient.previewLabels(testUser, createPreviewRequest(draft))
  });
  const publishMutation = useMutation({
    mutationFn: (previewId: string) => apiClient.publishLabels(testUser, { previewId })
  });
  const commandInFlight = pendingCommand !== null;
  const readModel = labelsQuery.data;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestAction(audit);
  const displayStatus =
    labelsQuery.isFetching && readModel === undefined
      ? "Загрузка меток"
      : status === "Загрузка меток"
        ? "Метки загружены из API"
        : status;

  useEffect(() => {
    if (readModel === undefined || preview !== null) return;
    setDraft(createDraftFromReadModel(readModel));
  }, [preview, readModel]);

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      labelsQuery.refetch({ throwOnError: true }),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runPreview() {
    if (commandInFlight) return;
    setPendingCommand("preview");
    setCommandError("");
    setStatus("Готовим предпросмотр");
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
    setStatus("Публикуем метки");
    try {
      const result = await publishMutation.mutateAsync(preview.id);
      await refetchReadModel("Метки опубликованы и перечитаны из API");
      onCurrentTenantChange?.({
        ...currentTenant,
        tenant: {
          ...currentTenant.tenant,
          configurationVersion: result.result.labelSet.configurationVersion
        },
        labels: { ...result.result.labelSet.labels }
      });
      setPreview(null);
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Публикация не выполнена");
    } finally {
      setPendingCommand(null);
    }
  }

  async function refresh() {
    if (commandInFlight) return;
    setPendingCommand("refresh");
    setCommandError("");
    try {
      await refetchReadModel("Метки обновлены из API");
      setPreview(null);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Обновление не выполнено");
    } finally {
      setPendingCommand(null);
    }
  }

  if (!canReadConfig) {
    return (
      <section className="tenant-labels-surface" data-testid="tenant-labels-denied" id="tenant-labels-admin">
        <div className="surface-heading">
          <div>
            <h2>Метки тенанта</h2>
            <p>Нет доступа к конфигурации тенанта.</p>
          </div>
          <p className="status-pill">Доступ закрыт</p>
        </div>
      </section>
    );
  }

  return (
    <section className="tenant-labels-surface" data-testid="tenant-labels-admin" id="tenant-labels-admin">
      <div className="surface-heading">
        <div>
          <h2>Метки, роли и стадии</h2>
          <p>Безопасная публикация runtime-меток по стабильным system key.</p>
        </div>
        <p className="status-pill" data-testid="tenant-labels-status">
          {displayStatus}
        </p>
      </div>

      {!canWriteConfig ? (
        <p className="readonly-notice" data-testid="tenant-labels-readonly">
          Публикация недоступна: нет права tenant.config.write. Runtime-проекции доступны только для чтения.
        </p>
      ) : null}

      {labelsQuery.isError ? (
        <section className="phase2-panel" data-testid="tenant-labels-error">
          <h3>Ошибка загрузки</h3>
          <p>{getErrorMessage(labelsQuery.error)}</p>
          <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
            Обновить
          </button>
        </section>
      ) : (
        <div className="tenant-labels-layout">
          <section className="phase2-panel">
            <h3>Runtime-проекция</h3>
            {readModel ? <ProjectionList readModel={readModel} /> : <div className="compact-list">Загрузка runtime-проекций</div>}
            <div className="button-row">
              <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
                Обновить
              </button>
            </div>
          </section>

          <section className="phase2-panel tenant-labels-editor">
            <h3>Черновик меток</h3>
            <label className="field-stack">
              <span>Роль руководителя проекта</span>
              <input
                aria-label="Роль руководителя проекта"
                disabled={!canWriteConfig || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, roleProjectManager: event.target.value }));
                }}
                value={draft.roleProjectManager}
              />
            </label>
            <label className="field-stack">
              <span>Начальная стадия</span>
              <input
                aria-label="Начальная стадия"
                disabled={!canWriteConfig || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, stageInitiation: event.target.value }));
                }}
                value={draft.stageInitiation}
              />
            </label>
            <div className="button-row">
              {canWriteConfig ? (
                <>
                  <button disabled={commandInFlight} onClick={() => void runPreview()} type="button">
                    Предпросмотр
                  </button>
                  <button disabled={commandInFlight || preview === null} onClick={() => void publishPreview()} type="button">
                    Опубликовать
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {preview ? <PreviewPanel preview={preview} /> : null}

      {commandError ? (
        <p className="readonly-notice" data-testid="tenant-labels-command-error">
          {commandError}
        </p>
      ) : null}

      <section className="phase2-panel tenant-labels-result-panel">
        <h3>Результат и аудит</h3>
        <div className="compact-list" data-testid="tenant-labels-result">
          {lastActionExecution ? actionExecutionLine(lastActionExecution) : "Команда еще не выполнялась"}
        </div>
        <div className="compact-list" data-testid="tenant-labels-audit">
          {!canReadAudit
            ? "Аудит недоступен: нет права audit.read"
            : latestAuditAction
              ? `${actionExecutionLine(latestAuditAction)} / ${latestAuditAction.auditEventIds?.join(", ") ?? ""}`
              : audit.events.length > 0
                ? audit.events.map((event) => `${event.actionKey}: ${event.id}`).join(" / ")
                : "Аудит пока пуст"}
        </div>
      </section>
    </section>
  );
}
