/* ============================================================
   Auth API client — тонкий типизированный клиент над REST-ручками
   /api/auth/{login,logout,me} + profile (правка) + боевые
   register / password-reset/{request,confirm} (apps/api/src/authRegistrationRoutes.ts).

   Зеркало createCrmClient / createCommsClient: тот же приём с инъекцией
   fetchImpl, теми же credentials. Переключение на боевой API = передать
   реальный apiOrigin и убрать fetchImpl-мок.

   КРИТИЧНОЕ РАСХОЖДЕНИЕ С CRM/COMMS (боевой контракт):
   requestJson ПО УМОЛЧАНИЮ шлёт заголовок `x-kiss-pm-action: same-origin`
   (как crm/comms), НО для POST /api/auth/login заголовок НЕ слать — это
   ЕДИНСТВЕННАЯ мутация-исключение в requiresSameOriginActionHeader
   (apps/api/src/app.ts:278-281). Поэтому requestJson принимает
   opts.sameOrigin; login вызывает с sameOrigin:false. register/reset —
   заголовок ШЛЮТ (они НЕ в исключениях, требуют same-origin).
   ============================================================ */

import { createRequestJson, DomainApiError, type DomainClientOptions } from "../../lib/domain-client";

export type AuthApiClientOptions = DomainClientOptions;

// Общий класс ошибки транспорта; алиас сохраняет прежнее имя для instanceof-проверок.
export { DomainApiError as AuthApiError };

/* ============================================================
   View-типы (форма боевых ответов; §2 спеки).
   TenantUser ≠ WorkspaceUser — это РЕАЛЬНОЕ расхождение login vs me:
   POST /login отдаёт усечённый TenantUser (toPublicUser), GET /me —
   полный WorkspaceUser из listWorkspaceUsers (oneOf TenantUser|WorkspaceUser).
   ============================================================ */

/* Усечённая форма пользователя из POST /api/auth/login (боевой toPublicUser). */
export type TenantUser = { id: string; tenantId: string; name: string; accessProfileId: string };

/* Полная форма пользователя из GET /api/auth/me (боевой fullUser из listWorkspaceUsers).
   accentColor валидируется как /^#[0-9a-fA-F]{6}$/ (дефолт схемы #0f766e). */
export type WorkspaceUser = TenantUser & {
  workspaceName?: string;
  accessProfileName?: string;
  email: string;
  positionId: string | null;
  positionName: string | null;
  phone: string | null;
  telegram: string | null;
  status: "active" | "inactive";
  theme: "light" | "dark"; // боевой isWorkspaceTheme допускает ТОЛЬКО light|dark (НЕ system).
  accentColor: string;
};

/* Идентификатор рабочего пространства (= tenantId), возвращается во всех auth-ответах. */
export type WorkspaceIdentity = { id: string; name?: string };

export type LoginRequest = { email: string; password: string };

/* POST /api/auth/login → усечённый TenantUser + workspace. */
export type AuthSessionResponse = { user: TenantUser; workspace: WorkspaceIdentity };

/* GET /api/auth/me → полный (или усечённый) user + права + workspace. */
export type AuthMeResponse = { user: TenantUser | WorkspaceUser; permissions: string[]; workspace: WorkspaceIdentity };

/* Тело PATCH /api/profile (боевой): ТОЛЬКО name/phone/telegram. theme/accentColor — отдельная ручка. */
export type ProfileUpdateInput = Partial<{
  name: string;
  phone: string | null;
  telegram: string | null;
}>;

/* Тело PATCH /api/profile/theme (боевой): ТОЛЬКО theme/accentColor (light|dark / #RRGGBB). */
export type ThemeUpdateInput = Partial<{
  theme: "light" | "dark";
  accentColor: string;
}>;

/* GET /api/auth/sessions → активные сессии текущего пользователя (боевой serializeSession). */
export type AuthSession = {
  id: string;
  deviceLabel: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

/* Боевой контракт register/reset (apps/api/src/authRegistrationRoutes.ts + packages/domain/src/auth). */
export type RegisterRequest = { email: string; password: string; name: string; workspaceName?: string };
export type ResetRequestInput = { email: string };
export type ResetConfirmInput = { token: string; password: string };

export function createAuthClient(options: AuthApiClientOptions) {
  /* opts.sameOrigin (дефолт true) управляет заголовком x-kiss-pm-action.
     login передаёт sameOrigin:false — заголовок НЕ шлётся (боевое исключение). */
  const requestJson = createRequestJson(options);

  return {
    /* ---- БОЕВЫЕ ручки (мок зеркалит дословно) ---- */

    // POST /api/auth/login — sameOrigin:false (заголовок НЕ слать, боевое исключение app.ts:280).
    login(email: string, password: string) {
      return requestJson<AuthSessionResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password } satisfies LoginRequest) }, { sameOrigin: false });
    },
    // POST /api/auth/logout — идемпотентно, всегда {status:"ok"}.
    logout() {
      return requestJson<{ status: "ok" }>("/api/auth/logout", { method: "POST" });
    },
    // GET /api/auth/me — без сессии 401 session_required.
    me() {
      return requestJson<AuthMeResponse>("/api/auth/me");
    },
    // PATCH /api/profile — ТОЛЬКО name/phone/telegram → обновлённый WorkspaceUser (боевой).
    updateProfile(input: ProfileUpdateInput) {
      return requestJson<{ user: WorkspaceUser }>("/api/profile", { method: "PATCH", body: JSON.stringify(input) });
    },
    // PATCH /api/profile/theme — ОТДЕЛЬНАЯ ручка: ТОЛЬКО theme/accentColor → обновлённый WorkspaceUser (боевой).
    updateTheme(input: ThemeUpdateInput) {
      return requestJson<{ user: WorkspaceUser }>("/api/profile/theme", { method: "PATCH", body: JSON.stringify(input) });
    },
    requestDeactivation() {
      return requestJson<{ status: "recorded"; requestedAt: string }>("/api/profile/deactivation-request", { method: "POST" });
    },

    // GET /api/auth/sessions — активные сессии текущего пользователя (устройство/IP/активность/current).
    listSessions() {
      return requestJson<{ sessions: AuthSession[] }>("/api/auth/sessions");
    },
    // DELETE /api/auth/sessions/:id — отзыв чужой сессии (текущую нельзя → self_session_revoke_forbidden).
    revokeSession(sessionId: string) {
      return requestJson<{ status: "deleted" }>(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    },

    /* ---- БОЕВЫЕ ручки register/reset (мок зеркалит, authRegistrationRoutes.ts) ---- */

    // POST /api/auth/register — самрегистрация нового тенанта + авто-логин, 201 {user:TenantUser, workspace}.
    register(input: RegisterRequest) {
      return requestJson<AuthSessionResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
    },
    // POST /api/auth/password-reset/request — anti-enumeration, всегда 202 {status:"ok"}.
    requestPasswordReset(email: string) {
      return requestJson<{ status: "ok"; delivery?: "email" | "none"; devToken?: string }>("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email } satisfies ResetRequestInput) });
    },
    // POST /api/auth/password-reset/confirm — смена пароля по токену, 200 {status:"ok"}.
    confirmPasswordReset(token: string, password: string) {
      return requestJson<{ status: "ok" }>("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password } satisfies ResetConfirmInput) });
    },
    // POST /api/auth/invitation/accept — приём приглашения: сотрудник задаёт пароль
    // по одноразовому invite-токену и активируется, 200 {status:"ok"}. Тело идентично
    // reset/confirm (token + пароль ≥8).
    acceptInvitation(token: string, password: string) {
      return requestJson<{ status: "ok" }>("/api/auth/invitation/accept", { method: "POST", body: JSON.stringify({ token, password } satisfies ResetConfirmInput) });
    }
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
