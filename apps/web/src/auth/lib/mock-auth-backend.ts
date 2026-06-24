/* ============================================================
   Contract-grounded mock backend для Auth/Профиль (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, реализующий реальный REST-контракт
   /api/auth/{login,logout,me} + правку профиля + register /
   password-reset/{request,confirm} — ВСЕ боевые. Компонент работает через
   настоящий createAuthClient (с fetchImpl), поэтому переключение на боевой
   API = смена apiOrigin.

   СЕССИЯ В МОКЕ (важно): боевой ставит HttpOnly-cookie kiss_pm_session,
   который JS прочитать НЕ может. Поэтому мок НЕ эмулирует чтение
   document.cookie — состояние логина держит замыкание (sessionToken /
   currentUserId). Set-Cookie в Response КОСМЕТИЧЕСКИЙ (клиент его не
   парсит). Это зеркало CURRENT_ACTOR_ID-стаба mock-comms-backend, но с
   переключаемым логин-состоянием. Каждый монтаж создаёт свой
   createMockAuthFetch() → изолированная сессия (как useCrm).

   ВСЕ ручки зеркалят боевой контракт:
   - login/logout/me + правка профиля — зеркаль дословно коды/статусы/
     порядок из apps/api/src/authRoutes.ts (rawMaps area auth-login).
   - register / password-reset/* — боевой контракт реализован
     apps/api/src/authRegistrationRoutes.ts + packages/domain/src/auth;
     мок зеркалит коды/статусы/порядок. Единственное упрощение —
     письма нет: токен сброса отдаётся отдельным devToken-полем как
     демо-замена письма (в боевом ответе только {status:"ok"}).
   ============================================================ */

import type { TenantUser, WorkspaceUser } from "./auth-client";

const TENANT = "tenant-alpha";
const ACCESS_PROFILE = "ap-admin"; // дефолтная роль демо-тенанта (на боевом — access_profile_id NOT NULL)

// Боевые параметры login-валидации (parseLoginCredentials, authRoutes.ts:160).
const MAX_EMAIL = 254;
const MAX_PASSWORD = 1024;
const MIN_EMAIL = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Парольная политика register/reset — боевой контракт (PASSWORD_POLICY в packages/domain/src/auth: ≥8, ≤1024, без control-chars).
const MIN_STRONG_PASSWORD = 8;
const MAX_NAME = 160; // register: имя single-line 1..160 (боевой parseSingleLineName, packages/domain/src/auth).
// Лимиты правки профиля — ДОСЛОВНО боевой parseProfileTextField (profileRoutes.ts:50-52).
const MAX_PROFILE_NAME = 120;
const MAX_PROFILE_PHONE = 64;
const MAX_PROFILE_TELEGRAM = 64;
// Демо-окно rate-limit: БОЕВОЕ = 5 неудач / 15 мин на email+ip + Retry-After.
// Здесь окно ужато для проходимости стори (3 попытки), коды/статус — боевые.
const RL_MAX_FAILURES = 3; // демо-окно, боевое 5/15мин
const RL_WINDOW_MS = 15 * 60 * 1000; // демо-окно, боевое 15мин
const RL_RETRY_AFTER_SEC = 900; // Retry-After в секундах (боевое окно)

let SEQ = 0;
const nowIso = () => new Date().toISOString();
// rawToken/session-token — 64-hex (боевой формат randomBytes(32).toString("hex")).
const hex64 = (seed: number) => (seed.toString(16).padStart(2, "0").repeat(32)).slice(0, 64);
const genToken = () => hex64((Date.now() & 0xff) ^ ((SEQ += 1) & 0xff) ^ 0xa5);

// Управляющие символы: коды 0x00..0x1f и 0x7f (как боевой parseLoginCredentials).
const hasControlChar = (v: string): boolean => {
  for (let i = 0; i < v.length; i += 1) {
    const c = v.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
};

type Credential = { userId: string; password: string }; // plaintext-демо, НЕ scrypt (честное упрощение мока)
type ResetToken = { userId: string; expiresAt: number; consumedAt: number | null };

/* ---- Сид (§5): пользователи + креды + reset-токены ---- */
function seedUsers(): WorkspaceUser[] {
  const base = (over: Partial<WorkspaceUser> & { id: string; name: string; email: string }): WorkspaceUser => ({
    tenantId: TENANT,
    accessProfileId: ACCESS_PROFILE,
    positionId: null,
    positionName: null,
    phone: null,
    telegram: null,
    status: "active",
    theme: "light",
    accentColor: "#0f766e", // дефолт схемы tenant_users
    ...over
  });
  return [
    // Активный демо-админ (seed-кред seed.ts:424; theme light, accentColor #0f766e).
    base({
      id: "u-admin",
      name: "Администратор",
      email: "admin@kiss-pm.local",
      accessProfileId: ACCESS_PROFILE,
      positionId: "pm",
      positionName: "Менеджер проектов",
      phone: "+7 999 000-00-00",
      telegram: "@kisspm_admin"
    }),
    // Неактивный пользователь — для демонстрации 403 user_inactive на login.
    base({ id: "u-inactive", name: "Пётр Неактивный", email: "inactive@kiss-pm.local", status: "inactive" })
  ];
}

// Реалистичный набор прав (подмножество adminPermissions из seed.ts:455).
const SEED_PERMISSIONS = [
  "tenant.users.read",
  "tenant.clients.read",
  "tenant.clients.manage",
  "tenant.opportunities.read",
  "tenant.opportunities.manage",
  "tenant.projects.read",
  "tenant.project_plan.read",
  "tenant.project_plan.manage",
  "tenant.communications.read",
  "tenant.communications.manage",
  "profile.read",
  "profile.update",
  "workspace.theme.manage"
];

/* ---- Транспорт: fetchImpl, совместимый с createAuthClient ---- */
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const err = (error: string, status: number, headers: Record<string, string> = {}) => json({ error }, status, headers);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Усечение WorkspaceUser → TenantUser (боевой toPublicUser): login отдаёт усечённую форму.
const toPublicUser = (u: WorkspaceUser): TenantUser => ({ id: u.id, tenantId: u.tenantId, name: u.name, accessProfileId: u.accessProfileId });

// Косметический Set-Cookie (клиент его НЕ парсит; состояние — в замыкании).
const sessionCookie = (rawToken: string) => `kiss_pm_session=${rawToken}; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=604800`;
const expiredCookie = () => "kiss_pm_session=; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=0";

/* Валидация login-тела ДОСЛОВНО как боевой parseLoginCredentials (authRoutes.ts:160):
   email trim+lowercase, длина 3..254, без control-chars, паттерн; password 1..1024. */
function parseLoginCredentials(body: Record<string, unknown>): { ok: true; email: string; password: string } | { ok: false } {
  if (typeof body.email !== "string" || typeof body.password !== "string") return { ok: false };
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  if (
    email.length < MIN_EMAIL ||
    email.length > MAX_EMAIL ||
    hasControlChar(email) ||
    !EMAIL_RE.test(email) ||
    password.length < 1 ||
    password.length > MAX_PASSWORD
  ) {
    return { ok: false };
  }
  return { ok: true, email, password };
}

// Единая парольная политика (≥8, ≤1024, без control-chars) — боевой parsePassword (packages/domain/src/auth).
const isWeakPassword = (v: unknown): boolean => typeof v !== "string" || v.length < MIN_STRONG_PASSWORD || v.length > MAX_PASSWORD || hasControlChar(v);

/* ---- PROFILE: парсеры ДОСЛОВНО зеркалят боевой profileRoutes.ts/parseHelpers.ts ---- */

type ProfileTextFieldParseResult = { ok: true; value: string | undefined } | { ok: false };

// Зеркало parseProfileTextField (profileRoutes.ts:180): ключ отсутствует → undefined (не менять);
// не string ИЛИ control-char ИЛИ trimmed > maxLength → невалидно; иначе trimmed.
function parseProfileTextField(body: Record<string, unknown>, key: string, maxLength: number): ProfileTextFieldParseResult {
  if (!(key in body)) return { ok: true, value: undefined };
  const value = body[key];
  if (typeof value !== "string") return { ok: false };
  if (hasControlChar(value)) return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { ok: false };
  return { ok: true, value: trimmed };
}

// Зеркало getStringField (parseHelpers.ts:9): ключ отсутствует/не string → undefined; иначе trim.
const getStringField = (body: Record<string, unknown>, key: string): string | undefined => {
  if (!(key in body)) return undefined;
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
};
// Зеркало isWorkspaceTheme (parseHelpers.ts:15): ТОЛЬКО light|dark (НЕ system).
const isWorkspaceTheme = (value: string): value is WorkspaceUser["theme"] => value === "light" || value === "dark";
// Зеркало isAccentColor (parseHelpers.ts:19): /^#[0-9a-fA-F]{6}$/.
const isAccentColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);
// Валидация email только по формату (register/reset-request) — боевой parseEmailValue (packages/domain/src/auth).
const isValidEmail = (v: unknown): v is string => typeof v === "string" && (() => { const e = v.trim().toLowerCase(); return e.length >= MIN_EMAIL && e.length <= MAX_EMAIL && !hasControlChar(e) && EMAIL_RE.test(e); })();

export function createMockAuthFetch(): typeof fetch {
  // ---- In-memory модель в замыкании (изолирована на каждый монтаж) ----
  let sessionToken: string | null = null; // null = anonymous (зеркало "нет валидного cookie")
  let currentUserId: string | null = null;
  const users: WorkspaceUser[] = seedUsers();
  // Креды: email → {userId, password}. plaintext-демо, НЕ scrypt — честное упрощение мока.
  const credentials = new Map<string, Credential>([
    ["admin@kiss-pm.local", { userId: "u-admin", password: "kiss-pm-admin" }],
    ["inactive@kiss-pm.local", { userId: "u-inactive", password: "kiss-pm-inactive" }]
  ]);
  // Reset-токены: один валидный, один просроченный, один использованный (rawToken — 64-hex).
  const VALID_RESET = "a".repeat(64);
  const EXPIRED_RESET = "b".repeat(64);
  const USED_RESET = "c".repeat(64);
  const resetTokens = new Map<string, ResetToken>([
    [VALID_RESET, { userId: "u-admin", expiresAt: Date.now() + 60 * 60 * 1000, consumedAt: null }],
    [EXPIRED_RESET, { userId: "u-admin", expiresAt: Date.now() - 60 * 1000, consumedAt: null }],
    [USED_RESET, { userId: "u-admin", expiresAt: Date.now() + 60 * 60 * 1000, consumedAt: Date.now() - 30 * 1000 }]
  ]);
  // Демо-rate-limiter: счётчик неудач по email в окне (боевое — email+ip+global, 5/15мин).
  const failures = new Map<string, { count: number; resetAt: number }>();

  const findUser = (id: string) => users.find((u) => u.id === id);

  const rateLimited = (email: string): boolean => {
    const rec = failures.get(email);
    if (!rec) return false;
    if (Date.now() > rec.resetAt) { failures.delete(email); return false; }
    return rec.count >= RL_MAX_FAILURES;
  };
  const recordFailure = (email: string) => {
    const rec = failures.get(email);
    if (!rec || Date.now() > rec.resetAt) failures.set(email, { count: 1, resetAt: Date.now() + RL_WINDOW_MS });
    else rec.count += 1;
  };
  const recordSuccess = (email: string) => { failures.delete(email); };

  // Установка/сброс сессии (зеркало createSession + Set-Cookie / expired-cookie).
  const startSession = (userId: string): string => { const t = genToken(); sessionToken = t; currentUserId = userId; return t; };
  const clearSession = () => { sessionToken = null; currentUserId = null; };

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try {
        const p: unknown = JSON.parse(String(init.body));
        if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>;
        else return err("invalid_json", 400); // тело не объект (как боевой readLimitedJsonBody / parse-гварды)
      } catch {
        return err("invalid_json", 400);
      }
    }

    /* ============================================================
       БОЕВЫЕ ручки — зеркаль дословно коды/статусы/порядок (authRoutes.ts)
       ============================================================ */

    // POST /api/auth/login — порядок: payload(400) → rate-limit(429) → credentials(401) → active(403) → 200.
    if (path === "/api/auth/login" && method === "POST") {
      const parsed = parseLoginCredentials(body);
      if (!parsed.ok) return err("invalid_login_payload", 400);
      const { email, password } = parsed;
      // rate-limit ДО проверки пароля (боевой reserveAttempt/check).
      if (rateLimited(email)) return err("too_many_login_attempts", 429, { "Retry-After": String(RL_RETRY_AFTER_SEC) });
      const credential = credentials.get(email);
      // ЕДИНЫЙ код invalid_credentials и для неизвестного email, и для неверного пароля (anti-enumeration).
      if (!credential || credential.password !== password) {
        recordFailure(email);
        return err("invalid_credentials", 401);
      }
      recordSuccess(email);
      const actor = findUser(credential.userId);
      // user_not_found(404) в моке не воспроизводим — сид консистентен; оставляем как страховку.
      if (!actor) return err("user_not_found", 404);
      if (actor.status === "inactive") return err("user_inactive", 403);
      const rawToken = startSession(actor.id);
      return json({ user: toPublicUser(actor), workspace: { id: actor.tenantId } }, 200, { "Set-Cookie": sessionCookie(rawToken) });
    }

    // POST /api/auth/logout — идемпотентно, всегда 200 {status:"ok"} + expired-cookie.
    if (path === "/api/auth/logout" && method === "POST") {
      clearSession();
      return json({ status: "ok" }, 200, { "Set-Cookie": expiredCookie() });
    }

    // GET /api/auth/me — нет сессии 401 session_required; иначе полный WorkspaceUser + права + workspace.
    if (path === "/api/auth/me" && method === "GET") {
      if (sessionToken === null || currentUserId === null) return err("session_required", 401);
      const actor = findUser(currentUserId);
      if (!actor) return err("session_required", 401);
      return json({ user: actor, permissions: SEED_PERMISSIONS, workspace: { id: actor.tenantId } });
    }

    /* ---- PROFILE: ДВЕ боевые ручки (profileRoutes.ts зеркаль 1:1) ---- */

    // PATCH /api/profile — ТОЛЬКО name/phone/telegram (theme/accentColor этой ручкой НЕ трогаются).
    // нет сессии 401; ЕДИНЫЙ код invalid_profile_payload при любом невалидном поле (400);
    // лимиты 120/64/64; control-char-чек; trim; empty-name → keep; phone/telegram ''→null.
    if (path === "/api/profile" && method === "PATCH") {
      if (sessionToken === null || currentUserId === null) return err("session_required", 401);
      const actor = findUser(currentUserId);
      if (!actor) return err("session_required", 401);

      const nameInput = parseProfileTextField(body, "name", MAX_PROFILE_NAME);
      const phoneInput = parseProfileTextField(body, "phone", MAX_PROFILE_PHONE);
      const telegramInput = parseProfileTextField(body, "telegram", MAX_PROFILE_TELEGRAM);
      // ЛЮБОЕ невалидное из трёх → единый код (без дробных invalid_profile_*).
      if (!nameInput.ok || !phoneInput.ok || !telegramInput.ok) return err("invalid_profile_payload", 400);

      // name: undefined ИЛИ пусто после trim → оставить текущее; иначе trimmed.
      actor.name = nameInput.value === undefined || nameInput.value.length === 0 ? actor.name : nameInput.value;
      // phone/telegram: undefined → оставить; иначе trimmed || null (пустая строка → null).
      actor.phone = phoneInput.value === undefined ? actor.phone : phoneInput.value || null;
      actor.telegram = telegramInput.value === undefined ? actor.telegram : telegramInput.value || null;
      return json({ user: actor });
    }

    // PATCH /api/profile/theme — ОТДЕЛЬНАЯ ручка: ТОЛЬКО theme/accentColor.
    // нет сессии 401; theme/accentColor пусто/отсутствует → keep; isWorkspaceTheme (light|dark) →
    // иначе invalid_theme(400); isAccentColor (#RRGGBB) → иначе invalid_accent_color(400);
    // применяется theme + accentColor.toLowerCase().
    if (path === "/api/profile/theme" && method === "PATCH") {
      if (sessionToken === null || currentUserId === null) return err("session_required", 401);
      const actor = findUser(currentUserId);
      if (!actor) return err("session_required", 401);

      const themeInput = getStringField(body, "theme");
      const accentInput = getStringField(body, "accentColor");
      const theme = themeInput === undefined || themeInput === "" ? actor.theme : themeInput;
      const accentColor = accentInput === undefined || accentInput === "" ? actor.accentColor : accentInput;

      if (!isWorkspaceTheme(theme)) return err("invalid_theme", 400);
      if (!isAccentColor(accentColor)) return err("invalid_accent_color", 400);

      actor.theme = theme;
      actor.accentColor = accentColor.toLowerCase();
      return json({ user: actor });
    }

    /* ============================================================
       БОЕВЫЕ ручки register / password-reset/* (реализованы
       apps/api/src/authRegistrationRoutes.ts + packages/domain/src/auth).
       Мок зеркалит коды/статусы/порядок. Упрощение — письма нет:
       reset-токен отдаётся devToken-полем как демо-замена письма.
       ============================================================ */

    // POST /api/auth/register {email,password,name} — САМРЕГИСТРАЦИЯ НОВОГО ТЕНАНТА.
    //   400 invalid_registration_payload → 400 weak_password → 409 email_taken → 201 (авто-логин).
    //   МОДЕЛЬ (боевой): создаётся свежий tenantId + роль-владелец + пользователь, ответ
    //   workspace.id = новый tenantId. Боевой: tenant-${randomUUID()} / access-profile-${randomUUID()}.
    if (path === "/api/auth/register" && method === "POST") {
      const email = isValidEmail(body.email) ? str(body.email).toLowerCase() : null;
      const name = str(body.name);
      // payload: email формат + name single-line 1..160 (боевой parseRegistrationInput).
      if (!email || !name || name.length > MAX_NAME || hasControlChar(name)) return err("invalid_registration_payload", 400);
      // weak_password ПОСЛЕ payload (порядок как в боевом домене).
      if (isWeakPassword(body.password)) return err("weak_password", 400);
      // email занят глобально (по credentials; на боевом — findCredentialByEmail глобально уникален).
      if (credentials.has(email)) return err("email_taken", 409);
      // Самрегистрация: свежий tenantId + accessProfileId владельца + пользователь (зеркало боевого).
      const suffix = `${(SEQ += 1).toString(36)}-${Date.now().toString(36)}`;
      const tenantId = `tenant-${suffix}`;
      const accessProfileId = `access-profile-${suffix}`;
      const id = `user-${suffix}`;
      const user: WorkspaceUser = {
        id, tenantId, name, accessProfileId, email,
        positionId: null, positionName: null, phone: null, telegram: null,
        status: "active", theme: "light", accentColor: "#0f766e"
      };
      users.push(user);
      credentials.set(email, { userId: id, password: body.password as string });
      const rawToken = startSession(id); // авто-логин
      return json({ user: toPublicUser(user), workspace: { id: tenantId } }, 201, { "Set-Cookie": sessionCookie(rawToken) });
    }

    // POST /api/auth/password-reset/request {email}
    //   400 invalid_email (только формат) → ВСЕГДА 202 {status:"ok"} (anti-enumeration).
    //   Боевой ответ — только {status:"ok"} (токен доставляется EmailProvider). Мок письма не имеет
    //   → для зарегистрированного email отдаёт devToken отдельным полем как ДЕМО-ЗАМЕНУ ПИСЬМА
    //   (НЕ часть боевого ответа; в проде токен уходит письмом).
    if (path === "/api/auth/password-reset/request" && method === "POST") {
      if (!isValidEmail(body.email)) return err("invalid_email", 400);
      const email = str(body.email).toLowerCase();
      const credential = credentials.get(email);
      // Если email есть — создать reset-токен (боевой шлёт письмо; здесь токен честно показывается в UI).
      if (credential) {
        const rawToken = genToken();
        resetTokens.set(rawToken, { userId: credential.userId, expiresAt: Date.now() + 60 * 60 * 1000, consumedAt: null });
        // НЕ раскрываем существование email в статусе; devToken — демо-замена письма (не часть боевого ответа).
        return json({ status: "ok", devToken: rawToken }, 202);
      }
      // Несуществующий email → ВСЕ РАВНО 202 (НЕ раскрывать email_not_found).
      return json({ status: "ok" }, 202);
    }

    // POST /api/auth/password-reset/confirm {token,password}
    //   400 invalid_reset_confirm_payload → 400 weak_password → 400 invalid_reset_token
    //   → 400 token_expired → 400 reset_token_used → 200 {status:"ok"}.
    if (path === "/api/auth/password-reset/confirm" && method === "POST") {
      const token = str(body.token);
      if (!token) return err("invalid_reset_confirm_payload", 400);
      if (isWeakPassword(body.password)) return err("weak_password", 400);
      const record = resetTokens.get(token);
      if (!record) return err("invalid_reset_token", 400);
      if (Date.now() > record.expiresAt) return err("token_expired", 400);
      if (record.consumedAt !== null) return err("reset_token_used", 400);
      // Сменить пароль, consumedAt=now, сбросить сессии пользователя.
      const user = findUser(record.userId);
      if (user) credentials.set(user.email, { userId: user.id, password: body.password as string });
      record.consumedAt = Date.now();
      if (currentUserId === record.userId) clearSession(); // инвалидация сессий пользователя
      return json({ status: "ok" });
    }

    // Неизвестный путь — 404 (как боевой роутер).
    return err("not_found", 404);
  };

  return mockFetch;
}
