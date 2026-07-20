/* ============================================================
   Contract-grounded mock backend для администрирования (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт ручек
   администрирования рабочей области:
     /api/workspace/access-roles            (GET / PATCH:id / DELETE:id)
     /api/tenant/current/access-profiles    (POST — создание роли)
     /api/workspace/users                   (GET / POST / PATCH:id / DELETE:id)
     /api/workspace/positions               (GET / POST / PATCH:id / DELETE:id)
   Компонент работает через настоящий createAdminClient (с fetchImpl),
   поэтому переключение на боевой API = смена apiOrigin.

   Валидация и коды зеркалят apps/api (accessRoleRoutes / workspaceUserRoutes /
   workspaceParsers / routeParamParsers) ДОСЛОВНО: формат id, full-replace для
   роли, partial-merge для PATCH пользователя, коды конфликтов и 4xx, порядок
   проверок. RBAC actor — Администратор (полный набор прав), поэтому 403-веток
   нет; «текущий пользователь» (ACTOR_ID) защищён self-гвардами.
   ============================================================ */

import {
  ABSENCE_TYPES,
  type AbsenceType,
  type AccessProfile,
  type AuditEvent,
  type BackgroundJobEvent,
  type BackgroundJobRun,
  type Permission,
  type Position,
  type ProductionCalendarException,
  type ResourceAbsence,
  type SecurityPolicy,
  type UserStatus,
  type WorkspaceUser
} from "./admin-client";
import { ALL_PERMISSIONS } from "./permissions-catalog";

// Каталог прав живёт в permissions-catalog (статическая константа домена, не «мок»).
// Ре-экспорт сохраняется для совместимости импортов (тесты, прежние ссылки).
export { ALL_PERMISSIONS } from "./permissions-catalog";

const TENANT = "tenant-alpha";
const ACTOR_ID = "user-anna"; // «текущий пользователь» сессии: Администратор, защищён self-гвардами
// Формат идентификатора маршрута (routeParamParsers.parseRouteIdentifier): a-z0-9 старт, далее _ - длиной 3..120.
const ROUTE_ID_RE = /^[a-z0-9][a-z0-9_-]{2,119}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 160;
const MAX_EMAIL = 254;
const MAX_CONTACT = 80;
const MIN_PASSWORD = 8;

// Управляющие символы single-line (как боевой hasUnsafeSingleLineControl): 0x00–0x1F и 0x7F.
// Без литералов в исходнике — по кодам (\xNN через charCodeAt).
const hasControlSingleLine = (v: string): boolean => {
  for (let i = 0; i < v.length; i += 1) {
    const c = v.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
};
// single-line текст: trim, непустой, ≤ max, без управляющих (как боевой parseSingleLineText).
const parseSingleLine = (v: unknown, max = MAX_NAME): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0 || t.length > max || hasControlSingleLine(t)) return null;
  return t;
};
// email: trim+lowercase, длина 3..254, по паттерну, без управляющих (как боевой parseEmail).
const parseEmail = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t.length < 3 || t.length > MAX_EMAIL || !EMAIL_RE.test(t) || hasControlSingleLine(t)) return null;
  return t;
};
// nullable single-line контакт (phone/telegram): null|undefined→null; пустая строка→null; иначе single-line или false.
const parseNullableContact = (v: unknown): string | null | false => {
  if (v === null || v === undefined) return null;
  const parsed = parseSingleLine(v, MAX_CONTACT);
  if (parsed === null) return typeof v === "string" && v.trim().length === 0 ? null : false;
  return parsed;
};
// Управляющие символы multiline (как боевой hasUnsafeMultilineControl): всё, кроме \t \n \r.
// Без литералов в исходнике — по кодам (charCodeAt), как hasControlSingleLine выше.
const MAX_DESCRIPTION = 1_000;
const hasControlMultiline = (v: string): boolean => {
  for (let i = 0; i < v.length; i += 1) {
    const c = v.charCodeAt(i);
    if ((c <= 0x1f && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return true;
  }
  return false;
};
// nullable multiline текст (описание должности): null/undefined/пустая → null; не-строка/длинная/управляющие → false.
const parseNullableMultiline = (v: unknown, max = MAX_DESCRIPTION): string | null | false => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > max || hasControlMultiline(t)) return false;
  return t;
};

const nowIso = () => new Date().toISOString();

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);
const isPermission = (v: unknown): v is Permission => typeof v === "string" && PERMISSION_SET.has(v);

type Store = {
  accessRoles: AccessProfile[];
  users: WorkspaceUser[];
  positions: Position[];
  securityPolicy: SecurityPolicy;
  absences: ResourceAbsence[];
  calendarBaseMode: { workingWeekdays: number[]; workingMinutesPerDay: number };
  calendarExceptions: ProductionCalendarException[];
  jobRuns: BackgroundJobRun[];
  jobEvents: BackgroundJobEvent[];
};

function seed(): Store {
  const positions: Position[] = [
    { id: "position-project-manager", tenantId: TENANT, name: "Менеджер проектов", description: "Ведёт проекты и согласования." },
    { id: "position-sales", tenantId: TENANT, name: "Менеджер по продажам", description: "Работает с воронкой сделок." },
    { id: "position-engineer", tenantId: TENANT, name: "Инженер", description: null }
  ];

  // Роли: Администратор (полный набор) / Менеджер (управление сделками+проектами) / Наблюдатель (только чтение).
  const accessRoles: AccessProfile[] = [
    { id: "role-administrator", tenantId: TENANT, name: "Администратор", permissions: [...ALL_PERMISSIONS] },
    {
      id: "role-manager", tenantId: TENANT, name: "Менеджер",
      permissions: [
        "tenant.users.read", "tenant.positions.read", "tenant.org_structure.read",
        "tenant.clients.read", "tenant.clients.manage",
        "tenant.contacts.read", "tenant.contacts.manage",
        "tenant.products.read",
        "tenant.opportunities.read", "tenant.opportunities.manage",
        "tenant.projects.read", "tenant.projects.manage",
        "tenant.project_plan.read", "tenant.project_plan.manage",
        "tenant.project_activation.manage", "tenant.resource_feasibility.read",
        "tenant.tasks.create", "tenant.tasks.edit",
        "profile.read", "profile.update"
      ]
    },
    {
      id: "role-observer", tenantId: TENANT, name: "Наблюдатель",
      permissions: [
        "tenant.users.read", "tenant.positions.read", "tenant.org_structure.read",
        "tenant.clients.read", "tenant.contacts.read", "tenant.products.read",
        "tenant.opportunities.read", "tenant.projects.read", "tenant.project_plan.read",
        "tenant.control_surfaces.read", "tenant.retrospectives.read",
        "profile.read"
      ]
    }
  ];

  const user = (
    id: string, email: string, name: string, accessProfileId: string,
    positionId: string | null, status: UserStatus
  ): WorkspaceUser => ({
    id, tenantId: TENANT, email, name, accessProfileId,
    positionId, positionName: positionId ? positions.find((p) => p.id === positionId)?.name ?? null : null,
    phone: null, telegram: null, status, theme: "light", accentColor: "#0f766e"
  });

  // 5 пользователей: разные роли/статусы; user-anna — «текущий» Администратор (self-гварды).
  const users: WorkspaceUser[] = [
    user("user-anna", "anna@kiss-pm.dev", "Анна Администратор", "role-administrator", "position-project-manager", "active"),
    user("user-ivan", "ivan@kiss-pm.dev", "Иван Менеджер", "role-manager", "position-sales", "active"),
    user("user-sergey", "sergey@kiss-pm.dev", "Сергей Инженер", "role-manager", "position-engineer", "active"),
    user("user-maria", "maria@kiss-pm.dev", "Мария Наблюдатель", "role-observer", null, "active"),
    user("user-oleg", "oleg@kiss-pm.dev", "Олег Деактивирован", "role-observer", "position-sales", "inactive")
  ];

  // Политика безопасности: боевой DEFAULT_TENANT_SECURITY_POLICY, но с демо-allowlist для наглядности карточки.
  const securityPolicy: SecurityPolicy = {
    twoFactorRequired: true,
    sessionTimeoutHours: 12,
    ssoSamlEnabled: false,
    domainAllowlist: ["kiss-pm.dev", "kiss-pm.local"]
  };

  // Отсутствия: пара актуальных записей текущего года (даты — вокруг «сегодня»,
  // чтобы дефолтный период поверхности их показывал).
  const isoDay = (offsetDays: number): string =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const absence = (
    id: string, userId: string, type: AbsenceType, dateFrom: string, dateTo: string, reason: string | null
  ): ResourceAbsence => ({
    id, tenantId: TENANT, userId, type, dateFrom, dateTo,
    status: "approved", reason, createdBy: ACTOR_ID, approvedBy: null,
    createdAt: nowIso(), updatedAt: nowIso()
  });
  const absences: ResourceAbsence[] = [
    absence("0b8f6c2a-1111-4aaa-8aaa-000000000001", "user-ivan", "vacation", isoDay(3), isoDay(10), "Ежегодный отпуск"),
    absence("0b8f6c2a-1111-4aaa-8aaa-000000000002", "user-sergey", "sick_leave", isoDay(-2), isoDay(1), null)
  ];

  // Базовый режим недели тенанта (Пн–Пт, 8 ч) — правится PATCH-ручкой.
  const calendarBaseMode = { workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 };

  // Исключения производственного календаря (tenant-wide: resourceId = null).
  const year = new Date().getUTCFullYear();
  const calendarExceptions: ProductionCalendarException[] = [
    { id: "pc-new-year", date: `${year}-01-01`, workingMinutes: 0, reason: "Новый год", resourceId: null },
    { id: "pc-pre-holiday", date: `${year}-03-07`, workingMinutes: 420, reason: "Сокращённый предпраздничный день", resourceId: null }
  ];

  // Прогоны фоновых задач: реальные kinds с реальными хендлерами, смешанные статусы
  // (как отдаёт боевой GET /api/workspace/background-jobs/runs — createdAt desc).
  const jobRun = (
    id: string, kind: string, status: BackgroundJobRun["status"],
    over: Partial<BackgroundJobRun> = {}
  ): BackgroundJobRun => ({
    id: `background-job-${id}`, tenantId: TENANT, kind, status,
    priority: 0, payload: {}, idempotencyKey: null, attempt: status === "queued" ? 0 : 1, maxAttempts: 5,
    runAfter: "2026-01-14T03:00:00.000Z", lockedBy: null, lockedAt: null,
    startedAt: null, finishedAt: null, lastError: null,
    createdAt: "2026-01-14T03:00:00.000Z", updatedAt: "2026-01-14T03:00:00.000Z",
    ...over
  });
  const jobRuns: BackgroundJobRun[] = [
    jobRun("cleanup-1", "storage.asset_cleanup", "succeeded", {
      startedAt: "2026-01-14T03:00:01.000Z", finishedAt: "2026-01-14T03:00:04.000Z",
      idempotencyKey: "default:storage.asset_cleanup:2026-01-14T03:00:00.000Z"
    }),
    jobRun("janitor-1", "calls.recording_janitor", "dead", {
      attempt: 5, lastError: "background_job_failed",
      startedAt: "2026-01-13T22:00:00.000Z", finishedAt: "2026-01-13T22:00:02.000Z",
      createdAt: "2026-01-13T22:00:00.000Z", updatedAt: "2026-01-13T22:00:02.000Z"
    }),
    jobRun("purge-1", "planning.expired_runs_purge", "queued", {
      runAfter: "2026-01-15T03:00:00.000Z",
      createdAt: "2026-01-13T03:00:00.000Z", updatedAt: "2026-01-13T03:00:00.000Z"
    })
  ];
  const jobEvent = (id: string, jobId: string, eventType: string, message: string, createdAt: string): BackgroundJobEvent =>
    ({ id: `job-event-${id}`, tenantId: TENANT, jobId: `background-job-${jobId}`, eventType, message, metadata: {}, createdAt });
  const jobEvents: BackgroundJobEvent[] = [
    jobEvent("1", "cleanup-1", "enqueued", "Job enqueued", "2026-01-14T03:00:00.000Z"),
    jobEvent("2", "cleanup-1", "claimed", "Job claimed by worker", "2026-01-14T03:00:01.000Z"),
    jobEvent("3", "cleanup-1", "succeeded", "Archived assets cleanup completed", "2026-01-14T03:00:04.000Z"),
    jobEvent("4", "janitor-1", "enqueued", "Job enqueued", "2026-01-13T22:00:00.000Z"),
    jobEvent("5", "janitor-1", "failed", "background_job_failed", "2026-01-13T22:00:01.000Z"),
    jobEvent("6", "janitor-1", "dead", "Max attempts exhausted", "2026-01-13T22:00:02.000Z"),
    jobEvent("7", "purge-1", "enqueued", "Job enqueued", "2026-01-13T03:00:00.000Z")
  ];

  return { accessRoles, users, positions, securityPolicy, absences, calendarBaseMode, calendarExceptions, jobRuns, jobEvents };
}

/* ---- Транспорт: fetchImpl, совместимый с createAdminClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);

// Сид журнала аудита: реальные action-типы со смешанными статусами (succeeded/denied/failed),
// по убыванию времени — как боевой listAuditEventsByTenantId (orderBy createdAt desc).
const AUDIT_EVENTS: AuditEvent[] = [
  { id: "audit-1", actorUserId: "user-anna", actionType: "workspace.security_policy.updated", createdAt: "2026-01-14T10:42:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "SecurityPolicy", id: TENANT } },
  { id: "audit-2", actorUserId: "user-anna", actionType: "access_role.created", createdAt: "2026-01-14T09:15:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "AccessProfile", id: "role-manager" } },
  { id: "audit-3", actorUserId: "user-ivan", actionType: "workspace.user.deactivated", createdAt: "2026-01-13T17:30:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "User", id: "user-oleg" } },
  { id: "audit-4", actorUserId: "user-anna", actionType: "control_surface.published", createdAt: "2026-01-13T14:05:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "ControlSurface", id: "surface-deals" } },
  { id: "audit-5", actorUserId: "user-ivan", actionType: "access_role.update", createdAt: "2026-01-13T11:20:00.000Z", executionResult: { status: "denied" }, sourceEntity: { type: "AccessProfile", id: "role-administrator" } },
  { id: "audit-6", actorUserId: "user-anna", actionType: "workspace.custom_field.created", createdAt: "2026-01-12T16:48:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "CustomFieldDefinition", id: "cf-priority" } },
  { id: "audit-7", actorUserId: "user-sergey", actionType: "control_surface.publish_blocked", createdAt: "2026-01-12T13:10:00.000Z", executionResult: { status: "failed" }, sourceEntity: { type: "ControlSurface", id: "surface-projects" } },
  { id: "audit-8", actorUserId: "user-anna", actionType: "workspace.project_template.updated", createdAt: "2026-01-12T09:02:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "ProjectTemplate", id: "tpl-default" } }
];

// Серверная семантика ленты (mirror auditRoutes + persistence): фильтры + keyset-курсор.
const decodeAuditCursor = (raw: string | null): { createdAt: number; id: string } | null => {
  if (!raw) return null;
  try {
    const decoded =
      typeof atob === "function"
        ? atob(raw.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.indexOf("|");
    if (sep <= 0) return null;
    const time = new Date(decoded.slice(0, sep)).getTime();
    if (Number.isNaN(time)) return null;
    return { createdAt: time, id: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
};
const encodeAuditCursor = (createdAt: string, id: string): string => {
  const payload = `${createdAt}|${id}`;
  const base64 =
    typeof btoa === "function"
      ? btoa(payload)
      : Buffer.from(payload, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Парсинг тела роли (зеркало parseAccessProfileCreateBody): id → name → permissions, коды и порядок.
type RoleParse = { ok: true; id: string; name: string; permissions: Permission[] } | { ok: false; error: string };
const parseAccessProfileBody = (body: Record<string, unknown>): RoleParse => {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!ROUTE_ID_RE.test(id)) return { ok: false, error: "invalid_access_profile_id" };
  const name = parseSingleLine(body.name, MAX_NAME);
  if (name === null) return { ok: false, error: "invalid_access_profile_name" };
  if (!Array.isArray(body.permissions) || !body.permissions.every(isPermission)) return { ok: false, error: "invalid_permissions" };
  return { ok: true, id, name, permissions: body.permissions as Permission[] };
};

export function createMockAdminFetch(): typeof fetch {
  const db = seed();

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try {
        const p: unknown = JSON.parse(String(init.body));
        if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>;
        else return err("invalid_body", 400); // боевой parse*: !body||typeof!=="object"
      } catch {
        return err("invalid_json", 400);
      }
    }

    /* ---- access-roles (роли) ---- */
    // Список: сортировка по id (боевой repositories: orderBy accessProfiles.id).
    if (path === "/api/workspace/access-roles" && method === "GET") {
      return json({ accessRoles: [...db.accessRoles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) });
    }
    // Каталог прав (боевой GET /api/workspace/permission-catalog) — статический список access-control.
    if (path === "/api/workspace/permission-catalog" && method === "GET") {
      return json({ permissions: ALL_PERMISSIONS });
    }

    /* ---- audit-events (журнал аудита) ---- */
    if (path === "/api/tenant/current/audit-events" && method === "GET") {
      const params = new URL(url, "http://x").searchParams;
      const limit = Math.max(1, Math.min(100, Number(params.get("limit")) || 50));
      const actorUserId = params.get("actorUserId");
      const actionType = params.get("actionType");
      const executionResult = params.get("executionResult");
      const fromDate = params.get("fromDate");
      const toDate = params.get("toDate");
      const cursor = decodeAuditCursor(params.get("cursor"));
      const fromTime = fromDate ? new Date(fromDate).getTime() : null;
      const toTime = toDate ? new Date(toDate).getTime() : null;
      const matched = AUDIT_EVENTS
        .filter((event) => !actorUserId || event.actorUserId === actorUserId)
        .filter((event) => !actionType || event.actionType === actionType)
        .filter((event) => !executionResult || event.executionResult?.status === executionResult)
        .filter((event) => fromTime === null || new Date(event.createdAt).getTime() >= fromTime)
        .filter((event) => toTime === null || new Date(event.createdAt).getTime() <= toTime)
        .filter((event) => {
          if (!cursor) return true;
          const at = new Date(event.createdAt).getTime();
          return at !== cursor.createdAt ? at < cursor.createdAt : event.id < cursor.id;
        });
      const window = matched.slice(0, limit);
      const hasMore = matched.length > limit;
      const last = window[window.length - 1];
      const nextCursor = hasMore && last ? encodeAuditCursor(last.createdAt, last.id) : null;
      return json({ auditEvents: window, nextCursor });
    }
    // Точечная выборка (deep-link ?event=) — зеркало боевого GET /audit-events/:id.
    const auditEventMatch = /^\/api\/tenant\/current\/audit-events\/([^/]+)$/.exec(path);
    if (auditEventMatch && method === "GET") {
      const event = AUDIT_EVENTS.find((candidate) => candidate.id === decodeURIComponent(auditEventMatch[1]!));
      return event ? json({ auditEvent: event }) : err("audit_event_not_found", 404);
    }

    /* ---- security-policy (политика безопасности тенанта) ---- */
    if (path === "/api/tenant/current/security-policy" && method === "GET") {
      return json({ securityPolicy: db.securityPolicy });
    }
    if (path === "/api/tenant/current/security-policy" && method === "PUT") {
      // Зеркало боевого parseSecurityPolicyBody: тело { securityPolicy: {...} }; booleans обязательны,
      // timeout — целое 1..8760, allowlist — массив строк, нормализуется (trim/lowercase/dedup).
      const record = body.securityPolicy;
      if (!record || typeof record !== "object" || Array.isArray(record)) return err("security_policy_invalid", 400);
      const c = record as Record<string, unknown>;
      if (typeof c.twoFactorRequired !== "boolean" || typeof c.ssoSamlEnabled !== "boolean") return err("security_policy_invalid", 400);
      const timeout = c.sessionTimeoutHours;
      if (typeof timeout !== "number" || !Number.isInteger(timeout) || timeout < 1 || timeout > 8760) return err("security_policy_session_timeout_invalid", 400);
      const rawList = c.domainAllowlist ?? [];
      if (!Array.isArray(rawList) || rawList.some((e) => typeof e !== "string")) return err("security_policy_domain_allowlist_invalid", 400);
      const domainAllowlist = Array.from(new Set((rawList as string[]).map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)));
      db.securityPolicy = { twoFactorRequired: c.twoFactorRequired, sessionTimeoutHours: timeout, ssoSamlEnabled: c.ssoSamlEnabled, domainAllowlist };
      return json({ securityPolicy: db.securityPolicy });
    }
    // Создание роли — POST /api/tenant/current/access-profiles (id обязателен; коды taken).
    if (path === "/api/tenant/current/access-profiles" && method === "POST") {
      const parsed = parseAccessProfileBody(body);
      if (!parsed.ok) return err(parsed.error, 400);
      if (db.accessRoles.some((r) => r.id === parsed.id)) return err("access_role_id_taken", 409);
      if (db.accessRoles.some((r) => r.name === parsed.name)) return err("access_role_name_taken", 409);
      const role: AccessProfile = { id: parsed.id, tenantId: TENANT, name: parsed.name, permissions: parsed.permissions };
      db.accessRoles.push(role);
      return json({ accessProfile: role }, 201);
    }
    const rolePatch = method === "PATCH" ? path.match(/^\/api\/workspace\/access-roles\/([^/]+)$/) : null;
    if (rolePatch) {
      const roleId = decodeURIComponent(rolePatch[1]!);
      if (!ROUTE_ID_RE.test(roleId)) return err("invalid_access_role_id", 400); // параметр маршрута до резолва
      const role = db.accessRoles.find((r) => r.id === roleId);
      if (!role) return err("access_role_not_found", 404);
      if (roleId === db.users.find((u) => u.id === ACTOR_ID)!.accessProfileId) return err("self_access_role_update_forbidden", 400); // нельзя править роль актора
      // full-replace: id берётся из URL, тело несёт name+permissions (как боевой: body + {id: roleId}).
      const parsed = parseAccessProfileBody({ ...body, id: roleId });
      if (!parsed.ok) return err(parsed.error, 400);
      if (db.accessRoles.some((r) => r.id !== roleId && r.name === parsed.name)) return err("access_role_name_taken", 409);
      role.name = parsed.name; role.permissions = parsed.permissions;
      return json({ accessRole: role });
    }
    const roleDelete = method === "DELETE" ? path.match(/^\/api\/workspace\/access-roles\/([^/]+)$/) : null;
    if (roleDelete) {
      const roleId = decodeURIComponent(roleDelete[1]!);
      if (!ROUTE_ID_RE.test(roleId)) return err("invalid_access_role_id", 400);
      // self-гвард delete ДО резолва (боевой порядок: actor.accessProfileId===roleId → 400 раньше not_found).
      if (roleId === db.users.find((u) => u.id === ACTOR_ID)!.accessProfileId) return err("self_access_role_delete_forbidden", 400);
      const role = db.accessRoles.find((r) => r.id === roleId);
      if (!role) return err("access_role_not_found", 404);
      // Назначенная роль не удаляется (есть пользователь с этим accessProfileId).
      if (db.users.some((u) => u.accessProfileId === roleId)) return err("access_role_assigned", 409);
      db.accessRoles = db.accessRoles.filter((r) => r.id !== roleId);
      return json({ status: "deleted" });
    }

    /* ---- positions (позиции/должности) — справочник с CRUD (зеркало positionRoutes + parsePositionBody) ---- */
    // Сортировка по name (боевой repositories: orderBy positions.name).
    if (path === "/api/workspace/positions" && method === "GET") {
      return json({ positions: [...db.positions].sort((a, b) => a.name.localeCompare(b.name, "ru")) });
    }
    if (path === "/api/workspace/positions" && method === "POST") {
      // Порядок parsePositionBody: id (дефолт position-<uuid>) → name → description; затем конфликты id → name.
      const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `position-${cryptoRandom()}`;
      if (!ROUTE_ID_RE.test(id)) return err("invalid_position_id", 400);
      const name = parseSingleLine(body.name, MAX_NAME);
      if (name === null) return err("invalid_position_name", 400);
      const description = parseNullableMultiline(body.description);
      if (description === false) return err("invalid_position_description", 400);
      if (db.positions.some((p) => p.id === id)) return err("position_id_taken", 409);
      if (db.positions.some((p) => p.name === name)) return err("position_name_taken", 409);
      const position: Position = { id, tenantId: TENANT, name, description };
      db.positions.push(position);
      return json({ position }, 201);
    }
    const positionPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/positions\/([^/]+)$/) : null;
    if (positionPatch) {
      const positionId = decodeURIComponent(positionPatch[1]!);
      if (!ROUTE_ID_RE.test(positionId)) return err("invalid_position_id", 400);
      // Боевой порядок: резолв (404) → парсинг тела → конфликт имени с ДРУГОЙ должностью (409).
      const current = db.positions.find((p) => p.id === positionId);
      if (!current) return err("position_not_found", 404);
      const name = parseSingleLine(body.name, MAX_NAME);
      if (name === null) return err("invalid_position_name", 400);
      const description = parseNullableMultiline(body.description);
      if (description === false) return err("invalid_position_description", 400);
      if (db.positions.some((p) => p.id !== positionId && p.name === name)) return err("position_name_taken", 409);
      current.name = name; current.description = description;
      // Смена названия отражается в users.positionName (боевой отдаёт join-поле при следующем чтении).
      for (const u of db.users) if (u.positionId === positionId) u.positionName = name;
      return json({ position: current });
    }
    const positionDelete = method === "DELETE" ? path.match(/^\/api\/workspace\/positions\/([^/]+)$/) : null;
    if (positionDelete) {
      const positionId = decodeURIComponent(positionDelete[1]!);
      if (!ROUTE_ID_RE.test(positionId)) return err("invalid_position_id", 400);
      const current = db.positions.find((p) => p.id === positionId);
      if (!current) return err("position_not_found", 404);
      // Назначенная должность не удаляется (боевой: listWorkspaceUsers.filter positionId → 409 position_assigned).
      if (db.users.some((u) => u.positionId === positionId)) return err("position_assigned", 409);
      db.positions = db.positions.filter((p) => p.id !== positionId);
      return json({ status: "deleted" });
    }

    /* ---- users (пользователи) ---- */
    // Список: сортировка по name (боевой repositories: orderBy tenantUsers.name).
    if (path === "/api/workspace/users" && method === "GET") {
      return json({
        privateFieldsIncluded: true,
        users: [...db.users].sort((a, b) => a.name.localeCompare(b.name, "ru"))
      });
    }
    if (path === "/api/workspace/users" && method === "POST") {
      // Порядок (зеркало parseWorkspaceUserBody + handler): id → accessProfileId формат → positionId формат →
      // email → name → password(parser) → status → … → таблицы конфликтов → password<8 → id_taken →
      // email_taken → invalid_access_role(резолв) → invalid_position(резолв).
      const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `user-${cryptoRandom()}`;
      if (!ROUTE_ID_RE.test(id)) return err("invalid_user_id", 400);
      const accessProfileId = typeof body.accessProfileId === "string" ? body.accessProfileId.trim() : "";
      if (!ROUTE_ID_RE.test(accessProfileId)) return err("invalid_access_role", 400);
      const positionRaw = typeof body.positionId === "string" && body.positionId.trim() ? body.positionId.trim() : null;
      if (positionRaw !== null && !ROUTE_ID_RE.test(positionRaw)) return err("invalid_position_id", 400);
      const email = parseEmail(body.email);
      if (email === null) return err("invalid_user_email", 400);
      const name = parseSingleLine(body.name, MAX_NAME);
      if (name === null) return err("invalid_user_name", 400);
      const status: UserStatus = body.status === undefined ? "active" : body.status === "active" || body.status === "inactive" ? body.status : "__bad__" as UserStatus;
      if (status === ("__bad__" as UserStatus)) return err("invalid_user_status", 400);
      const phone = parseNullableContact(body.phone);
      if (phone === false) return err("invalid_user_phone", 400);
      const telegram = parseNullableContact(body.telegram);
      if (telegram === false) return err("invalid_user_telegram", 400);
      // password: обязателен и ≥ 8 (боевой: parser допускает отсутствие, затем handler требует длину).
      const password = typeof body.password === "string" ? body.password : null;
      if (password === null || password.length < MIN_PASSWORD) return err("invalid_user_password", 400);
      // Конфликты (порядок: id → email).
      if (db.users.some((u) => u.id === id)) return err("user_id_taken", 409);
      if (db.users.some((u) => u.email === email)) return err("user_email_taken", 409);
      // Резолв роли → 400 invalid_access_role; затем позиции → 400 invalid_position.
      if (!db.accessRoles.some((r) => r.id === accessProfileId)) return err("invalid_access_role", 400);
      if (positionRaw && !db.positions.some((p) => p.id === positionRaw)) return err("invalid_position", 400);
      const u: WorkspaceUser = {
        id, tenantId: TENANT, email, name, accessProfileId,
        positionId: positionRaw, positionName: positionRaw ? db.positions.find((p) => p.id === positionRaw)!.name : null,
        phone: phone as string | null, telegram: telegram as string | null, status, theme: "light", accentColor: "#0f766e"
      };
      db.users.push(u);
      return json({ user: u }, 201);
    }
    // Приглашение сотрудника (зеркало POST /api/workspace/invitations): создаёт
    // пользователя status:"inactive" БЕЗ пароля. Мок работает как delivery:"none"
    // (письма нет) → invitationToken возвращается в ответе для ручной передачи.
    if (path === "/api/workspace/invitations" && method === "POST") {
      const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `user-${cryptoRandom()}`;
      if (!ROUTE_ID_RE.test(id)) return err("invalid_user_id", 400);
      const accessProfileId = typeof body.accessProfileId === "string" ? body.accessProfileId.trim() : "";
      if (!ROUTE_ID_RE.test(accessProfileId)) return err("invalid_access_role", 400);
      const positionRaw = typeof body.positionId === "string" && body.positionId.trim() ? body.positionId.trim() : null;
      if (positionRaw !== null && !ROUTE_ID_RE.test(positionRaw)) return err("invalid_position_id", 400);
      const email = parseEmail(body.email);
      if (email === null) return err("invalid_user_email", 400);
      const name = parseSingleLine(body.name, MAX_NAME);
      if (name === null) return err("invalid_user_name", 400);
      if (db.users.some((u) => u.id === id)) return err("user_id_taken", 409);
      if (db.users.some((u) => u.email === email)) return err("user_email_taken", 409);
      if (!db.accessRoles.some((r) => r.id === accessProfileId)) return err("invalid_access_role", 400);
      if (positionRaw && !db.positions.some((p) => p.id === positionRaw)) return err("invalid_position", 400);
      const u: WorkspaceUser = {
        id, tenantId: TENANT, email, name, accessProfileId,
        positionId: positionRaw, positionName: positionRaw ? db.positions.find((p) => p.id === positionRaw)!.name : null,
        phone: null, telegram: null, status: "inactive", theme: "light", accentColor: "#0f766e"
      };
      db.users.push(u);
      return json({ user: u, delivery: "none", invitationToken: randomHex64(), expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, 201);
    }
    // Выдача токена сброса пароля (зеркало POST /api/workspace/users/:userId/password-reset-token):
    // raw hex(64) отдаётся РОВНО ОДИН РАЗ, TTL 60 минут; сервер хранит только хэш (в моке — ничего).
    const userResetToken = method === "POST" ? path.match(/^\/api\/workspace\/users\/([^/]+)\/password-reset-token$/) : null;
    if (userResetToken) {
      const userId = decodeURIComponent(userResetToken[1]!);
      if (!ROUTE_ID_RE.test(userId)) return err("invalid_user_id", 400); // параметр маршрута до резолва
      if (!db.users.some((u) => u.id === userId)) return err("user_not_found", 404);
      return json({ resetToken: randomHex64(), expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, 201);
    }
    const userPatch = method === "PATCH" ? path.match(/^\/api\/workspace\/users\/([^/]+)$/) : null;
    if (userPatch) {
      const userId = decodeURIComponent(userPatch[1]!);
      if (!ROUTE_ID_RE.test(userId)) return err("invalid_user_id", 400); // параметр маршрута до резолва
      const current = db.users.find((u) => u.id === userId);
      if (!current) return err("user_not_found", 404); // beforeState до парсинга тела (боевой порядок)
      // partial-merge (parseWorkspaceUserPatchBody): отсутствующие поля = текущие значения.
      const emailIn = field(body, "email");
      const nameIn = field(body, "name");
      const accessIn = field(body, "accessProfileId");
      const positionIn = field(body, "positionId");
      const phoneIn = field(body, "phone");
      const telegramIn = field(body, "telegram");
      const statusIn = field(body, "status");
      const accessProfileId = accessIn === undefined ? current.accessProfileId : accessIn;
      if (!ROUTE_ID_RE.test(accessProfileId)) return err("invalid_access_role", 400);
      const positionId = positionIn === undefined ? current.positionId : positionIn || null;
      if (positionId !== null && !ROUTE_ID_RE.test(positionId)) return err("invalid_position_id", 400);
      const email = emailIn === undefined ? current.email : parseEmail(emailIn);
      if (email === null) return err("invalid_user_email", 400);
      const name = nameIn === undefined ? current.name : parseSingleLine(nameIn, MAX_NAME);
      if (name === null) return err("invalid_user_name", 400);
      const status: UserStatus = statusIn === undefined ? current.status : statusIn === "" ? current.status : statusIn === "active" || statusIn === "inactive" ? statusIn : "__bad__" as UserStatus;
      if (status === ("__bad__" as UserStatus)) return err("invalid_user_status", 400);
      const phone = phoneIn === undefined ? current.phone : parseNullableContact(phoneIn);
      if (phone === false) return err("invalid_user_phone", 400);
      const telegram = telegramIn === undefined ? current.telegram : parseNullableContact(telegramIn);
      if (telegram === false) return err("invalid_user_telegram", 400);
      // self-гвард: актор не может сам себя деактивировать или сменить себе роль.
      if (userId === ACTOR_ID && (status !== "active" || accessProfileId !== current.accessProfileId)) {
        return err("self_access_change_forbidden", 400);
      }
      // email_taken (другой пользователь с таким email) → 409; затем резолвы роли/позиции → 400.
      if (db.users.some((u) => u.id !== userId && u.email === email)) return err("user_email_taken", 409);
      if (!db.accessRoles.some((r) => r.id === accessProfileId)) return err("invalid_access_role", 400);
      if (positionId && !db.positions.some((p) => p.id === positionId)) return err("invalid_position", 400);
      current.email = email; current.name = name; current.accessProfileId = accessProfileId;
      current.positionId = positionId; current.positionName = positionId ? db.positions.find((p) => p.id === positionId)!.name : null;
      current.phone = phone as string | null; current.telegram = telegram as string | null; current.status = status;
      return json({ user: current });
    }
    const userDelete = method === "DELETE" ? path.match(/^\/api\/workspace\/users\/([^/]+)$/) : null;
    if (userDelete) {
      const userId = decodeURIComponent(userDelete[1]!);
      if (!ROUTE_ID_RE.test(userId)) return err("invalid_user_id", 400);
      if (userId === ACTOR_ID) return err("self_user_delete_forbidden", 400); // self-гвард до резолва (боевой порядок)
      const exists = db.users.some((u) => u.id === userId);
      if (!exists) return err("user_not_found", 404);
      db.users = db.users.filter((u) => u.id !== userId);
      return json({ status: "deleted" });
    }

    /* ---- absences (отсутствия) — зеркало absencesRoutes ---- */
    if (path === "/api/tenant/current/absences" && method === "GET") {
      const search = new URL(url, "http://x").searchParams;
      const fromDate = parseAbsenceDate(search.get("fromDate") ?? undefined);
      const toDate = parseAbsenceDate(search.get("toDate") ?? undefined);
      if (!fromDate || !toDate || !isValidAbsenceRange(fromDate, toDate)) {
        return err("resource_absence_invalid_range", 400);
      }
      const rawUserId = search.get("userId")?.trim() || undefined;
      if (rawUserId && !ROUTE_ID_RE.test(rawUserId)) return err("invalid_user_id", 400);
      // Боевой listAbsences: пересечение периода, сортировка по dateFrom asc.
      const absences = db.absences
        .filter((a) => a.dateFrom <= toDate && a.dateTo >= fromDate && (!rawUserId || a.userId === rawUserId))
        .sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : a.dateFrom > b.dateFrom ? 1 : 0));
      return json({ absences });
    }
    if (path === "/api/tenant/current/absences" && method === "POST") {
      // Порядок (зеркало parseCreateBody): userId → type/dates → range → reason.
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!ROUTE_ID_RE.test(userId)) return err("invalid_user_id", 400);
      const type = typeof body.type === "string" ? body.type.trim() : "";
      const dateFrom = parseAbsenceDate(typeof body.dateFrom === "string" ? body.dateFrom.trim() : "");
      const dateTo = parseAbsenceDate(typeof body.dateTo === "string" ? body.dateTo.trim() : "");
      if (!(ABSENCE_TYPES as readonly string[]).includes(type) || !dateFrom || !dateTo) {
        return err("resource_absence_invalid", 400);
      }
      if (!isValidAbsenceRange(dateFrom, dateTo)) return err("resource_absence_invalid_range", 400);
      if (body.reason !== null && body.reason !== undefined && typeof body.reason !== "string") {
        return err("resource_absence_invalid", 400);
      }
      const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
      if (reason && (reason.length > 500 || hasControlSingleLine(reason))) {
        return err("resource_absence_invalid", 400);
      }
      const created: ResourceAbsence = {
        id: cryptoRandom(), tenantId: TENANT, userId, type: type as AbsenceType,
        dateFrom, dateTo, status: "approved", reason, createdBy: ACTOR_ID, approvedBy: null,
        createdAt: nowIso(), updatedAt: nowIso()
      };
      db.absences.push(created);
      return json({ absence: created }, 201);
    }
    const absenceDelete = method === "DELETE" ? path.match(/^\/api\/tenant\/current\/absences\/([^/]+)$/) : null;
    if (absenceDelete) {
      // Боевой parseAbsenceIdParam: UUID (lowercased) — иначе 400 invalid_absence_id.
      const absenceId = decodeURIComponent(absenceDelete[1]!).trim().toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(absenceId)) {
        return err("invalid_absence_id", 400);
      }
      if (!db.absences.some((a) => a.id === absenceId)) return err("resource_absence_not_found", 404);
      db.absences = db.absences.filter((a) => a.id !== absenceId);
      return json({ ok: true });
    }

    /* ---- production-calendar (произв. календарь) — зеркало productionCalendarRoutes ---- */
    if (path === "/api/tenant/current/production-calendar" && method === "GET") {
      const yearRaw = new URL(url, "http://x").searchParams.get("year");
      const year = parseCalendarYear(yearRaw ?? undefined);
      if (year === null) return err("production_calendar_invalid", 400);
      return json(productionCalendarView(db, year));
    }
    if (path === "/api/tenant/current/production-calendar/bulk" && method === "POST") {
      // Зеркало parseBulkBody: exceptions[] ≤ 500; id/date/минуты/reason/resourceId по боевым правилам.
      if (!Array.isArray(body.exceptions) || body.exceptions.length > 500) {
        return err("production_calendar_invalid", 400);
      }
      const items: ProductionCalendarException[] = [];
      for (const entry of body.exceptions) {
        if (!entry || typeof entry !== "object") return err("production_calendar_invalid", 400);
        const row = entry as Record<string, unknown>;
        const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : cryptoRandom().replace(/[^a-z0-9-]/g, "").slice(0, 36) || "pc-generated";
        const date = typeof row.date === "string" ? row.date.trim() : "";
        const workingMinutes = typeof row.workingMinutes === "number" ? row.workingMinutes : null;
        if (
          !/^[a-z0-9][a-z0-9_-]{2,119}$/.test(id) || !parseAbsenceDate(date) ||
          workingMinutes === null || !Number.isInteger(workingMinutes) || workingMinutes < 0 || workingMinutes > 1440
        ) {
          return err("production_calendar_invalid", 400);
        }
        const resourceId = row.resourceId === null || row.resourceId === undefined
          ? null
          : typeof row.resourceId === "string" && ROUTE_ID_RE.test(row.resourceId.trim()) ? row.resourceId.trim() : false;
        if (resourceId === false) return err("production_calendar_invalid", 400);
        const reasonRaw = row.reason === null || row.reason === undefined ? null : row.reason;
        if (reasonRaw !== null && typeof reasonRaw !== "string") return err("production_calendar_invalid", 400);
        const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : null;
        if (reason !== null && (reason.length > 240 || hasControlSingleLine(reason))) {
          return err("production_calendar_invalid", 400);
        }
        items.push({ id, date, workingMinutes, reason: reason || null, resourceId });
      }
      for (const item of items) {
        const existing = db.calendarExceptions.findIndex((e) => e.id === item.id);
        if (existing >= 0) db.calendarExceptions[existing] = item;
        else db.calendarExceptions.push(item);
      }
      // Боевой ответ: календарь года отредактированных исключений (не текущего).
      const bulkYear = items[0]
        ? Number.parseInt(items[0].date.slice(0, 4), 10)
        : new Date().getUTCFullYear();
      return json(productionCalendarView(db, bulkYear));
    }
    if (path === "/api/tenant/current/production-calendar" && method === "PATCH") {
      // Зеркало parseBaseModeBody: workingWeekdays ISO 1..7 (уникальные, 1..7 шт.),
      // workingMinutesPerDay 1..1440 (оба поля обязательны).
      const rawWeekdays = body.workingWeekdays;
      if (!Array.isArray(rawWeekdays) || rawWeekdays.length < 1 || rawWeekdays.length > 7) {
        return err("production_calendar_invalid", 400);
      }
      const seenDays = new Set<number>();
      for (const day of rawWeekdays) {
        if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 7 || seenDays.has(day)) {
          return err("production_calendar_invalid", 400);
        }
        seenDays.add(day);
      }
      const minutes = body.workingMinutesPerDay;
      if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        return err("production_calendar_invalid", 400);
      }
      db.calendarBaseMode = {
        workingWeekdays: [...seenDays].sort((a, b) => a - b),
        workingMinutesPerDay: minutes
      };
      return json(productionCalendarView(db, new Date().getUTCFullYear()));
    }
    const calendarExceptionDeleteMatch = method === "DELETE"
      ? path.match(/^\/api\/tenant\/current\/production-calendar\/exceptions\/([^/]+)$/)
      : null;
    if (calendarExceptionDeleteMatch) {
      const id = decodeURIComponent(calendarExceptionDeleteMatch[1]!).trim();
      if (!/^[a-z0-9][a-z0-9_-]{2,119}$/.test(id)) return err("production_calendar_invalid", 400);
      const index = db.calendarExceptions.findIndex((e) => e.id === id);
      if (index < 0) return err("production_calendar_exception_not_found", 404);
      db.calendarExceptions.splice(index, 1);
      return json({ ok: true });
    }

    /* ---- background jobs (фоновые задачи) — зеркало backgroundJobRoutes, read-only ---- */
    if (path === "/api/workspace/background-jobs/runs" && method === "GET") {
      const search = new URL(url, "http://x").searchParams;
      const statusRaw = search.get("status")?.trim();
      if (statusRaw && !["queued", "running", "succeeded", "dead", "cancelled"].includes(statusRaw)) {
        return err("background_job_status_invalid", 400);
      }
      const limitRaw = search.get("limit");
      if (limitRaw && !/^[1-9][0-9]?$|^100$/.test(limitRaw)) return err("background_job_limit_invalid", 400);
      const limit = limitRaw ? Number(limitRaw) : 50;
      const runs = db.jobRuns
        .filter((run) => !statusRaw || run.status === statusRaw)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .slice(0, limit);
      return json({ runs });
    }
    const jobEventsMatch = method === "GET" ? path.match(/^\/api\/workspace\/background-jobs\/runs\/([^/]+)\/events$/) : null;
    if (jobEventsMatch) {
      const runId = decodeURIComponent(jobEventsMatch[1]!).trim();
      if (!/^background-job-[A-Za-z0-9._:-]+$/.test(runId)) return err("background_job_id_invalid", 400);
      const events = db.jobEvents
        .filter((event) => event.jobId === runId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
        .slice(0, 100);
      return json({ events });
    }

    return err("not_found", 404);
  };
  return mockFetch;
}

/* ---- Валидаторы отсутствий/календаря (зеркало absencesRoutes/productionCalendarRoutes) ---- */

// YYYY-MM-DD с честной проверкой существования дня (как боевой parseIsoDate/isValidCalendarDate).
function parseAbsenceDate(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) return null;
  return normalized;
}

// toDate ≥ fromDate и длительность ≤ 370 дней (боевой maxAbsenceRangeDays).
function isValidAbsenceRange(fromDate: string, toDate: string): boolean {
  const from = Date.UTC(...isoParts(fromDate));
  const to = Date.UTC(...isoParts(toDate));
  if (to < from) return false;
  return (to - from) / 86_400_000 + 1 <= 370;
}

function isoParts(value: string): [number, number, number] {
  const [y, m, d] = value.split("-").map(Number);
  return [y!, m! - 1, d!];
}

// Год календаря: отсутствует → текущий; 4 цифры в 2000..2100 (боевой parseYear).
function parseCalendarYear(value: string | undefined): number | null {
  if (!value) return new Date().getUTCFullYear();
  const normalized = value.trim();
  if (!/^\d{4}$/.test(normalized)) return null;
  const year = Number.parseInt(normalized, 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

// Ответ GET production-calendar: дефолты тенанта + исключения года (date asc, id asc).
function productionCalendarView(db: Store, year: number) {
  return {
    calendarId: "tenant-default",
    year,
    workingWeekdays: [...db.calendarBaseMode.workingWeekdays],
    workingMinutesPerDay: db.calendarBaseMode.workingMinutesPerDay,
    exceptions: db.calendarExceptions
      .filter((e) => e.date.startsWith(`${year}-`))
      .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1))
  };
}

// hex(64) для reset-токена мока — та же форма, что боевой randomBytes(32).toString("hex").
function randomHex64(): string {
  const c: Crypto | undefined = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let out = "";
  while (out.length < 64) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

// Псевдо-uuid для авто-id пользователя (мок; боевой — crypto.randomUUID()). Без управляющих байтов.
function cryptoRandom(): string {
  const c: Crypto | undefined = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Чтение строкового поля «как присутствует» (зеркало getStringField): нет ключа → undefined; строка → trim.
function field(input: Record<string, unknown>, key: string): string | undefined {
  if (!(key in input)) return undefined;
  const v = input[key];
  return typeof v === "string" ? v.trim() : undefined;
}
