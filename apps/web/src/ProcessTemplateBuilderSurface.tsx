import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ProcessTemplateAuditDto,
  ProcessTemplateBuilderApiClient,
  ProcessTemplateDraftDto,
  ProcessTemplateDto,
  ProcessTemplatePreviewDto
} from "./processTemplateBuilderApiClient";
import type { TenantLabelActionExecutionDto } from "./tenantLabelsApiClient";

type ProcessTemplateBuilderSurfaceProps = {
  apiClient: ProcessTemplateBuilderApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type DraftState = {
  label: string;
  deliveryLabel: string;
  initiationLabel: string;
  deliveryTaskLabel: string;
  deliveryTaskRoles: string;
};

type PendingCommand = "preview" | "publish" | "refresh" | null;

const queryKeys = {
  templates: (testUser: string) => ["process-template-builder", testUser, "templates"] as const,
  audit: (testUser: string, canReadAudit: boolean) =>
    ["process-template-builder", testUser, "audit", { canReadAudit }] as const
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

function latestAction(audit: ProcessTemplateAuditDto): TenantLabelActionExecutionDto | null {
  return audit.actionExecutions.filter((entry) => entry.commandType === "process_template.publish").at(-1) ?? null;
}

function primaryTemplate(readModel: { templates: ProcessTemplateDto[] } | undefined): ProcessTemplateDto | undefined {
  return readModel?.templates[0];
}

function createDraftFromTemplate(template: ProcessTemplateDto | undefined): DraftState {
  const delivery = template?.stages.find((stage) => stage.key === "delivery");
  const initiation = template?.stages.find((stage) => stage.key === "initiation");
  const deliveryTask = delivery?.taskTemplates[0];

  return {
    label: template?.label ?? "Внедрение enterprise",
    deliveryLabel: delivery?.label ?? "Поставка",
    initiationLabel: initiation?.label ?? "Старт",
    deliveryTaskLabel: deliveryTask?.label ?? "Поставить результат",
    deliveryTaskRoles: (deliveryTask?.defaultParticipantRoleKeys ?? ["executor", "controller"]).join(", ")
  };
}

function rolesFromText(value: string): string[] {
  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
}

function createDraftPayload(template: ProcessTemplateDto, draft: DraftState): ProcessTemplateDraftDto {
  const delivery = template.stages.find((stage) => stage.key === "delivery");
  const initiation = template.stages.find((stage) => stage.key === "initiation");
  const deliveryTask = delivery?.taskTemplates[0];
  if (delivery === undefined || initiation === undefined || deliveryTask === undefined) {
    return { label: draft.label };
  }

  return {
    label: draft.label,
    stages: [
      {
        id: delivery.id,
        label: draft.deliveryLabel,
        sortOrder: 10,
        active: true,
        taskTemplates: [
          {
            id: deliveryTask.id,
            label: draft.deliveryTaskLabel,
            defaultParticipantRoleKeys: rolesFromText(draft.deliveryTaskRoles),
            required: deliveryTask.required
          }
        ]
      },
      {
        id: initiation.id,
        label: draft.initiationLabel,
        sortOrder: 20,
        active: true
      }
    ]
  };
}

function actionExecutionLine(actionExecution: TenantLabelActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function StageList({ template }: { template: ProcessTemplateDto }) {
  if (template.stages.length === 0) {
    return (
      <div className="compact-list" data-testid="process-template-empty">
        Нет активных шаблонов. Проверьте конфигурацию процесса.
      </div>
    );
  }

  return (
    <div className="compact-list" data-testid="process-template-stage-list">
      {template.stages.map((stage) => (
        <article className="tenant-label-row" key={stage.id}>
          <span>
            {stage.sortOrder}. {stage.label}
          </span>
          <strong>{stage.key}</strong>
          <small>{stage.taskTemplates.map((task) => `${task.label}: ${task.defaultParticipantRoleKeys.join(",")}`).join(" / ")}</small>
        </article>
      ))}
    </div>
  );
}

function PreviewPanel({ preview }: { preview: ProcessTemplatePreviewDto }) {
  return (
    <section className="phase2-panel preview-panel" data-testid="process-template-preview">
      <h3>Предпросмотр процесса</h3>
      <p>Состояние еще не изменено. Новая версия будет применяться только к будущим проектам.</p>
      <dl className="compact-facts">
        <div>
          <dt>Версия до</dt>
          <dd>{preview.before.templateVersion}</dd>
        </div>
        <div>
          <dt>Версия после</dt>
          <dd>{preview.after.templateVersion}</dd>
        </div>
        <div>
          <dt>Активные проекты</dt>
          <dd>{preview.before.activeProjectTemplateVersions.join(", ") || "нет"}</dd>
        </div>
      </dl>
      <div className="compact-list">
        {preview.stageChanges.map((change) => (
          <span key={change.stageId}>
            {change.stageId}: {change.beforeLabel} {"->"} {change.afterLabel}
          </span>
        ))}
        {preview.taskTemplateChanges.map((change) => (
          <span key={change.taskTemplateId}>
            {change.taskTemplateKey}: {change.beforeDefaultParticipantRoleKeys.join(",")} {"->"}{" "}
            {change.afterDefaultParticipantRoleKeys.join(",")}
          </span>
        ))}
      </div>
    </section>
  );
}

export function ProcessTemplateBuilderSurface({ apiClient, currentTenant, testUser }: ProcessTemplateBuilderSurfaceProps) {
  const canReadConfig = hasPermission(currentTenant, "tenant.config.read");
  const canWriteConfig = hasPermission(currentTenant, "tenant.config.write");
  const canWriteTemplate = hasPermission(currentTenant, "project.template.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canPublish = canWriteConfig && canWriteTemplate;
  const [draft, setDraft] = useState<DraftState>(() => createDraftFromTemplate(undefined));
  const [preview, setPreview] = useState<ProcessTemplatePreviewDto | null>(null);
  const [status, setStatus] = useState("Загрузка шаблонов");
  const [commandError, setCommandError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null);
  const [lastActionExecution, setLastActionExecution] = useState<TenantLabelActionExecutionDto | null>(null);
  const templatesQuery = useQuery({
    queryKey: queryKeys.templates(testUser),
    queryFn: () => apiClient.getProcessTemplates(testUser),
    enabled: canReadConfig,
    retry: false
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getAudit(testUser),
    enabled: canReadConfig && canReadAudit,
    retry: false
  });
  const previewMutation = useMutation({
    mutationFn: (template: ProcessTemplateDto) =>
      apiClient.previewProcessTemplate(testUser, {
        templateId: template.id,
        expectedTemplateVersion: template.version,
        draft: createDraftPayload(template, draft),
        affectedRuntimeSurfaces: ["project.create_from_template", "project.stage.header"]
      })
  });
  const publishMutation = useMutation({
    mutationFn: (request: { templateId: string; previewId: string }) => apiClient.publishProcessTemplate(testUser, request)
  });
  const readModel = templatesQuery.data;
  const template = primaryTemplate(readModel);
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };
  const latestAuditAction = latestAction(audit);
  const commandInFlight = pendingCommand !== null;
  const displayStatus =
    templatesQuery.isFetching && readModel === undefined
      ? "Загрузка шаблонов"
      : status === "Загрузка шаблонов"
        ? "Шаблоны загружены из API"
        : status;

  useEffect(() => {
    if (template === undefined || preview !== null) return;
    setDraft(createDraftFromTemplate(template));
  }, [preview, template]);

  async function refetchReadModel(nextStatus: string) {
    await Promise.all([
      templatesQuery.refetch({ throwOnError: true }),
      canReadAudit ? auditQuery.refetch({ throwOnError: true }) : Promise.resolve()
    ]);
    setStatus(nextStatus);
  }

  async function runPreview() {
    if (commandInFlight || template === undefined) return;
    setPendingCommand("preview");
    setCommandError("");
    setStatus("Готовим предпросмотр");
    try {
      const nextPreview = await previewMutation.mutateAsync(template);
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
    setStatus("Публикуем шаблон");
    try {
      const result = await publishMutation.mutateAsync({
        templateId: preview.before.templateId,
        previewId: preview.id
      });
      await refetchReadModel("Шаблон опубликован и перечитан из API");
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
      await refetchReadModel("Шаблоны обновлены из API");
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
      <section className="tenant-labels-surface" data-testid="process-template-denied" id="process-template-builder">
        <div className="surface-heading">
          <div>
            <h2>Шаблоны процессов</h2>
            <p>Нет доступа к конфигурации тенанта.</p>
          </div>
          <p className="status-pill">Доступ закрыт</p>
        </div>
      </section>
    );
  }

  return (
    <section className="tenant-labels-surface process-template-surface" data-testid="process-template-builder" id="process-template-builder">
      <div className="surface-heading">
        <div>
          <h2>Шаблоны процессов</h2>
          <p>Безопасная публикация версии для будущих проектов без миграции активных.</p>
        </div>
        <p className="status-pill" data-testid="process-template-status">
          {displayStatus}
        </p>
      </div>

      {!canPublish ? (
        <p className="readonly-notice" data-testid="process-template-readonly">
          Публикация недоступна: нужны tenant.config.write и project.template.write.
        </p>
      ) : null}

      {templatesQuery.isError ? (
        <section className="phase2-panel" data-testid="process-template-error">
          <h3>Ошибка загрузки</h3>
          <p>{getErrorMessage(templatesQuery.error)}</p>
          <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
            Обновить
          </button>
        </section>
      ) : template === undefined && readModel !== undefined ? (
        <section className="phase2-panel" data-testid="process-template-empty">
          <h3>Нет активных шаблонов</h3>
          <p>Нет активных шаблонов для редактирования.</p>
        </section>
      ) : (
        <div className="tenant-labels-layout">
          <section className="phase2-panel">
            <h3>Runtime-шаблон</h3>
            {template ? <StageList template={template} /> : <div className="compact-list">Загрузка стадий</div>}
            <div className="button-row">
              <button disabled={commandInFlight} onClick={() => void refresh()} type="button">
                Обновить
              </button>
            </div>
          </section>

          <section className="phase2-panel tenant-labels-editor">
            <h3>Черновик версии</h3>
            <label className="field-stack">
              <span>Название шаблона</span>
              <input
                aria-label="Название шаблона"
                disabled={!canPublish || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, label: event.target.value }));
                }}
                value={draft.label}
              />
            </label>
            <label className="field-stack">
              <span>Стадия поставки</span>
              <input
                aria-label="Стадия поставки"
                disabled={!canPublish || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, deliveryLabel: event.target.value }));
                }}
                value={draft.deliveryLabel}
              />
            </label>
            <label className="field-stack">
              <span>Начальная стадия</span>
              <input
                aria-label="Начальная стадия процесса"
                disabled={!canPublish || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, initiationLabel: event.target.value }));
                }}
                value={draft.initiationLabel}
              />
            </label>
            <label className="field-stack">
              <span>Задача поставки</span>
              <input
                aria-label="Задача поставки"
                disabled={!canPublish || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, deliveryTaskLabel: event.target.value }));
                }}
                value={draft.deliveryTaskLabel}
              />
            </label>
            <label className="field-stack">
              <span>Роли задачи</span>
              <input
                aria-label="Роли задачи поставки"
                disabled={!canPublish || commandInFlight}
                onChange={(event) => {
                  setPreview(null);
                  setDraft((current) => ({ ...current, deliveryTaskRoles: event.target.value }));
                }}
                value={draft.deliveryTaskRoles}
              />
            </label>
            <div className="button-row">
              {canPublish ? (
                <>
                  <button disabled={commandInFlight || template === undefined} onClick={() => void runPreview()} type="button">
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
        <p className="readonly-notice" data-testid="process-template-command-error">
          {commandError}
        </p>
      ) : null}

      <section className="phase2-panel tenant-labels-result-panel">
        <h3>Результат и аудит</h3>
        <div className="compact-list" data-testid="process-template-result">
          {lastActionExecution ? actionExecutionLine(lastActionExecution) : "Команда еще не выполнялась"}
        </div>
        <div className="compact-list" data-testid="process-template-audit">
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
