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

export type TaskDetailResponse = {
  task: TaskRecord;
  projectId: string;
  // Fail-soft: null, если проект недоступен (карточка задачи остаётся читаемой).
  projectName: string | null;
  activities: TaskActivityRecord[];
  attachmentItems: unknown[];
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

export function createWorkspaceClient(options: WorkspaceApiClientOptions) {
  const requestJson = createRequestJson(options);

  const enc = encodeURIComponent;
  return {
    // Активные проекты рабочей области (GET /api/workspace/projects → только status==="active").
    listProjects() { return requestJson<{ projects: ProjectRecord[] }>("/api/workspace/projects"); },
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
