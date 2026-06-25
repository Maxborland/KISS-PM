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

export type WorkspaceApiClientOptions = { apiOrigin: string; fetchImpl?: typeof fetch; credentials?: RequestCredentials };

export class WorkspaceApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;
  constructor(status: number, code: string, body: Record<string, unknown>) {
    super(code);
    this.name = "WorkspaceApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

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
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${options.apiOrigin}${path}`, {
      ...init,
      credentials,
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", ...(init?.headers ?? {}) }
    });
    const rawText = await response.text();
    let body: Record<string, unknown> = {};
    if (rawText.length > 0) {
      try {
        const parsed: unknown = JSON.parse(rawText);
        body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { error: "invalid_json_response" };
      } catch {
        body = { error: "invalid_json_response" };
      }
    }
    if (!response.ok) {
      throw new WorkspaceApiError(response.status, typeof body.error === "string" ? body.error : "request_failed", body);
    }
    return body as T;
  }

  const enc = encodeURIComponent;
  return {
    // Активные проекты рабочей области (GET /api/workspace/projects → только status==="active").
    listProjects() { return requestJson<{ projects: ProjectRecord[] }>("/api/workspace/projects"); },
    // Карточка проекта + его задачи (GET /api/workspace/projects/:projectId). 404 на чужой/неактивный.
    getProjectDetail(projectId: string) { return requestJson<{ project: ProjectRecord; tasks: TaskRecord[] }>(`/api/workspace/projects/${enc(projectId)}`); },
    // Задачи текущего пользователя по всем проектам (GET /api/workspace/my-work).
    listMyWork() { return requestJson<{ tasks: TaskRecord[] }>("/api/workspace/my-work"); },
    // Смена статуса задачи (PATCH /api/workspace/projects/:projectId/tasks/:taskId/status, тело {statusId}).
    updateTaskStatus(projectId: string, taskId: string, statusId: string) {
      return requestJson<{ task: TaskRecord }>(`/api/workspace/projects/${enc(projectId)}/tasks/${enc(taskId)}/status`, { method: "PATCH", body: JSON.stringify({ statusId }) });
    }
  };
}

export type WorkspaceClient = ReturnType<typeof createWorkspaceClient>;
