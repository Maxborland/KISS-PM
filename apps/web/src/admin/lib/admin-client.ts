/* ============================================================
   Admin API client — тонкий типизированный клиент над REST-ручками
   администрирования рабочей области:
     /api/workspace/access-roles      (роли / access-profiles)
     /api/tenant/current/access-profiles (создание роли)
     /api/workspace/users             (пользователи)
     /api/workspace/positions         (позиции / должности)

   Зеркало createCrmClient / createPlanningApiClient: тот же приём с
   инъекцией fetchImpl, теми же заголовками (x-kiss-pm-action:same-origin)
   и credentials:include. Переключение на боевой API = передать реальный
   apiOrigin и убрать fetchImpl-мок.

   ВАЖНО: контракт админки распределён по нескольким ручкам и НЕ полностью
   симметричен (создание роли живёт под /api/tenant/current/access-profiles,
   а list/update/delete — под /api/workspace/access-roles). Деактивация
   пользователя — это PATCH со status:"inactive" (отдельной ручки нет).
   ============================================================ */

export type AdminApiClientOptions = { apiOrigin: string; fetchImpl?: typeof fetch; credentials?: RequestCredentials };

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;
  constructor(status: number, code: string, body: Record<string, unknown>) {
    super(code);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/* ---- View-типы (форма боевых записей) ---- */
// Перечень прав — packages/access-control/src/index.ts (полный список permission-строк).
export type Permission = string;
export type UserStatus = "active" | "inactive";

// Роль доступа (access-profile). Боевой AccessProfileRecord = AccessProfile + { tenantId, name }.
export type AccessProfile = { id: string; tenantId: string; name: string; permissions: Permission[] };
// Пользователь рабочей области. Боевой WorkspaceUserRecord = TenantUser + email/position*/контакты/status/тема.
export type WorkspaceUser = {
  id: string; tenantId: string; email: string; name: string;
  accessProfileId: string; positionId: string | null; positionName: string | null;
  phone: string | null; telegram: string | null; status: UserStatus;
  theme: string; accentColor: string;
};
// Позиция (должность). Боевой PositionRecord.
export type Position = { id: string; tenantId: string; name: string; description: string | null };

// Политика безопасности рабочей области (боевой TenantSecurityPolicy). Один экземпляр на тенант.
export type SecurityPolicy = {
  twoFactorRequired: boolean;
  sessionTimeoutHours: number;
  ssoSamlEnabled: boolean;
  domainAllowlist: string[];
};

// Событие журнала аудита (боевой GET /api/tenant/current/audit-events).
export type AuditEvent = {
  id: string;
  actionType: string;
  createdAt: string;
  executionResult?: { status?: string } | null;
  sourceEntity?: { type?: string; id?: string } | null;
};

// Тело создания роли (POST /api/tenant/current/access-profiles). id обязателен (боевой parseAccessProfileCreateBody).
export type AccessRoleCreateInput = { id: string; name: string; permissions: Permission[] };
// Тело обновления роли (PATCH /api/workspace/access-roles/:roleId) — full-replace (id из URL).
export type AccessRoleUpdateInput = { name: string; permissions: Permission[] };

// Тело создания пользователя (POST /api/workspace/users). password обязателен (≥ 8), id опционален.
export type UserCreateInput = {
  email: string; name: string; accessProfileId: string; password: string;
  id?: string; positionId?: string | null; phone?: string | null; telegram?: string | null; status?: UserStatus;
};
// Тело PATCH /api/workspace/users/:userId — частичное (parseWorkspaceUserPatchBody мёржит с текущим).
export type UserUpdateInput = Partial<{
  email: string; name: string; accessProfileId: string;
  positionId: string | null; phone: string | null; telegram: string | null; status: UserStatus;
}>;

export function createAdminClient(options: AdminApiClientOptions) {
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
      throw new AdminApiError(response.status, typeof body.error === "string" ? body.error : "request_failed", body);
    }
    return body as T;
  }

  const enc = encodeURIComponent;
  return {
    // роли (access-profiles): list/update/delete под /access-roles; create под /tenant/current/access-profiles
    listAccessRoles() { return requestJson<{ accessRoles: AccessProfile[] }>("/api/workspace/access-roles"); },
    // Каталог назначаемых прав (статический список access-control) — для чек-листа ролей.
    listPermissionCatalog() { return requestJson<{ permissions: Permission[] }>("/api/workspace/permission-catalog"); },
    createAccessRole(input: AccessRoleCreateInput) { return requestJson<{ accessProfile: AccessProfile }>("/api/tenant/current/access-profiles", { method: "POST", body: JSON.stringify(input) }); },
    updateAccessRole(roleId: string, input: AccessRoleUpdateInput) { return requestJson<{ accessRole: AccessProfile }>(`/api/workspace/access-roles/${enc(roleId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    deleteAccessRole(roleId: string) { return requestJson<{ status: "deleted" }>(`/api/workspace/access-roles/${enc(roleId)}`, { method: "DELETE" }); },

    // пользователи
    listUsers() { return requestJson<{ users: WorkspaceUser[] }>("/api/workspace/users"); },
    createUser(input: UserCreateInput) { return requestJson<{ user: WorkspaceUser }>("/api/workspace/users", { method: "POST", body: JSON.stringify(input) }); },
    updateUser(userId: string, input: UserUpdateInput) { return requestJson<{ user: WorkspaceUser }>(`/api/workspace/users/${enc(userId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    // Деактивация = PATCH status:"inactive" (отдельной ручки нет; self_access_change_forbidden 400 для себя).
    deactivateUser(userId: string) { return requestJson<{ user: WorkspaceUser }>(`/api/workspace/users/${enc(userId)}`, { method: "PATCH", body: JSON.stringify({ status: "inactive" }) }); },

    // позиции (должности) — справочник для назначения пользователю
    listPositions() { return requestJson<{ positions: Position[] }>("/api/workspace/positions"); },

    // журнал аудита тенанта (GET /api/tenant/current/audit-events?limit=N) — последние события.
    listAuditEvents(limit = 50) { return requestJson<{ auditEvents: AuditEvent[] }>(`/api/tenant/current/audit-events?limit=${limit}`); },

    // политика безопасности тенанта (GET/PUT /api/tenant/current/security-policy)
    getSecurityPolicy() { return requestJson<{ securityPolicy: SecurityPolicy }>("/api/tenant/current/security-policy"); },
    updateSecurityPolicy(input: SecurityPolicy) { return requestJson<{ securityPolicy: SecurityPolicy }>("/api/tenant/current/security-policy", { method: "PUT", body: JSON.stringify({ securityPolicy: input }) }); }
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
