import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  CustomFieldAuditDto,
  CustomFieldBuilderApiClient,
  CustomFieldDefinitionDraftDto,
  CustomFieldPreviewDto
} from "./customFieldBuilderApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

type CustomFieldBuilderSurfaceProps = {
  apiClient: CustomFieldBuilderApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type DraftState = {
  label: string;
  key: string;
  options: string;
  projectId: string;
  value: string;
};

type PendingCommand = "preview" | "publish" | "write-value" | "refresh" | null;

const queryKeys = {
  registry: (testUser: string) => ["custom-field-builder", testUser, "registry"] as const,
  surface: (testUser: string, canReadSurface: boolean) => ["custom-field-builder", testUser, "surface", { canReadSurface }] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["custom-field-builder", testUser, "audit", { canReadAudit }] as const
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

function latestCustomFieldAction(audit: CustomFieldAuditDto): TenantLabelActionExecutionDto | null {
  return (
    audit.actionExecutions
      .filter((entry) => entry.commandType === "custom_field.publish" || entry.commandType === "project.custom_field.set")
      .at(-1) ?? null
  );
}

function draftOptions(draft: DraftState): string[] {
  return draft.options
    .split(",")
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
}

function createCustomFieldDraft(draft: DraftState): CustomFieldDefinitionDraftDto {
  return {
    id: `cf-project-${draft.key}`,
    targetEntityType: "project",
    key: draft.key,
    label: draft.label,
    valueType: "single_select",
    required: false,
    active: true,
    validationRules: { options: draftOptions(draft) },
    visibilityRules: [{ surfaceKey: "portfolio.control", visible: true }],
    permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
    bindingFlags: {
      usableInFilters: true,
      usableInControlSurfaces: true,
      usableInKpiSourceBindings: false
    }
  };
}

function actionExecutionLine(actionExecution: TenantLabelActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function defaultDraft(): DraftState {
  return {
    label: "Уровень риска",
    key: "risk_level",
    options: "low, medium, high",
    projectId: "project-p10-custom-field",
    value: "high"
  };
}

function PreviewPanel({ preview }: { preview: CustomFieldPreviewDto }) {
  return (
    <section className="phase2-panel preview-panel" data-testid="custom-field-preview">
      <h3>Предпросмотр поля</h3>
      <p>Состояние еще не изменено. Публикация пойдет через управляемую команду.</p>
      <dl className="compact-facts">
        <div>
          <dt>Версия до</dt>
          <dd>{preview.before.registryVersion}</dd>
        </div>
        <div>
          <dt>Версия после</dt>
          <dd>{preview.after.registryVersion}</dd>
        </div>
        <div>
          <dt>Поле</dt>
          <dd>
            {preview.definition.label} / {preview.definition.key}
          </dd>
        </div>
        <div>
          <dt>Поверхности</dt>
          <dd>{preview.affectedRuntimeSurfaces.join(", ")}</dd>
        </div>
      </dl>
    </section>
  );
}

export function CustomFieldBuilderSurface({ apiClient, currentTenant, testUser }: CustomFieldBuilderSurfaceProps) {
  const canReadConfig = hasPermission(currentTenant, "tenant.config.read");
  const canWriteConfig = hasPermission(currentTenant, "tenant.config.write");
  const canWriteCustomField = hasPermission(currentTenant, "custom_field.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canReadSurface = hasPermission(currentTenant, "control.surface:read");
  const canPublish = canWriteConfig && canWriteCustomField;
  const [draft, setDraft] = useState<DraftState>(() => defaultDraft());
  const [preview, setPreview] = useState<CustomFieldPreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка пользовательских полей");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastActionExecution, setLastActionExecution] = useState<TenantLabelActionExecutionDto | null>(null);
  const registryQuery = useQuery({
    queryKey: queryKeys.registry(testUser),
    queryFn: () => apiClient.getCustomFieldRegistry(testUser),
    enabled: canReadConfig,
    retry: false
  });
  const surfaceQuery = useQuery({
    queryKey: queryKeys.surface(testUser, canReadSurface),
    queryFn: () => apiClient.getPortfolioSurfaceView(testUser),
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
    mutationFn: () =>
      apiClient.previewCustomField(testUser, {
        expectedRegistryVersion: registryQuery.data?.registry.version ?? 1,
        draft: createCustomFieldDraft(draft),
        affectedRuntimeSurfaces: ["portfolio.control"]
      })
  });
  const publishMutation = useMutation({
    mutationFn: (previewId: string) => apiClient.publishCustomField(testUser, { previewId })
  });
  const valueMutation = useMutation({
    mutationFn: () => apiClient.setProjectCustomFieldValue(testUser, draft.projectId, draft.key, { value: draft.value })
  });
  const registry = registryQuery.data?.registry;
  const surface = surfaceQuery.data;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestCustomFieldAction(audit);
  const commandInFlight = pendingCommand !== null;
  const customFieldRows =
    surface?.rows.filter((row) => row.fieldValues[`custom.${draft.key}`] !== undefined && row.entityType === "project") ?? [];
  const displayStatus =
    registryQuery.isFetching && registry === undefined
      ? "Загрузка пользовательских полей"
      : status === "Загрузка пользовательских полей"
        ? "Реестр загружен из API"
        : status;

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      registryQuery.refetch({ throwOnError: true }),
      canReadSurface ? surfaceQuery.refetch({ throwOnError: true }) : Promise.resolve(),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runPreview() {
    if (commandInFlight || registry === undefined) return;
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
    setStatus("Публикуем поле");
    try {
      const result = await publishMutation.mutateAsync(preview.id);
      await refetchReadModel("Поле опубликовано и перечитано из API");
      setPreview(null);
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Публикация отклонена");
    } finally {
      setPendingCommand(null);
    }
  }

  async function writeProjectValue() {
    if (commandInFlight) return;
    setPendingCommand("write-value");
    setCommandError("");
    setStatus("Записываем значение проекта");
    try {
      const result = await valueMutation.mutateAsync();
      await refetchReadModel("Значение записано и поверхность перечитана из API");
      setLastActionExecution(result.result.actionExecution);
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Запись значения отклонена");
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

  if (!canReadConfig) {
    return (
      <section className="phase2-surface" data-testid="custom-field-builder-surface">
        <div className="readonly-notice" data-testid="custom-field-readonly">
          Нет разрешения tenant.config.read для просмотра пользовательских полей.
        </div>
      </section>
    );
  }

  return (
    <section className="phase2-surface" data-testid="custom-field-builder-surface" id="custom-field-builder">
      <div className="surface-heading">
        <div>
          <h2>Конструктор пользовательских полей</h2>
          <p>Поле проекта связывается с контрольной поверхностью только через preview и publish.</p>
        </div>
        <p className="status-pill" data-testid="custom-field-status">
          {displayStatus}
        </p>
      </div>

      {!canPublish ? (
        <p className="readonly-notice" data-testid="custom-field-readonly">
          Режим чтения: для публикации нужны tenant.config.write и custom_field.write.
        </p>
      ) : null}

      {registryQuery.isError ? (
        <p className="readonly-notice" data-testid="custom-field-error">
          {getErrorMessage(registryQuery.error)}
        </p>
      ) : null}
      {commandError ? (
        <p className="readonly-notice" data-testid="custom-field-command-error">
          {commandError}
        </p>
      ) : null}

      <div className="phase2-grid custom-field-layout">
        <section className="phase2-panel">
          <h3>Реестр</h3>
          <div className="compact-list" data-testid="custom-field-registry">
            {registry === undefined
              ? "Загрузка"
              : registry.definitions.length === 0
                ? "Нет опубликованных полей"
                : registry.definitions.map((definition) => (
                    <span key={definition.id}>
                      {definition.label}: {definition.key} / v{definition.version}
                    </span>
                  ))}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Черновик поля</h3>
          <label className="field-stack">
            <span>Название поля</span>
            <input
              aria-label="Название поля"
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              value={draft.label}
            />
          </label>
          <label className="field-stack">
            <span>Ключ поля</span>
            <input
              aria-label="Ключ поля"
              onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))}
              value={draft.key}
            />
          </label>
          <label className="field-stack">
            <span>Варианты</span>
            <input
              aria-label="Варианты"
              onChange={(event) => setDraft((current) => ({ ...current, options: event.target.value }))}
              value={draft.options}
            />
          </label>
          {canPublish ? (
            <div className="button-row">
              <button disabled={commandInFlight || registry === undefined} type="button" onClick={() => void runPreview()}>
                Предпросмотр
              </button>
              <button disabled={commandInFlight || preview === null} type="button" onClick={() => void publishPreview()}>
                Опубликовать
              </button>
              <button disabled={commandInFlight} type="button" onClick={() => void refresh()}>
                Обновить
              </button>
            </div>
          ) : null}
        </section>

        {preview ? <PreviewPanel preview={preview} /> : null}

        <section className="phase2-panel">
          <h3>Значение проекта</h3>
          <label className="field-stack">
            <span>Проект</span>
            <input
              aria-label="Проект для значения"
              onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))}
              value={draft.projectId}
            />
          </label>
          <label className="field-stack">
            <span>Значение</span>
            <select
              aria-label="Значение поля"
              onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              value={draft.value}
            >
              {draftOptions(draft).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {canWriteCustomField ? (
            <button disabled={commandInFlight || registry?.definitions.find((definition) => definition.key === draft.key) === undefined} type="button" onClick={() => void writeProjectValue()}>
              Записать значение
            </button>
          ) : null}
        </section>

        <section className="phase2-panel">
          <h3>Поверхность портфеля</h3>
          <div className="compact-list" data-testid="custom-field-surface-readback">
            {surfaceQuery.isError
              ? getErrorMessage(surfaceQuery.error)
              : customFieldRows.length === 0
                ? "Значение еще не видно в поверхности"
                : customFieldRows.map((row) => (
                    <span key={row.id}>
                      {row.label}: {String(row.fieldValues[`custom.${draft.key}`])}
                    </span>
                  ))}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Аудит</h3>
          <div className="compact-list" data-testid="custom-field-audit">
            {audit.events.length > 0
              ? audit.events
                  .filter((event) => event.actionKey === "custom_field.publish" || event.actionKey === "project.custom_field.set")
                  .map((event) => (
                    <span key={event.id}>
                      {event.id}: {event.actionKey} / {event.target.entityId}
                    </span>
                  ))
              : "Пока нет событий"}
          </div>
          <p data-testid="custom-field-result">
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
