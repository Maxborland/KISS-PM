/* ============================================================
   Contract-grounded mock backend для администрирования (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт ручек
   администрирования рабочей области:
     /api/workspace/access-roles            (GET / PATCH:id / DELETE:id)
     /api/tenant/current/access-profiles    (POST — создание роли)
     /api/workspace/users                   (GET / POST / PATCH:id / DELETE:id)
     /api/workspace/positions               (GET)
   Компонент работает через настоящий createAdminClient (с fetchImpl),
   поэтому переключение на боевой API = смена apiOrigin.

   Валидация и коды зеркалят apps/api (accessRoleRoutes / workspaceUserRoutes /
   workspaceParsers / routeParamParsers) ДОСЛОВНО: формат id, full-replace для
   роли, partial-merge для PATCH пользователя, коды конфликтов и 4xx, порядок
   проверок. RBAC actor — Администратор (полный набор прав), поэтому 403-веток
   нет; «текущий пользователь» (ACTOR_ID) защищён self-гвардами.
   ============================================================ */

import type { AccessProfile, AuditEvent, Permission, Position, SecurityPolicy, UserStatus, WorkspaceUser } from "./admin-client";
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

const nowIso = () => new Date().toISOString();

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);
const isPermission = (v: unknown): v is Permission => typeof v === "string" && PERMISSION_SET.has(v);

type Store = {
  accessRoles: AccessProfile[];
  users: WorkspaceUser[];
  positions: Position[];
  securityPolicy: SecurityPolicy;
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

  return { accessRoles, users, positions, securityPolicy };
}

/* ---- Транспорт: fetchImpl, совместимый с createAdminClient ---- */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);

// Сид журнала аудита: реальные action-типы со смешанными статусами (succeeded/denied/failed),
// по убыванию времени — как боевой listAuditEventsByTenantId (orderBy createdAt desc).
const AUDIT_EVENTS: AuditEvent[] = [
  { id: "audit-1", actionType: "workspace.security_policy.updated", createdAt: "2026-01-14T10:42:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "SecurityPolicy", id: TENANT } },
  { id: "audit-2", actionType: "access_role.created", createdAt: "2026-01-14T09:15:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "AccessProfile", id: "role-manager" } },
  { id: "audit-3", actionType: "workspace.user.deactivated", createdAt: "2026-01-13T17:30:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "User", id: "user-oleg" } },
  { id: "audit-4", actionType: "control_surface.published", createdAt: "2026-01-13T14:05:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "ControlSurface", id: "surface-deals" } },
  { id: "audit-5", actionType: "access_role.update", createdAt: "2026-01-13T11:20:00.000Z", executionResult: { status: "denied" }, sourceEntity: { type: "AccessProfile", id: "role-administrator" } },
  { id: "audit-6", actionType: "workspace.custom_field.created", createdAt: "2026-01-12T16:48:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "CustomFieldDefinition", id: "cf-priority" } },
  { id: "audit-7", actionType: "control_surface.publish_blocked", createdAt: "2026-01-12T13:10:00.000Z", executionResult: { status: "failed" }, sourceEntity: { type: "ControlSurface", id: "surface-projects" } },
  { id: "audit-8", actionType: "workspace.project_template.updated", createdAt: "2026-01-12T09:02:00.000Z", executionResult: { status: "succeeded" }, sourceEntity: { type: "ProjectTemplate", id: "tpl-default" } }
];

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
      const limit = Math.max(1, Math.min(100, Number(new URL(url, "http://x").searchParams.get("limit")) || 50));
      return json({ auditEvents: AUDIT_EVENTS.slice(0, limit) });
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

    /* ---- positions (позиции) — справочник, read-only сид ---- */
    // Сортировка по name (боевой repositories: orderBy positions.name).
    if (path === "/api/workspace/positions" && method === "GET") {
      return json({ positions: [...db.positions].sort((a, b) => a.name.localeCompare(b.name, "ru")) });
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

    return err("not_found", 404);
  };
  return mockFetch;
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
