import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  SavedViewAuditDto,
  SavedViewLayoutBuilderApiClient,
  SavedViewLayoutDraftDto,
  SavedViewLayoutPreviewDto
} from "./savedViewLayoutBuilderApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";
import { RuntimeConfigPreview } from "./operationalSurfacePrimitives";

type SavedViewLayoutBuilderSurfaceProps = {
  apiClient: SavedViewLayoutBuilderApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type DraftState = {
  viewLabel: string;
  savedViewKey: string;
  savedViewLabel: string;
  visibleFieldKeys: string;
  filterKeys: string;
  sortKeys: string;
  groupKeys: string;
  widgetKeys: string;
  actionSlotKeys: string;
};

type PendingCommand = "preview" | "publish" | "refresh" | null;

const queryKeys = {
  readback: (testUser: string) => ["saved-view-layout-builder", testUser, "readback"] as const,
  audit: (testUser: string, canReadAudit: boolean) =>
    ["saved-view-layout-builder", testUser, "audit", { canReadAudit }] as const
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

function listFromCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function latestLayoutAction(audit: SavedViewAuditDto): TenantLabelActionExecutionDto | null {
  return audit.actionExecutions.filter((entry) => entry.commandType === "control_surface_layout.publish").at(-1) ?? null;
}

function actionExecutionLine(actionExecution: TenantLabelActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function defaultDraft(): DraftState {
  return {
    viewLabel: "Портфель без технических полей",
    savedViewKey: "critical_portfolio",
    savedViewLabel: "Критичный портфель",
    visibleFieldKeys: "project_label, signal_label, severity",
    filterKeys: "severity",
    sortKeys: "project_label",
    groupKeys: "severity",
    widgetKeys: "critical_signal_count",
    actionSlotKeys: "create_corrective_action, accept_risk"
  };
}

function buildDraft(draft: DraftState, expectedSurfaceVersion: number): SavedViewLayoutDraftDto {
  const filterKeys = listFromCsv(draft.filterKeys);
  const sortKeys = listFromCsv(draft.sortKeys);
  const groupKeys = listFromCsv(draft.groupKeys);

  return {
    surfaceId: "portfolio-control",
    expectedSurfaceVersion,
    viewLabel: draft.viewLabel,
    visibleFieldKeys: listFromCsv(draft.visibleFieldKeys),
    filterKeys,
    sortKeys,
    groupKeys,
    widgetKeys: listFromCsv(draft.widgetKeys),
    actionSlotKeys: listFromCsv(draft.actionSlotKeys),
    savedView: {
      id: `saved-view-${draft.savedViewKey}`,
      key: draft.savedViewKey,
      label: draft.savedViewLabel,
      ownerType: "tenant",
      filterKeys,
      sortKeys,
      groupKeys,
      scope: "tenant"
    },
    affectedRuntimeSurfaces: ["portfolio.control"]
  };
}

function PreviewPanel({ preview }: { preview: SavedViewLayoutPreviewDto }) {
  const savedViewSummary =
    preview.after.savedViewKeys.length > 0 ? preview.after.savedViewKeys.join(", ") : "default surface layout";

  return (
    <section className="phase2-panel preview-panel" data-testid="saved-view-layout-preview">
      <h3>Предпросмотр макета</h3>
      <p>Состояние еще не изменено. Публикация пройдет через управляемую команду.</p>
      <RuntimeConfigPreview
        affectedSurfaces={preview.affectedRuntimeSurfaces}
        afterVersion={`v${preview.after.surfaceVersion}`}
        beforeVersion={`v${preview.before.surfaceVersion}`}
        blockers={preview.unavailable.reasons}
        previewId={preview.id}
        reloadEffectLabel={`Reload keeps saved view ${savedViewSummary} on ${preview.affectedRuntimeSurfaces.join(", ")}`}
        summary="Saved view and column layout affect runtime control surfaces only after publish/readback."
        warnings={preview.unavailable.fields.map((field) => `${field} will be hidden from the runtime layout`)}
      />
      <dl className="compact-facts">
        <div>
          <dt>Версия до</dt>
          <dd>{preview.before.surfaceVersion}</dd>
        </div>
        <div>
          <dt>Версия после</dt>
          <dd>{preview.after.surfaceVersion}</dd>
        </div>
        <div>
          <dt>Поля</dt>
          <dd>{preview.after.visibleFieldKeys.join(", ")}</dd>
        </div>
        <div>
          <dt>Скрыто</dt>
          <dd>{preview.unavailable.fields.length > 0 ? preview.unavailable.fields.join(", ") : "Нет"}</dd>
        </div>
      </dl>
    </section>
  );
}

export function SavedViewLayoutBuilderSurface({
  apiClient,
  currentTenant,
  testUser
}: SavedViewLayoutBuilderSurfaceProps) {
  const canReadConfig = hasPermission(currentTenant, "tenant.config.read");
  const canWriteConfig = hasPermission(currentTenant, "tenant.config.write");
  const canReadSurface = hasPermission(currentTenant, "control.surface:read");
  const canWriteLayout = hasPermission(currentTenant, "control_surface.config.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canPublish = canWriteConfig && canWriteLayout;
  const [draft, setDraft] = useState<DraftState>(() => defaultDraft());
  const [preview, setPreview] = useState<SavedViewLayoutPreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка сохраненных видов");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastActionExecution, setLastActionExecution] = useState<TenantLabelActionExecutionDto | null>(null);
  const readbackQuery = useQuery({
    queryKey: queryKeys.readback(testUser),
    queryFn: () => apiClient.getSavedViews(testUser),
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
    mutationFn: () => apiClient.previewLayout(testUser, buildDraft(draft, readbackQuery.data?.activeSurface.version ?? 1))
  });
  const publishMutation = useMutation({
    mutationFn: (previewId: string) => apiClient.publishLayout(testUser, { previewId })
  });
  const readback = readbackQuery.data;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestLayoutAction(audit);
  const commandInFlight = pendingCommand !== null;
  const displayStatus =
    readbackQuery.isFetching && readback === undefined
      ? "Загрузка сохраненных видов"
      : status === "Загрузка сохраненных видов"
        ? "Макет загружен из API"
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
    setStatus("Готовим предпросмотр макета");
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
    setStatus("Публикуем макет");
    try {
      const result = await publishMutation.mutateAsync(preview.id);
      await refetchReadModel("Макет опубликован и перечитан из API");
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
      <section className="phase2-surface" data-testid="saved-view-layout-builder-surface">
        <div className="readonly-notice" data-testid="saved-view-layout-readonly">
          Нет разрешений tenant.config.read и control.surface:read для просмотра сохраненных видов.
        </div>
      </section>
    );
  }

  return (
    <section className="phase2-surface" data-testid="saved-view-layout-builder-surface" id="saved-view-layout-builder">
      <div className="surface-heading">
        <div>
          <h2>Сохраненные виды и макет поверхности</h2>
          <p>Макет портфельной поверхности публикуется только после preview и backend-проверки.</p>
        </div>
        <p className="status-pill" data-testid="saved-view-layout-status">
          {displayStatus}
        </p>
      </div>

      {!canPublish ? (
        <p className="readonly-notice" data-testid="saved-view-layout-readonly">
          Режим чтения: для публикации нужны tenant.config.write и control_surface.config.write.
        </p>
      ) : null}

      {readbackQuery.isError ? (
        <p className="readonly-notice" data-testid="saved-view-layout-error">
          {getErrorMessage(readbackQuery.error)}
        </p>
      ) : null}
      {commandError ? (
        <p className="readonly-notice" data-testid="saved-view-layout-command-error">
          {commandError}
        </p>
      ) : null}

      <div className="phase2-grid saved-view-layout">
        <section className="phase2-panel">
          <h3>Активный макет</h3>
          <div className="compact-list" data-testid="saved-view-layout-readback">
            {readback === undefined ? (
              "Загрузка"
            ) : (
              <>
                <span>
                  {readback.activeSurface.label}: v{readback.activeSurface.version} / {readback.activeSurface.view.label}
                </span>
                {readback.activeSurface.view.savedViews.map((view) => (
                  <span key={view.key}>
                    {view.label}: {view.key}
                  </span>
                ))}
              </>
            )}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Поля макета</h3>
          <div className="compact-list" data-testid="saved-view-layout-fields">
            {readback?.activeSurface.view.fields.map((field) => (
              <span key={field.key}>
                {field.key}: {field.visible ? "видимо" : "скрыто"}
              </span>
            )) ?? "Загрузка"}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Черновик вида</h3>
          <label className="field-stack">
            <span>Название макета</span>
            <input
              aria-label="Название макета"
              onChange={(event) => setDraft((current) => ({ ...current, viewLabel: event.target.value }))}
              value={draft.viewLabel}
            />
          </label>
          <label className="field-stack">
            <span>Ключ сохраненного вида</span>
            <input
              aria-label="Ключ сохраненного вида"
              onChange={(event) => setDraft((current) => ({ ...current, savedViewKey: event.target.value }))}
              value={draft.savedViewKey}
            />
          </label>
          <label className="field-stack">
            <span>Видимые поля</span>
            <input
              aria-label="Видимые поля"
              onChange={(event) => setDraft((current) => ({ ...current, visibleFieldKeys: event.target.value }))}
              value={draft.visibleFieldKeys}
            />
          </label>
          {canPublish ? (
            <div className="button-row">
              <button disabled={commandInFlight || readback === undefined} type="button" onClick={() => void runPreview()}>
                Предпросмотр макета
              </button>
              <button disabled={commandInFlight || preview === null} type="button" onClick={() => void publishPreview()}>
                Опубликовать макет
              </button>
              <button disabled={commandInFlight} type="button" onClick={() => void refresh()}>
                Обновить
              </button>
            </div>
          ) : null}
        </section>

        {preview ? <PreviewPanel preview={preview} /> : null}

        <section className="phase2-panel">
          <h3>Предыдущие версии</h3>
          <div className="compact-list" data-testid="saved-view-layout-previous">
            {readback === undefined
              ? "Загрузка"
              : readback.previousVersions.length === 0
                ? "Нет предыдущих версий"
                : readback.previousVersions.map((version) => (
                    <span key={`${version.id}-${version.version}`}>
                      v{version.version}: {version.viewLabel}
                    </span>
                  ))}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Аудит</h3>
          <div className="compact-list" data-testid="saved-view-layout-audit">
            {audit.events.length > 0
              ? audit.events
                  .filter((event) => event.actionKey === "control_surface_layout.publish")
                  .map((event) => (
                    <span key={event.id}>
                      {event.id}: {event.actionKey} / {event.target.entityId}
                    </span>
                  ))
              : "Пока нет событий"}
          </div>
          <p data-testid="saved-view-layout-result">
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
