/* ============================================================
   Admin API client — тонкий типизированный клиент над REST-ручками
   администрирования рабочей области:
     /api/workspace/access-roles      (роли / access-profiles)
     /api/tenant/current/access-profiles (создание роли)
     /api/workspace/users             (пользователи)
     /api/workspace/positions         (позиции / должности)
     /api/tenant/current/absences     (отсутствия ресурсов)
     /api/tenant/current/production-calendar (произв. календарь + исключения)
     /api/workspace/background-jobs/runs (фоновые задачи, read-only)

   Зеркало createCrmClient / createPlanningApiClient: тот же приём с
   инъекцией fetchImpl, теми же заголовками (x-kiss-pm-action:same-origin)
   и credentials:include. Переключение на боевой API = передать реальный
   apiOrigin и убрать fetchImpl-мок.

   ВАЖНО: контракт админки распределён по нескольким ручкам и НЕ полностью
   симметричен (создание роли живёт под /api/tenant/current/access-profiles,
   а list/update/delete — под /api/workspace/access-roles). Деактивация
   пользователя — это PATCH со status:"inactive" (отдельной ручки нет).
   ============================================================ */

import { createRequestJson, DomainApiError, type DomainClientOptions } from "../../lib/domain-client";

export type AdminApiClientOptions = DomainClientOptions;

// Общий класс ошибки транспорта; алиас сохраняет прежнее имя для instanceof-проверок.
export { DomainApiError as AdminApiError };

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
  accessProfileName?: string;
};
export type WorkspaceUserListResponse = {
  users: WorkspaceUser[];
  privateFieldsIncluded?: boolean;
};

export function workspaceUserCountsAreKnown(response: WorkspaceUserListResponse): boolean {
  return response.privateFieldsIncluded !== false;
}
// Позиция (должность). Боевой PositionRecord.
export type Position = { id: string; tenantId: string; name: string; description: string | null };
// Тело создания должности (POST /api/workspace/positions): id опционален — сервер сгенерирует position-<uuid>.
export type PositionCreateInput = { id?: string; name: string; description?: string | null };
// Тело правки должности (PATCH /api/workspace/positions/:positionId) — full-replace, id из URL.
export type PositionUpdateInput = { name: string; description?: string | null };

// Политика безопасности рабочей области (боевой TenantSecurityPolicy). Один экземпляр на тенант.
export type SecurityPolicy = {
  // RESERVED (Н5): механизм 2FA в auth-стеке не реализован — поле контракта сохранено
  // для совместимости, UI не показывает контрол и передаёт значение без изменений.
  twoFactorRequired: boolean;
  sessionTimeoutHours: number;
  // RESERVED (Н5): SAML-интеграции нет — поле передаётся как есть, контрола в UI нет.
  ssoSamlEnabled: boolean;
  domainAllowlist: string[];
};

// Событие журнала аудита (боевой GET /api/tenant/current/audit-events).
export type AuditEvent = {
  id: string;
  actionType: string;
  createdAt: string;
  // Кто совершил действие: боевой auditRoutes отдаёт запись целиком (…event), включая actorUserId.
  actorUserId?: string | null;
  executionResult?: { status?: string } | null;
  sourceEntity?: { type?: string; id?: string } | null;
};

// Отсутствие ресурса (боевой ResourceAbsenceRecord из absencesRoutes; даты — YYYY-MM-DD).
export const ABSENCE_TYPES = ["vacation", "admin_leave", "sick_leave", "maternity_leave", "truancy"] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];
export type ResourceAbsence = {
  id: string; tenantId: string; userId: string; type: AbsenceType;
  dateFrom: string; dateTo: string; status: string; reason: string | null;
  createdBy: string | null; approvedBy: string | null;
  createdAt: string; updatedAt: string;
};
// Тело создания отсутствия (POST /api/tenant/current/absences): диапазон ≤ 370 дней, reason ≤ 500.
export type AbsenceCreateInput = {
  userId: string; type: AbsenceType; dateFrom: string; dateTo: string; reason?: string | null;
};

// Производственный календарь тенанта (боевой GET /api/tenant/current/production-calendar?year=YYYY —
// ответ БЕЗ обёртки). Исключение: workingMinutes 0 = выходной, 1..1440 = сокращённый/особый день.
export type ProductionCalendarException = {
  id: string; date: string; workingMinutes: number; reason: string | null; resourceId: string | null;
};
export type ProductionCalendar = {
  calendarId: string; year: number; workingWeekdays: number[]; workingMinutesPerDay: number;
  exceptions: ProductionCalendarException[];
};
// Элемент bulk-upsert исключений (POST /bulk): id опционален (сервер сгенерирует), ≤ 500 за запрос.
export type ProductionCalendarBulkItem = {
  id?: string; date: string; workingMinutes: number; reason?: string | null; resourceId?: string | null;
};

// Прогон фоновой задачи (боевой serializeJobRun из backgroundJobRoutes: даты — ISO-строки).
export type BackgroundJobStatus = "queued" | "running" | "succeeded" | "dead" | "cancelled";
export type BackgroundJobRun = {
  id: string; tenantId: string; kind: string; status: BackgroundJobStatus;
  priority: number; payload: Record<string, unknown>; idempotencyKey: string | null;
  attempt: number; maxAttempts: number; runAfter: string;
  lockedBy: string | null; lockedAt: string | null;
  startedAt: string | null; finishedAt: string | null; lastError: string | null;
  createdAt: string; updatedAt: string;
};
// Событие прогона (GET /runs/:runId/events, максимум 100).
export type BackgroundJobEvent = {
  id: string; tenantId: string; jobId: string; eventType: string;
  message: string; metadata: Record<string, unknown>; createdAt: string;
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
// Ответ POST /api/workspace/users/:userId/password-reset-token: raw-токен приходит
// РОВНО ОДИН РАЗ (сервер хранит только хэш), expiresAt — ISO-срок действия (60 минут).
export type UserResetTokenResponse = { resetToken: string; expiresAt: string };
// Тело PATCH /api/workspace/users/:userId — частичное (parseWorkspaceUserPatchBody мёржит с текущим).
export type UserUpdateInput = Partial<{
  email: string; name: string; accessProfileId: string;
  positionId: string | null; phone: string | null; telegram: string | null; status: UserStatus;
}>;

export function createAdminClient(options: AdminApiClientOptions) {
  const requestJson = createRequestJson(options);
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
    listUsers() { return requestJson<WorkspaceUserListResponse>("/api/workspace/users"); },
    createUser(input: UserCreateInput) { return requestJson<{ user: WorkspaceUser }>("/api/workspace/users", { method: "POST", body: JSON.stringify(input) }); },
    updateUser(userId: string, input: UserUpdateInput) { return requestJson<{ user: WorkspaceUser }>(`/api/workspace/users/${enc(userId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    // Деактивация = PATCH status:"inactive" (отдельной ручки нет; self_access_change_forbidden 400 для себя).
    deactivateUser(userId: string) { return requestJson<{ user: WorkspaceUser }>(`/api/workspace/users/${enc(userId)}`, { method: "PATCH", body: JSON.stringify({ status: "inactive" }) }); },
    // Выдача токена сброса пароля (POST …/password-reset-token). ЧЕСТНОСТЬ: токен из ответа
    // показывается один раз — сервер хранит только хэш и повторно его не отдаёт.
    issueUserPasswordResetToken(userId: string) { return requestJson<UserResetTokenResponse>(`/api/workspace/users/${enc(userId)}/password-reset-token`, { method: "POST" }); },

    // позиции (должности) — справочник для назначения пользователю
    listPositions() { return requestJson<{ positions: Position[] }>("/api/workspace/positions"); },
    createPosition(input: PositionCreateInput) { return requestJson<{ position: Position }>("/api/workspace/positions", { method: "POST", body: JSON.stringify(input) }); },
    updatePosition(positionId: string, input: PositionUpdateInput) { return requestJson<{ position: Position }>(`/api/workspace/positions/${enc(positionId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
    // Удаление: 409 position_assigned, если должность назначена пользователям (боевой positionRoutes).
    deletePosition(positionId: string) { return requestJson<{ status: "deleted" }>(`/api/workspace/positions/${enc(positionId)}`, { method: "DELETE" }); },

    // журнал аудита тенанта (GET /api/tenant/current/audit-events?limit=N) — последние события.
    listAuditEvents(limit = 50) { return requestJson<{ auditEvents: AuditEvent[] }>(`/api/tenant/current/audit-events?limit=${limit}`); },
    // точечная выборка события (deep-link ?event= из квитанций агента): запись может быть
    // старше окна ленты, поэтому читаем по id, а не поиском в списке.
    getAuditEvent(auditEventId: string) { return requestJson<{ auditEvent: AuditEvent }>(`/api/tenant/current/audit-events/${enc(auditEventId)}`); },

    // политика безопасности тенанта (GET/PUT /api/tenant/current/security-policy)
    getSecurityPolicy() { return requestJson<{ securityPolicy: SecurityPolicy }>("/api/tenant/current/security-policy"); },
    updateSecurityPolicy(input: SecurityPolicy) { return requestJson<{ securityPolicy: SecurityPolicy }>("/api/tenant/current/security-policy", { method: "PUT", body: JSON.stringify({ securityPolicy: input }) }); },

    // отсутствия (GET требует ОБЯЗАТЕЛЬНЫЙ период fromDate..toDate ≤ 370 дней — боевой absencesRoutes)
    listAbsences(fromDate: string, toDate: string, userId?: string) {
      const query = `fromDate=${enc(fromDate)}&toDate=${enc(toDate)}${userId ? `&userId=${enc(userId)}` : ""}`;
      return requestJson<{ absences: ResourceAbsence[] }>(`/api/tenant/current/absences?${query}`);
    },
    createAbsence(input: AbsenceCreateInput) { return requestJson<{ absence: ResourceAbsence }>("/api/tenant/current/absences", { method: "POST", body: JSON.stringify(input) }); },
    deleteAbsence(absenceId: string) { return requestJson<{ ok: true }>(`/api/tenant/current/absences/${enc(absenceId)}`, { method: "DELETE" }); },

    // производственный календарь (год 2000..2100; ответ без обёртки). Удаления исключения
    // в боевом API нет — только bulk-upsert (честно отражено в UI).
    getProductionCalendar(year?: number) { return requestJson<ProductionCalendar>(`/api/tenant/current/production-calendar${year ? `?year=${year}` : ""}`); },
    bulkUpsertProductionCalendarExceptions(exceptions: ProductionCalendarBulkItem[]) {
      return requestJson<ProductionCalendar>("/api/tenant/current/production-calendar/bulk", { method: "POST", body: JSON.stringify({ exceptions }) });
    },

    // фоновые задачи (read-only обзор: список прогонов + события прогона)
    listBackgroundJobRuns(input: { status?: BackgroundJobStatus; limit?: number } = {}) {
      const params = new URLSearchParams();
      if (input.status) params.set("status", input.status);
      if (input.limit) params.set("limit", String(input.limit));
      const query = params.toString();
      return requestJson<{ runs: BackgroundJobRun[] }>(`/api/workspace/background-jobs/runs${query ? `?${query}` : ""}`);
    },
    listBackgroundJobEvents(runId: string) { return requestJson<{ events: BackgroundJobEvent[] }>(`/api/workspace/background-jobs/runs/${enc(runId)}/events`); }
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
