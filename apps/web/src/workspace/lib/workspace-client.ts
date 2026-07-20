/* ============================================================
   Workspace API client — тонкий типизированный клиент над REST-ручками
   домашних экранов: /api/workspace/{projects, projects/:id, my-work,
   projects/:id/tasks/:taskId/status}.

   Зеркало createCrmClient (crm-client) и createPlanningApiClient: тот же
   приём с инъекцией fetchImpl, теми же заголовками (x-kiss-pm-action:
   same-origin) и credentials. Переключение на боевой API = передать
   реальный apiOrigin и убрать fetchImpl-мок.

   ВАЖНО: домашние экраны — read-mostly + одна мутация (per-task смена
   статуса PATCH .../tasks/:taskId/status). Plan-version в ответ статуса
   боевой роут НЕ кладёт в {task}, поэтому здесь optimistic-concurrency нет.
   ============================================================ */

import type { OrgCapacityTree } from "@kiss-pm/domain";

import { createRequestJson, DomainApiError, type DomainClientOptions } from "../../lib/domain-client";

export type WorkspaceApiClientOptions = DomainClientOptions;

// Общий класс ошибки транспорта; алиас сохраняет прежнее имя для instanceof-проверок.
export { DomainApiError as WorkspaceApiError };

/* ---- View-типы (форма боевых записей; даты пересекают провод как ISO-строки) ----
   Локальные сериализованные зеркала apiTypes.ProjectRecord и
   persistence.TaskRecord/TaskStatusRecord (даты Date → ISO-строка), как
   сделано в crm-client. */

// Категория системного статуса задачи (persistence.TaskStatusCategory).
export type TaskStatusCategory = "new" | "waiting" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskSource = "manual";
export type TaskParticipantRole = "executor" | "co_executor" | "requester" | "controller" | "approver" | "observer";
export type TaskParticipant = { userId: string; role: TaskParticipantRole };
// Справочные контракты домашних экранов (GET /api/workspace/users, /task-statuses).
// Боевой ответ — суперсет (tenantId/createdAt/…); структурно совместим.
export type WorkspaceUser = { id: string; name: string };
// status: active|archived — жизненный цикл записи справочника (боевой TaskStatusRecord.status).
export type WorkspaceTaskStatus = { id: string; name: string; category: TaskStatusCategory; sortOrder: number; isSystem: boolean; status: "active" | "archived" };
// Тело создания/правки записи справочника статусов (боевой parseCreateTaskStatusBody):
// id обязателен при создании (слаг генерирует клиент), при PATCH подставляется из URL.
export type TaskStatusDefinitionInput = {
  id: string;
  name: string;
  category: TaskStatusCategory;
  sortOrder: number;
  status?: "active" | "archived";
};

// Серилизованная задача (persistence.TaskRecord; даты ISO). status === statusCategory (категория системного статуса).
export type TaskRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatusCategory;
  statusId: string;
  statusName: string;
  statusCategory: TaskStatusCategory;
  priority: TaskPriority;
  requesterUserId: string;
  ownerUserId: string;
  plannedStart: string;
  plannedFinish: string;
  durationWorkingDays: number;
  plannedWork: number;
  actualWork: number;
  progress: number;
  requiresAcceptance: boolean;
  source: TaskSource;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  participants: TaskParticipant[];
};

export type TaskActivityRecord = {
  id: string;
  taskId: string;
  type: "comment" | "file" | "system";
  body: string | null;
  title: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
};

/* ---- Вложения задачи (сериализованное зеркало attachmentSerialization.serializeAttachment) ----
   Ответ GET /api/workspace/attachments и POST …/files / DELETE …/:id несёт эту форму под
   ключом attachment(s); в карточке задачи те же записи приходят в TaskDetailResponse.attachmentItems
   (сервер собирает их listAttachmentActivityItems по entityType="task", entityId=taskId). */
export type TaskAttachmentFileAsset = {
  id: string;
  originalName: string;
  safeDisplayName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
  createdAt: string;
};
export type TaskAttachmentExternalReference = {
  id: string;
  connectorType: string;
  externalId: string | null;
  url: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
export type TaskAttachment = {
  id: string;
  entityType: string;
  entityId: string;
  relationType: string;
  kind: "file" | "external_reference";
  fileAsset: TaskAttachmentFileAsset | null;
  externalReference: TaskAttachmentExternalReference | null;
  sourceActivityType: string | null;
  sourceActivityId: string | null;
  createdByUserId: string;
  createdAt: string;
  archivedAt: string | null;
};

export type TaskDetailResponse = {
  task: TaskRecord;
  projectId: string;
  // Fail-soft: null, если проект недоступен (карточка задачи остаётся читаемой).
  projectName: string | null;
  activities: TaskActivityRecord[];
  attachmentItems: TaskAttachment[];
};

export type UpdateTaskInput = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  statusId: string;
  plannedStart: string;
  plannedFinish: string;
  durationWorkingDays: number;
  plannedWork: number;
  requiresAcceptance: boolean;
  participants: TaskParticipant[];
  clientUpdatedAt: string;
};

// Спрос по позиции (apiTypes.PositionDemandRecord).
export type PositionDemand = { positionId: string; requiredHours: number };

// Серилизованный проект (apiTypes.ProjectRecord; даты ISO).
export type ProjectRecord = {
  id: string;
  tenantId: string;
  sourceType: "opportunity" | "workspace_inbox" | "manual";
  sourceOpportunityId: string | null;
  clientId: string | null;
  projectTypeId: string | null;
  title: string;
  clientName: string;
  status: string;
  plannedStart: string;
  plannedFinish: string;
  contractValue: number;
  plannedHours: number;
  templateId: string | null;
  createdAt: string;
  activatedAt: string | null;
  closedAt: string | null;
  demand: PositionDemand[];
};

// Фильтр статуса списка проектов и статусные действия жизненного цикла (Блок 5).
export type ProjectStatusFilter = "active" | "closed" | "paused" | "all";
export type ProjectStatusAction = "reopen" | "pause" | "resume";

// Тело ручного создания проекта. Даты — ISO YYYY-MM-DD (как боевой parseCreateProjectBody).
export type CreateProjectInput = {
  title: string;
  clientName?: string;
  projectTypeId?: string | null;
  templateId?: string | null;
  calendarId?: string | null;
  plannedStart: string;
  plannedFinish: string;
  contractValue?: number;
  plannedHours?: number;
};

// Частичное редактирование параметров проекта.
export type UpdateProjectInput = {
  title?: string;
  projectTypeId?: string | null;
  templateId?: string | null;
  calendarId?: string | null;
};

export function createWorkspaceClient(options: WorkspaceApiClientOptions) {
  const requestJson = createRequestJson(options);
  // Прямой транспорт нужен для вложений: multipart-загрузка (без content-type json) и
  // бинарное скачивание (blob) не проходят через requestJson — как в agent-client.
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  const enc = encodeURIComponent;
  return {
    // Проекты рабочей области (GET /api/workspace/projects). Фильтр статуса:
    // active (по умолчанию) | closed | paused | all — см. projectIntakeRoutes.
    listProjects(status?: ProjectStatusFilter) {
      const query = status && status !== "active" ? `?status=${status}` : "";
      return requestJson<{ projects: ProjectRecord[] }>(`/api/workspace/projects${query}`);
    },
    // Ручное создание внутреннего проекта без сделки (POST /api/workspace/projects → {project}).
    createProject(input: CreateProjectInput) {
      return requestJson<{ project: ProjectRecord }>("/api/workspace/projects", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // Редактирование параметров проекта (PATCH /api/workspace/projects/:projectId → {project}).
    updateProject(projectId: string, input: UpdateProjectInput) {
      return requestJson<{ project: ProjectRecord }>(`/api/workspace/projects/${enc(projectId)}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    },
    // Статусные переходы жизненного цикла (POST …/reopen|pause|resume → {project}).
    setProjectStatus(projectId: string, action: ProjectStatusAction) {
      return requestJson<{ project: ProjectRecord }>(`/api/workspace/projects/${enc(projectId)}/${action}`, {
        method: "POST"
      });
    },
    // Карточка проекта + его задачи (GET /api/workspace/projects/:projectId). 404 на чужой/неактивный.
    getProjectDetail(projectId: string) { return requestJson<{ project: ProjectRecord; tasks: TaskRecord[] }>(`/api/workspace/projects/${enc(projectId)}`); },
    // Задачи текущего пользователя по всем проектам (GET /api/workspace/my-work).
    listMyWork() { return requestJson<{ tasks: TaskRecord[] }>("/api/workspace/my-work"); },
    // Полная карточка задачи (GET /api/workspace/tasks/:taskId).
    getTaskDetail(taskId: string) {
      return requestJson<TaskDetailResponse>(`/api/workspace/tasks/${enc(taskId)}`);
    },
    updateTask(taskId: string, input: UpdateTaskInput) {
      return requestJson<{ task: TaskRecord }>(`/api/workspace/tasks/${enc(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    },
    createTaskComment(taskId: string, body: string) {
      return requestJson<{ activity: TaskActivityRecord }>(`/api/workspace/tasks/${enc(taskId)}/comments`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
    },
    // Вложения задачи (GET /api/workspace/attachments?entityType=task&entityId=…). Сервер связывает
    // вложение с задачей по (entityType="task", entityId=taskId) — тот же контракт, что в attachmentRoutes.
    listTaskAttachments(taskId: string) {
      return requestJson<{ attachments: TaskAttachment[] }>(
        `/api/workspace/attachments?entityType=task&entityId=${enc(taskId)}`
      );
    },
    // Загрузка файла (POST /api/workspace/attachments/files, multipart). content-type НЕ ставим —
    // браузер выставит multipart-boundary сам. relationType по умолчанию "attachment" (сервер).
    async uploadTaskAttachment(taskId: string, file: File): Promise<{ attachment: TaskAttachment }> {
      const form = new FormData();
      form.append("entityType", "task");
      form.append("entityId", taskId);
      form.append("file", file);
      const response = await fetchImpl(`${options.apiOrigin}/api/workspace/attachments/files`, {
        method: "POST",
        credentials,
        headers: { "x-kiss-pm-action": "same-origin" },
        body: form
      });
      const raw = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        const value: unknown = JSON.parse(raw);
        if (value && typeof value === "object") parsed = value as Record<string, unknown>;
      } catch { /* keep */ }
      if (!response.ok) {
        throw new DomainApiError(response.status, typeof parsed.error === "string" ? parsed.error : "upload_failed", parsed);
      }
      return { attachment: parsed.attachment as TaskAttachment };
    },
    // Скачивание файла (GET /api/workspace/attachments/:id/download → бинарь). Возвращаем blob и
    // имя из Content-Disposition — вызывающий слой сам инициирует браузерную загрузку.
    async downloadTaskAttachment(attachmentId: string): Promise<{ blob: Blob; filename: string | null }> {
      const response = await fetchImpl(`${options.apiOrigin}/api/workspace/attachments/${enc(attachmentId)}/download`, {
        method: "GET",
        credentials,
        headers: { "x-kiss-pm-action": "same-origin" }
      });
      if (!response.ok) {
        let code = "download_failed";
        try {
          const value: unknown = JSON.parse(await response.text());
          if (value && typeof value === "object" && typeof (value as Record<string, unknown>).error === "string") {
            code = (value as Record<string, unknown>).error as string;
          }
        } catch { /* keep */ }
        throw new DomainApiError(response.status, code, {});
      }
      const blob = await response.blob();
      return { blob, filename: parseContentDispositionFilename(response.headers.get("content-disposition")) };
    },
    // Удаление вложения (DELETE /api/workspace/attachments/:id → архив, {attachment}).
    deleteTaskAttachment(attachmentId: string) {
      return requestJson<{ attachment: TaskAttachment }>(`/api/workspace/attachments/${enc(attachmentId)}`, {
        method: "DELETE"
      });
    },
    // Смена статуса задачи (PATCH /api/workspace/projects/:projectId/tasks/:taskId/status, тело {statusId}).
    updateTaskStatus(projectId: string, taskId: string, statusId: string) {
      return requestJson<{ task: TaskRecord }>(`/api/workspace/projects/${enc(projectId)}/tasks/${enc(taskId)}/status`, { method: "PATCH", body: JSON.stringify({ statusId }) });
    },
    // Справочник пользователей (GET /api/workspace/users) — резолв исполнителя/заказчика/владельца.
    listUsers() { return requestJson<{ users: WorkspaceUser[] }>("/api/workspace/users"); },
    // Системные статусы задач (GET /api/workspace/task-statuses) — колонки канбана + селект статуса.
    listTaskStatuses() { return requestJson<{ taskStatuses: WorkspaceTaskStatus[] }>("/api/workspace/task-statuses"); },
    // Справочник статусов задач — CRUD поверх taskStatusRoutes (RBAC: tenant.task_statuses.manage).
    createTaskStatusDefinition(input: TaskStatusDefinitionInput) {
      return requestJson<{ taskStatus: WorkspaceTaskStatus }>("/api/workspace/task-statuses", { method: "POST", body: JSON.stringify(input) });
    },
    updateTaskStatusDefinition(statusId: string, input: Omit<TaskStatusDefinitionInput, "id">) {
      return requestJson<{ taskStatus: WorkspaceTaskStatus }>(`/api/workspace/task-statuses/${enc(statusId)}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    // DELETE — это архив (боевой archiveTaskStatus): системные статусы не архивируются (409 system_task_status_required).
    archiveTaskStatusDefinition(statusId: string) {
      return requestJson<{ taskStatus: WorkspaceTaskStatus }>(`/api/workspace/task-statuses/${enc(statusId)}`, { method: "DELETE" });
    },
    // Дерево загрузки ресурсов за месяц (GET /api/workspace/capacity/tree?monthIso=YYYY-MM[&projectId=…]).
    // Ответ — OrgCapacityTree из @kiss-pm/domain как есть (JSON-сериализуемый; недоступные актору
    // проекты в projectsMixByDate сервер уже замаскировал в __hidden__). RBAC:
    // tenant.project_resources.read (401/403 — как у остальных ручек), projectId дополнительно
    // требует tenant.projects.read; невалидный месяц/проект → 400 capacity_invalid_query.
    getCapacityTree(monthIso: string, projectId?: string | null) {
      const projectQuery = projectId ? `&projectId=${enc(projectId)}` : "";
      return requestJson<OrgCapacityTree>(`/api/workspace/capacity/tree?monthIso=${enc(monthIso)}${projectQuery}`);
    }
  };
}

export type WorkspaceClient = ReturnType<typeof createWorkspaceClient>;

// Имя файла из заголовка Content-Disposition (attachment; filename="…"); null, если заголовка нет.
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^"]+?)"?(?:;|$)/i.exec(header);
  return match ? match[1] ?? null : null;
}
