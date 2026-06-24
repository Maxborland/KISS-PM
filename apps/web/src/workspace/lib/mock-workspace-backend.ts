/* ============================================================
   Contract-grounded mock backend для домашних экранов рабочей области
   (Storybook): /api/workspace/{projects, projects/:id, my-work,
   projects/:id/tasks/:taskId/status}.

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт
   projectIntakeRoutes (GET /projects → active) и projectWorkRoutes
   (GET /projects/:id → {project,tasks}; GET /my-work → {tasks};
   PATCH /projects/:id/tasks/:taskId/status → {task}). Компонент работает
   через настоящий createWorkspaceClient (с fetchImpl), поэтому
   переключение на боевой API = смена apiOrigin.

   Это набор list/get/transition-хендлеров над in-memory массивами, а НЕ
   движок. Коды/статусы/порядок проверок зеркалят apps/api:
   - порядок параметров/тела: param 400 → (сессия 401, в моке опускается)
     → body 400 → резолв 404 → доменные 409/400.
   - смена статуса: целевой статус active иначе 400 task_status_not_found;
     запрет перехода 409 task_status_transition_not_allowed; приёмка
     409 task_acceptance_required (как isTaskStatusTransitionAllowed /
     transitionTaskStatus боевого taskLifecycleCommands).

   УПРОЩЕНИЕ RBAC: мок не моделирует сессию/профиль (нет 401 session_required
   и 403 *_required) — Storybook рендерит «авторизованного» актора. Все
   read-роуты доступны; смена статуса разрешена (актор = участник-исполнитель
   своих задач). Боевой слой добавит 401/403 поверх этих же кодов.

   СОГЛАСОВАННОСТЬ С DELIVERY: проект MOCK_PROJECT_ID, его название, старт и
   срок взяты из apps/web/src/delivery/lib/mock-planning-backend.ts
   (PROJECT_ID="proj-prod-portal-r2", title "Производственный портал · Релиз 2",
   старт 2026-03-02, дедлайн 2026-07-12, источник opp-2207) и из CRM-мока
   (client-romashka «ООО «Ромашка»», contractValue 4 800 000). Задачи проекта
   и my-work правдоподобны и не противоречат планировочным.
   ============================================================ */

import type {
  ProjectRecord,
  TaskParticipant,
  TaskPriority,
  TaskRecord,
  TaskStatusCategory
} from "./workspace-client";

const TENANT = "tenant-alpha";
// Текущий пользователь рабочей области (актор сессии): в моке фиксирован.
// Совпадает с исполнителем «своих» задач (my-work) и участником project-detail.
export const CURRENT_USER_ID = "u-petrov";

// Проект, согласованный с Project Delivery (mock-planning-backend.PROJECT_ID).
export const MOCK_PROJECT_ID = "proj-prod-portal-r2";

// Формат идентификатора маршрута (зеркало parseProjectIdParam/parseTaskIdParam: [a-z0-9][a-z0-9_-]{2,119}).
const ROUTE_ID_RE = /^[a-z0-9][a-z0-9_-]{2,119}$/;
// Формат идентификатора статуса в теле (зеркало isSafeIdentifier из projectWorkParsers: [a-z0-9][a-z0-9_-]{2,119}).
const STATUS_ID_RE = /^[a-z0-9][a-z0-9_-]{2,119}$/;

/* ---- Системные статусы задач (persistence.TaskStatusRecord; категории фиксированы) ----
   Боевой эквивалент: GET /api/workspace/task-statuses. Здесь — фиксированный сид
   системных статусов с категориями, на которые ссылаются задачи и смена статуса. */
export type WorkspaceTaskStatus = { id: string; name: string; category: TaskStatusCategory; sortOrder: number; isSystem: boolean };
export const TASK_STATUSES: WorkspaceTaskStatus[] = [
  { id: "status-new", name: "Новая", category: "new", sortOrder: 1, isSystem: true },
  { id: "status-waiting", name: "Ожидание", category: "waiting", sortOrder: 2, isSystem: true },
  { id: "status-in-progress", name: "В работе", category: "in_progress", sortOrder: 3, isSystem: true },
  { id: "status-review", name: "На проверке", category: "review", sortOrder: 4, isSystem: true },
  { id: "status-done", name: "Готово", category: "done", sortOrder: 5, isSystem: true }
];
const statusById = (id: string) => TASK_STATUSES.find((s) => s.id === id);

/* ---- Пользователи рабочей области — справочные данные для отображения исполнителя/заказчика.
   Боевой эквивалент: /api/workspace/users. Экспортируем (как RESOURCES/CRM_USERS). ---- */
export type WorkspaceUser = { id: string; name: string };
export const WORKSPACE_USERS: WorkspaceUser[] = [
  { id: "u-petrov", name: "Петров А." }, // текущий пользователь
  { id: "u-ivanova", name: "Иванова М." },
  { id: "u-sergeev", name: "Сергеев П." },
  { id: "u-mikhail", name: "Михаил К." },
  { id: "u-kuznetsov", name: "Кузнецов Н." }
];

const nowIso = () => new Date().toISOString();
let SEQ = 0;
const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(SEQ += 1).toString(36)}`;

type Store = {
  projects: ProjectRecord[];
  tasks: TaskRecord[]; // все задачи всех проектов (фильтруются по проекту / по исполнителю)
};

// Переход разрешён (зеркало isTaskStatusTransitionAllowed из taskCommandGuards).
const ALLOWED_TRANSITIONS: Record<TaskStatusCategory, TaskStatusCategory[]> = {
  new: ["waiting", "in_progress"],
  waiting: ["in_progress"],
  in_progress: ["waiting", "review", "done"],
  review: ["in_progress", "done"],
  done: []
};
const isTransitionAllowed = (from: TaskStatusCategory, to: TaskStatusCategory): boolean => ALLOWED_TRANSITIONS[from].includes(to);

function seed(): Store {
  const created = "2026-03-02T08:00:00.000Z";

  // Дефолты проекта; обязательные id/title/clientName и переопределения приходят из over (спред — последним).
  const project = (over: Partial<ProjectRecord> & Pick<ProjectRecord, "id" | "title" | "clientName">): ProjectRecord => ({
    tenantId: TENANT, sourceType: "opportunity", sourceOpportunityId: null,
    clientId: null, projectTypeId: "pt-impl", status: "active",
    plannedStart: "2026-03-02", plannedFinish: "2026-07-12", contractValue: 0, plannedHours: 0, templateId: null,
    createdAt: created, activatedAt: created, closedAt: null, demand: [],
    ...over
  });

  const projects: ProjectRecord[] = [
    // 1) Согласован с Project Delivery: тот же id/название/старт/срок/источник/клиент/контракт, что в planning + CRM-моках.
    project({
      id: MOCK_PROJECT_ID, title: "Производственный портал · Релиз 2", clientName: "ООО «Ромашка»",
      sourceOpportunityId: "opp-2207", clientId: "client-romashka",
      plannedStart: "2026-03-02", plannedFinish: "2026-07-12", contractValue: 4_800_000, plannedHours: 1200,
      demand: [{ positionId: "backend", requiredHours: 700 }, { positionId: "frontend", requiredHours: 320 }]
    }),
    project({
      id: "proj-loyalty", title: "Платформа лояльности", clientName: "Гамма Системс",
      sourceOpportunityId: "opp-gamma-contract", clientId: "client-gamma",
      plannedStart: "2026-03-10", plannedFinish: "2026-08-20", contractValue: 2_800_000, plannedHours: 700,
      demand: [{ positionId: "backend", requiredHours: 700 }]
    }),
    project({
      id: "proj-self-service-portal", title: "Портал самообслуживания", clientName: "АО «Север»",
      sourceOpportunityId: "opp-sever-portal", clientId: "client-sever",
      plannedStart: "2026-01-15", plannedFinish: "2026-04-30", contractValue: 3_300_000, plannedHours: 825,
      demand: [{ positionId: "frontend", requiredHours: 800 }]
    }),
    project({
      id: "proj-bi-sales", title: "BI-витрина продаж", clientName: "Гамма Системс",
      sourceOpportunityId: "opp-gamma-bi", clientId: "client-gamma",
      plannedStart: "2026-04-20", plannedFinish: "2026-07-30", contractValue: 1_950_000, plannedHours: 464,
      demand: [{ positionId: "backend", requiredHours: 460 }]
    })
  ];

  // Конструктор задачи. status === категория целевого статуса (как боевой TaskRecord).
  const task = (o: {
    id: string; projectId: string; title: string; statusId: string;
    priority?: TaskPriority; ownerUserId: string; requesterUserId?: string;
    plannedStart: string; plannedFinish: string; durationWorkingDays: number; plannedWork: number; actualWork?: number; progress?: number;
    requiresAcceptance?: boolean; description?: string | null; participants?: TaskParticipant[];
  }): TaskRecord => {
    const st = statusById(o.statusId)!;
    const requesterUserId = o.requesterUserId ?? "u-petrov";
    const participants: TaskParticipant[] = o.participants ?? [
      { userId: o.ownerUserId, role: "executor" },
      { userId: requesterUserId, role: "requester" }
    ];
    return {
      id: o.id, tenantId: TENANT, projectId: o.projectId, stageId: null,
      title: o.title, description: o.description ?? null,
      status: st.category, statusId: st.id, statusName: st.name, statusCategory: st.category,
      priority: o.priority ?? "normal", requesterUserId, ownerUserId: o.ownerUserId,
      plannedStart: o.plannedStart, plannedFinish: o.plannedFinish,
      durationWorkingDays: o.durationWorkingDays, plannedWork: o.plannedWork, actualWork: o.actualWork ?? 0, progress: o.progress ?? 0,
      requiresAcceptance: o.requiresAcceptance ?? false, source: "manual",
      createdAt: created, updatedAt: created, archivedAt: null, participants
    };
  };

  // Задачи: my-work — задачи текущего пользователя (u-petrov исполнитель) по РАЗНЫМ проектам/статусам/срокам.
  // Часть задач проекта MOCK_PROJECT_ID назначена другим — чтобы project-detail был шире my-work.
  const tasks: TaskRecord[] = [
    // --- proj-prod-portal-r2 (MOCK_PROJECT_ID): задачи, согласованные с планом релиза 2 ---
    // my-work (u-petrov):
    task({ id: "task-r2-requirements", projectId: MOCK_PROJECT_ID, title: "Согласовать требования", statusId: "status-done", ownerUserId: "u-petrov", priority: "high", plannedStart: "2026-03-02", plannedFinish: "2026-03-13", durationWorkingDays: 10, plannedWork: 80, actualWork: 80, progress: 100 }),
    task({ id: "task-r2-client-signoff", projectId: MOCK_PROJECT_ID, title: "Согласовать макеты с клиентом", statusId: "status-in-progress", ownerUserId: "u-petrov", priority: "high", plannedStart: "2026-03-16", plannedFinish: "2026-04-03", durationWorkingDays: 14, plannedWork: 64, actualWork: 30, progress: 45 }),
    task({ id: "task-r2-acceptance", projectId: MOCK_PROJECT_ID, title: "Приёмка релиза 2", statusId: "status-review", ownerUserId: "u-petrov", priority: "critical", requiresAcceptance: true, plannedStart: "2026-07-01", plannedFinish: "2026-07-12", durationWorkingDays: 8, plannedWork: 40, actualWork: 36, progress: 90 }),
    // другие исполнители (НЕ в my-work, но в project-detail):
    task({ id: "task-r2-backend-engine", projectId: MOCK_PROJECT_ID, title: "Планировочный движок", statusId: "status-in-progress", ownerUserId: "u-sergeev", priority: "high", plannedStart: "2026-04-06", plannedFinish: "2026-05-29", durationWorkingDays: 39, plannedWork: 312, actualWork: 180, progress: 58 }),
    task({ id: "task-r2-frontend-gantt", projectId: MOCK_PROJECT_ID, title: "WBS + Gantt", statusId: "status-in-progress", ownerUserId: "u-mikhail", priority: "normal", plannedStart: "2026-05-04", plannedFinish: "2026-07-06", durationWorkingDays: 46, plannedWork: 320, actualWork: 120, progress: 38 }),
    task({ id: "task-r2-load-testing", projectId: MOCK_PROJECT_ID, title: "Нагрузочное тестирование", statusId: "status-new", ownerUserId: "u-kuznetsov", priority: "normal", plannedStart: "2026-06-15", plannedFinish: "2026-07-10", durationWorkingDays: 22, plannedWork: 96, actualWork: 0, progress: 0 }),

    // --- proj-loyalty: my-work (u-petrov) ---
    task({ id: "task-loyalty-integration", projectId: "proj-loyalty", title: "Интеграция бонусного контура", statusId: "status-new", ownerUserId: "u-petrov", priority: "normal", plannedStart: "2026-03-23", plannedFinish: "2026-04-10", durationWorkingDays: 15, plannedWork: 90, actualWork: 0, progress: 0 }),
    task({ id: "task-loyalty-waiting-data", projectId: "proj-loyalty", title: "Ожидание выгрузки клиентской базы", statusId: "status-waiting", ownerUserId: "u-petrov", priority: "low", plannedStart: "2026-03-16", plannedFinish: "2026-03-20", durationWorkingDays: 5, plannedWork: 16, actualWork: 4, progress: 10 }),

    // --- proj-self-service-portal: my-work (u-petrov) ---
    task({ id: "task-ssp-handover", projectId: "proj-self-service-portal", title: "Передача в эксплуатацию", statusId: "status-done", ownerUserId: "u-petrov", priority: "normal", plannedStart: "2026-04-20", plannedFinish: "2026-04-30", durationWorkingDays: 8, plannedWork: 48, actualWork: 48, progress: 100 }),
    task({ id: "task-ssp-acceptance", projectId: "proj-self-service-portal", title: "Финальная приёмка портала", statusId: "status-in-progress", ownerUserId: "u-petrov", priority: "high", requiresAcceptance: true, plannedStart: "2026-04-22", plannedFinish: "2026-04-29", durationWorkingDays: 6, plannedWork: 32, actualWork: 20, progress: 60 }),

    // --- proj-bi-sales: my-work (u-petrov) ---
    task({ id: "task-bi-discovery", projectId: "proj-bi-sales", title: "Сбор требований к витрине", statusId: "status-in-progress", ownerUserId: "u-petrov", priority: "normal", plannedStart: "2026-04-20", plannedFinish: "2026-05-08", durationWorkingDays: 15, plannedWork: 72, actualWork: 24, progress: 30 }),
    // другой исполнитель (только в project-detail proj-bi-sales):
    task({ id: "task-bi-etl", projectId: "proj-bi-sales", title: "ETL-конвейер продаж", statusId: "status-new", ownerUserId: "u-sergeev", priority: "normal", plannedStart: "2026-05-11", plannedFinish: "2026-06-19", durationWorkingDays: 30, plannedWork: 200, actualWork: 0, progress: 0 })
  ];

  return { projects, tasks };
}

/* ---- Транспорт: fetchImpl, совместимый с createWorkspaceClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function createMockWorkspaceFetch(): typeof fetch {
  const db = seed();

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    if (init?.body) { try { const p: unknown = JSON.parse(String(init.body)); if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>; } catch { return err("invalid_json", 400); } }

    /* ---- GET /api/workspace/projects: только активные (как боевой projectIntakeRoutes.filter status==="active") ---- */
    if (method === "GET" && path === "/api/workspace/projects") {
      return json({ projects: db.projects.filter((p) => p.status === "active") });
    }

    /* ---- GET /api/workspace/my-work: задачи текущего пользователя (исполнитель = CURRENT_USER_ID) ---- */
    if (method === "GET" && path === "/api/workspace/my-work") {
      const tasks = db.tasks.filter((t) => t.archivedAt === null && t.ownerUserId === CURRENT_USER_ID);
      return json({ tasks });
    }

    /* ---- GET /api/workspace/projects/:projectId: проект + его задачи; 404 на чужой/неактивный ---- */
    const projectDetail = method === "GET" ? path.match(/^\/api\/workspace\/projects\/([^/]+)$/) : null;
    if (projectDetail) {
      const projectId = decodeURIComponent(projectDetail[1]!);
      if (!ROUTE_ID_RE.test(projectId)) return err("invalid_project_id", 400); // формат параметра до резолва
      const project = db.projects.find((p) => p.id === projectId && p.status === "active"); // только активный (как findActiveProject)
      if (!project) return err("project_not_found", 404);
      const tasks = db.tasks.filter((t) => t.archivedAt === null && t.projectId === project.id);
      return json({ project, tasks });
    }

    /* ---- PATCH /api/workspace/projects/:projectId/tasks/:taskId/status ---- */
    const taskStatus = method === "PATCH" ? path.match(/^\/api\/workspace\/projects\/([^/]+)\/tasks\/([^/]+)\/status$/) : null;
    if (taskStatus) {
      const projectId = decodeURIComponent(taskStatus[1]!);
      const taskId = decodeURIComponent(taskStatus[2]!);
      // Порядок как боевой роут: param projectId → param taskId → body → резолв проекта → задачи → статуса → правила перехода.
      if (!ROUTE_ID_RE.test(projectId)) return err("invalid_project_id", 400);
      if (!ROUTE_ID_RE.test(taskId)) return err("invalid_task_id", 400);
      // Тело: statusId (или alias status). Формат идентификатора и запрет "cancelled" (как parseUpdateTaskStatusBody).
      const statusId = str(body.statusId) || str(body.status);
      if (!STATUS_ID_RE.test(statusId) || statusId === "cancelled") return err("invalid_task_status", 400);
      // Активный проект (как findActiveProject).
      const project = db.projects.find((p) => p.id === projectId && p.status === "active");
      if (!project) return err("project_not_found", 404);
      // Задача в этом проекте (как listProjectTasks.find).
      const task = db.tasks.find((t) => t.id === taskId && t.projectId === project.id && t.archivedAt === null);
      if (!task) return err("task_not_found", 404);
      // Целевой статус существует и активен (как listTaskStatuses.find active). 400 task_status_not_found.
      const target = statusById(statusId);
      if (!target) return err("task_status_not_found", 400);
      // Правило перехода (как isTaskStatusTransitionAllowed). 409 task_status_transition_not_allowed.
      if (!isTransitionAllowed(task.status, target.category)) return err("task_status_transition_not_allowed", 409);
      // Приёмка: задача с requiresAcceptance, переход в done — в моке актор=участник, право приёмки есть.
      // (Боевой 409 task_acceptance_required возникает, когда у актора нет права приёмки; в моке упрощено.)
      // Применяем переход: статус + прогресс (done → 100, иначе сохраняем).
      task.status = target.category; task.statusId = target.id; task.statusName = target.name; task.statusCategory = target.category;
      if (target.category === "done") task.progress = 100;
      else if (target.category === "new") task.progress = 0;
      task.updatedAt = nowIso();
      return json({ task });
    }

    return err("not_found", 404);
  };

  return mockFetch;
}
