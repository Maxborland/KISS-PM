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

import {
  buildMonthDays,
  computeHeat,
  rollupOrgCapacityTree,
  type CapacityDayLoad,
  type CapacityMatrixRow,
  type OrgCapacityTree
} from "@kiss-pm/domain";

import type {
  ProjectRecord,
  TaskActivityRecord,
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
export type WorkspaceTaskStatus = { id: string; name: string; category: TaskStatusCategory; sortOrder: number; isSystem: boolean; status: "active" | "archived" };
export const TASK_STATUSES: WorkspaceTaskStatus[] = [
  { id: "status-new", name: "Новая", category: "new", sortOrder: 1, isSystem: true, status: "active" },
  { id: "status-waiting", name: "Ожидание", category: "waiting", sortOrder: 2, isSystem: true, status: "active" },
  { id: "status-in-progress", name: "В работе", category: "in_progress", sortOrder: 3, isSystem: true, status: "active" },
  { id: "status-review", name: "На проверке", category: "review", sortOrder: 4, isSystem: true, status: "active" },
  { id: "status-done", name: "Готово", category: "done", sortOrder: 5, isSystem: true, status: "active" }
];
const statusById = (id: string) => TASK_STATUSES.find((s) => s.id === id);
// Категории статусов (зеркало taskStatusCategories из projectWorkParsers).
const TASK_STATUS_CATEGORIES: readonly TaskStatusCategory[] = ["new", "waiting", "in_progress", "review", "done"];

// Управляющие символы single-line (зеркало isSafeSingleLineText): 0x00–0x1F и 0x7F — по кодам, без литералов.
const hasControlChar = (v: string): boolean => {
  for (let i = 0; i < v.length; i += 1) {
    const c = v.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
};
// Тело create/patch справочника статусов (ДОСЛОВНОЕ зеркало parseCreateTaskStatusBody):
// порядок и коды: id → name (2..80, single-line) → category → sortOrder (int 1..10000) → status.
type ParsedTaskStatusBody =
  | { ok: true; value: { id: string; name: string; category: TaskStatusCategory; sortOrder: number; status: "active" | "archived" } }
  | { ok: false; error: string };
function parseTaskStatusBody(body: Record<string, unknown>): ParsedTaskStatusBody {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !STATUS_ID_RE.test(id)) return { ok: false, error: "invalid_task_status_id" };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80 || hasControlChar(name)) return { ok: false, error: "invalid_task_status_name" };
  const category = typeof body.category === "string" ? body.category : "";
  if (!TASK_STATUS_CATEGORIES.includes(category as TaskStatusCategory)) return { ok: false, error: "invalid_task_status_category" };
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : NaN;
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 10000) return { ok: false, error: "invalid_task_status_sort_order" };
  const status = body.status === undefined ? "active" : body.status;
  if (status !== "active" && status !== "archived") return { ok: false, error: "invalid_task_status_state" };
  return { ok: true, value: { id, name, category: category as TaskStatusCategory, sortOrder, status } };
}

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

const nextUpdatedAt = (previous: string) => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
let SEQ = 0;
const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(SEQ += 1).toString(36)}`;

type Store = {
  projects: ProjectRecord[];
  tasks: TaskRecord[]; // все задачи всех проектов (фильтруются по проекту / по исполнителю)
  activities: TaskActivityRecord[];
  // Справочник статусов задач (копия сида на сессию мока): CRUD через /api/workspace/task-statuses.
  taskStatuses: WorkspaceTaskStatus[];
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

  return { projects, tasks, activities: [], taskStatuses: TASK_STATUSES.map((s) => ({ ...s })) };
}

/* ---- Загрузка ресурсов (GET /api/workspace/capacity/tree) ----
   Зеркало registerCapacityRoutes: monthIso обязателен (parseMonthIso), projectId — только
   активный проект рабочей области, иначе 400 capacity_invalid_query. Дерево собирается
   боевым rollupOrgCapacityTree из @kiss-pm/domain (тот же код, что на сервере), поэтому
   форма ответа контрактная: days + orgGroups (направление → отдел → должность → строки). */
const CAPACITY_POSITIONS = [
  { id: "backend", name: "Backend-разработка" },
  { id: "frontend", name: "Frontend-разработка" }
];
const CAPACITY_DIRECTIONS = [{ id: "dir-delivery", name: "Производство" }];
const CAPACITY_UNITS = [{ id: "unit-dev", name: "Разработка", directionId: "dir-delivery" }];
// Дневная нагрузка (минуты на рабочий день) по проектам. Сюжеты: u-sergeev — стабильный
// перегруз (600 > 480), u-mikhail — высокая загрузка без перегруза, u-kuznetsov — свободен.
const CAPACITY_LOAD: Array<{
  userId: string;
  positionId: string;
  daily: Array<{ projectId: string; minutes: number }>;
}> = [
  { userId: "u-petrov", positionId: "backend", daily: [{ projectId: MOCK_PROJECT_ID, minutes: 240 }, { projectId: "proj-bi-sales", minutes: 120 }] },
  { userId: "u-ivanova", positionId: "frontend", daily: [{ projectId: MOCK_PROJECT_ID, minutes: 300 }] },
  { userId: "u-sergeev", positionId: "backend", daily: [{ projectId: MOCK_PROJECT_ID, minutes: 360 }, { projectId: "proj-loyalty", minutes: 240 }] },
  { userId: "u-mikhail", positionId: "frontend", daily: [{ projectId: MOCK_PROJECT_ID, minutes: 420 }] },
  { userId: "u-kuznetsov", positionId: "backend", daily: [] }
];

// Формат месяца (зеркало capacityService.parseMonthIso: YYYY-MM, месяц 01..12).
const MONTH_ISO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function buildMockCapacityTree(monthIso: string, projectFilterId: string | null): OrgCapacityTree {
  const days = buildMonthDays(monthIso);
  const rows: CapacityMatrixRow[] = CAPACITY_LOAD.map((resource) => {
    const user = WORKSPACE_USERS.find((u) => u.id === resource.userId)!;
    const position = CAPACITY_POSITIONS.find((p) => p.id === resource.positionId)!;
    const projectsMixByDate: NonNullable<CapacityMatrixRow["projectsMixByDate"]> = {};
    const dayLoads: CapacityDayLoad[] = days.map((day) => {
      const working = !day.isWeekend && !day.isHoliday;
      const capacityMinutes = working ? 480 : 0;
      const mix = working
        ? resource.daily.filter((d) => projectFilterId === null || d.projectId === projectFilterId)
        : [];
      const workMinutes = mix.reduce((sum, d) => sum + d.minutes, 0);
      if (mix.length > 0) {
        projectsMixByDate[day.date] = mix.map((d) => ({ projectId: d.projectId, workMinutes: d.minutes }));
      }
      const overloadMinutes = Math.max(0, workMinutes - capacityMinutes);
      return {
        date: day.date,
        workMinutes,
        capacityMinutes,
        freeMinutes: Math.max(0, capacityMinutes - workMinutes),
        overloadMinutes,
        isWeekend: day.isWeekend,
        isHoliday: day.isHoliday,
        hasAbsence: false,
        isFreeDay: capacityMinutes === 0,
        isException: false,
        isOverload: overloadMinutes > 0,
        heat: computeHeat(workMinutes, capacityMinutes)
      };
    });
    return {
      user: { id: user.id, name: user.name, positionId: position.id, positionName: position.name },
      days: dayLoads,
      projectsMixByDate
    };
  });
  return rollupOrgCapacityTree({
    monthIso,
    rows,
    unassignedRows: [],
    days,
    workspacePositions: CAPACITY_POSITIONS,
    directions: CAPACITY_DIRECTIONS,
    units: CAPACITY_UNITS,
    placements: CAPACITY_LOAD.map((resource) => ({
      userId: resource.userId,
      directionId: "dir-delivery",
      positionId: resource.positionId,
      unitId: "unit-dev"
    }))
  });
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

    /* ---- GET /api/workspace/tasks/:taskId: canonical detail; 404 mirrors live taskReadWorkspace ---- */
    const taskDetail = method === "GET" ? path.match(/^\/api\/workspace\/tasks\/([^/]+)$/) : null;
    if (taskDetail) {
      const taskId = decodeURIComponent(taskDetail[1]!);
      if (!ROUTE_ID_RE.test(taskId)) return err("invalid_task_id", 400);
      const task = db.tasks.find((t) => t.id === taskId && t.archivedAt === null);
      if (!task) return err("task_not_found", 404);
      return json({
        task,
        projectId: task.projectId,
        // Зеркало боевого fail-soft: null, если проект недоступен.
        projectName: db.projects.find((p) => p.id === task.projectId)?.title ?? null,
        activities: db.activities.filter((activity) => activity.taskId === task.id),
        attachmentItems: []
      });
    }
    const taskUpdate = method === "PATCH" ? path.match(/^\/api\/workspace\/tasks\/([^/]+)$/) : null;
    if (taskUpdate) {
      const taskId = decodeURIComponent(taskUpdate[1]!);
      if (!ROUTE_ID_RE.test(taskId)) return err("invalid_task_id", 400);
      const task = db.tasks.find((item) => item.id === taskId && item.archivedAt === null);
      if (!task) return err("task_not_found", 404);
      const title = str(body.title);
      const plannedWork = Number(body.plannedWork);
      if (title.length < 3 || title.length > 160) return err("invalid_task_title", 400);
      if (!Number.isFinite(plannedWork) || plannedWork < 0) return err("invalid_task_work", 400);
      if (str(body.clientUpdatedAt) !== task.updatedAt) return err("task_version_conflict", 409);
      const beforeTitle = task.title;
      task.title = title;
      task.plannedWork = plannedWork;
      task.updatedAt = nextUpdatedAt(task.updatedAt);
      db.activities.unshift({
        id: genId("task-activity"),
        taskId: task.id,
        type: "system",
        title: "Задача обновлена",
        body: beforeTitle === title ? "Обновлены параметры задачи." : `Название изменено: «${beforeTitle}» → «${title}».`,
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null,
        authorUserId: CURRENT_USER_ID,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt
      });
      return json({ task });
    }

    const taskComment = method === "POST" ? path.match(/^\/api\/workspace\/tasks\/([^/]+)\/comments$/) : null;
    if (taskComment) {
      const taskId = decodeURIComponent(taskComment[1]!);
      if (!ROUTE_ID_RE.test(taskId)) return err("invalid_task_id", 400);
      const task = db.tasks.find((item) => item.id === taskId && item.archivedAt === null);
      if (!task) return err("task_not_found", 404);
      const commentBody = str(body.body);
      if (!commentBody) return err("invalid_task_comment", 400);
      const createdAt = new Date().toISOString();
      const activity: TaskActivityRecord = {
        id: genId("task-activity"),
        taskId: task.id,
        type: "comment",
        title: null,
        body: commentBody,
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null,
        authorUserId: CURRENT_USER_ID,
        createdAt,
        updatedAt: createdAt
      };
      db.activities.unshift(activity);
      return json({ activity }, 201);
    }

    /* ---- GET /api/workspace/capacity/tree: дерево загрузки за месяц (зеркало registerCapacityRoutes) ---- */
    if (method === "GET" && path === "/api/workspace/capacity/tree") {
      const query = new URLSearchParams(url.split("?")[1] ?? "");
      const monthIso = (query.get("monthIso") ?? "").trim();
      if (!MONTH_ISO_RE.test(monthIso)) return err("capacity_invalid_query", 400);
      const projectIdRaw = (query.get("projectId") ?? "").trim();
      let projectFilterId: string | null = null;
      if (projectIdRaw) {
        // Порядок как боевой роут: формат параметра → членство в readableProjectIds
        // (в моке — активные проекты рабочей области); оба отказа — 400 capacity_invalid_query.
        if (!ROUTE_ID_RE.test(projectIdRaw)) return err("capacity_invalid_query", 400);
        if (!db.projects.some((p) => p.id === projectIdRaw && p.status === "active")) {
          return err("capacity_invalid_query", 400);
        }
        projectFilterId = projectIdRaw;
      }
      return json(buildMockCapacityTree(monthIso, projectFilterId));
    }

    /* ---- GET /api/workspace/users: справочник пользователей (боевой эквивалент — тот же путь) ---- */
    if (method === "GET" && path === "/api/workspace/users") {
      return json({ users: WORKSPACE_USERS });
    }

    /* ---- Справочник статусов задач: GET/POST/PATCH/DELETE /api/workspace/task-statuses
       (зеркало taskStatusRoutes + parseCreateTaskStatusBody + taskStatusWorkspace).
       RBAC-веток нет (актор мока — с полным набором прав), как в остальных хендлерах. ---- */
    if (method === "GET" && path === "/api/workspace/task-statuses") {
      return json({ taskStatuses: [...db.taskStatuses].sort((a, b) => a.sortOrder - b.sortOrder) });
    }
    if (method === "POST" && path === "/api/workspace/task-statuses") {
      const parsed = parseTaskStatusBody(body);
      if (!parsed.ok) return err(parsed.error, 400);
      // Уникальные индексы (23505 → 409): pkey → tenant_name_uidx → tenant_sort_order_uidx.
      if (db.taskStatuses.some((s) => s.id === parsed.value.id)) return err("task_status_id_taken", 409);
      if (db.taskStatuses.some((s) => s.name === parsed.value.name)) return err("task_status_name_taken", 409);
      if (db.taskStatuses.some((s) => s.sortOrder === parsed.value.sortOrder)) return err("task_status_sort_order_taken", 409);
      const taskStatus: WorkspaceTaskStatus = { ...parsed.value, isSystem: false };
      db.taskStatuses.push(taskStatus);
      return json({ taskStatus }, 201);
    }
    const taskStatusPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/task-statuses\/([^/]+)$/) : null;
    if (taskStatusPatch) {
      const statusId = decodeURIComponent(taskStatusPatch[1]!);
      if (!ROUTE_ID_RE.test(statusId)) return err("invalid_task_status_id", 400);
      const parsed = parseTaskStatusBody({ ...body, id: statusId });
      if (!parsed.ok) return err(parsed.error, 400);
      const before = db.taskStatuses.find((s) => s.id === statusId);
      if (!before) return err("task_status_not_found", 404);
      // Системные гварды (боевой updateTaskStatus): архив системного и смена его категории запрещены.
      if (before.isSystem && parsed.value.status === "archived") return err("system_task_status_required", 409);
      if (before.isSystem && before.category !== parsed.value.category) return err("system_task_status_category_locked", 409);
      if (db.taskStatuses.some((s) => s.id !== statusId && s.name === parsed.value.name)) return err("task_status_name_taken", 409);
      if (db.taskStatuses.some((s) => s.id !== statusId && s.sortOrder === parsed.value.sortOrder)) return err("task_status_sort_order_taken", 409);
      before.name = parsed.value.name; before.category = parsed.value.category;
      before.sortOrder = parsed.value.sortOrder; before.status = parsed.value.status;
      return json({ taskStatus: before });
    }
    const taskStatusDelete = method === "DELETE" ? path.match(/^\/api\/workspace\/task-statuses\/([^/]+)$/) : null;
    if (taskStatusDelete) {
      const statusId = decodeURIComponent(taskStatusDelete[1]!);
      if (!ROUTE_ID_RE.test(statusId)) return err("invalid_task_status_id", 400);
      const before = db.taskStatuses.find((s) => s.id === statusId);
      if (!before) return err("task_status_not_found", 404);
      // DELETE = архив (боевой archiveTaskStatus): системный не архивируется; повторный архив идемпотентен.
      if (before.isSystem) return err("system_task_status_required", 409);
      if (before.status === "archived") return json({ taskStatus: before });
      before.status = "archived";
      return json({ taskStatus: before });
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
      const target = db.taskStatuses.find((s) => s.id === statusId && s.status === "active");
      if (!target) return err("task_status_not_found", 400);
      // Правило перехода (как isTaskStatusTransitionAllowed). 409 task_status_transition_not_allowed.
      if (!isTransitionAllowed(task.status, target.category)) return err("task_status_transition_not_allowed", 409);
      // Приёмка: задача с requiresAcceptance, переход в done — в моке актор=участник, право приёмки есть.
      // (Боевой 409 task_acceptance_required возникает, когда у актора нет права приёмки; в моке упрощено.)
      // Применяем переход: статус + прогресс (done → 100, иначе сохраняем).
      task.status = target.category; task.statusId = target.id; task.statusName = target.name; task.statusCategory = target.category;
      if (target.category === "done") task.progress = 100;
      else if (target.category === "new") task.progress = 0;
      task.updatedAt = nextUpdatedAt(task.updatedAt);
      return json({ task });
    }

    return err("not_found", 404);
  };

  return mockFetch;
}
