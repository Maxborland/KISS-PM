import { hashSessionToken, verifyPassword } from "@kiss-pm/persistence";
import { randomBytes, randomUUID } from "node:crypto";
import {
  buildExpiredSessionCookieHeader,
  buildSessionCookieHeader,
  getSessionTokenFromCookie,
  sessionTtlMs
} from "./authSession";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import type { TenantUser } from "@kiss-pm/domain";
import { getClientIp } from "./authRateLimit";
import { readLimitedJsonBody } from "./jsonBody";

const dummyLoginPasswordRecord = {
  passwordHash:
    "8628f6260a2c5a566eb583da77de83c156308a75ce54f68d11c9383fc7ed0c4ecceb1d835be2c76353fe8c95060226b72eb8b5216f84411d607c343d0d061dec",
  passwordSalt: "kiss-pm-dummy-login-salt"
};
const maxLoginEmailLength = 254;
const maxLoginPasswordLength = 1024;
const loginEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerAuthRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    isWorkspaceUserActive,
    secureCookies,
    trustForwardedAuthHeaders
  } = deps;

  app.post("/api/auth/login", async (context) => {
    if (!dataSource.findCredentialByEmail || !dataSource.createSession) {
      return context.json({ error: "auth_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const credentials = parseLoginCredentials(body.value);
    if (!credentials.ok) return context.json({ error: credentials.error }, 400);
    const { email, password } = credentials.value;
    const rateLimitInput = {
      email,
      ip: getClientIp(context.req.raw.headers, {
        trustForwardedHeaders: trustForwardedAuthHeaders
      })
    };
    const reservedAttempt = Boolean(deps.authRateLimiter.reserveAttempt);
    const rateLimitDecision = deps.authRateLimiter.reserveAttempt
      ? await deps.authRateLimiter.reserveAttempt(rateLimitInput)
      : await deps.authRateLimiter.check(rateLimitInput);
    if (!rateLimitDecision.allowed) {
      context.header("Retry-After", String(rateLimitDecision.retryAfterSeconds));
      return context.json({ error: "too_many_login_attempts" }, 429);
    }
    try {
      const credential = await dataSource.findCredentialByEmail(email);

      const passwordMatches = verifyLoginPassword(password, credential);

      if (!credential || !passwordMatches) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, { reserved: reservedAttempt });
        return context.json({ error: "invalid_credentials" }, 401);
      }
      await deps.authRateLimiter.recordSuccess(rateLimitInput, { reserved: reservedAttempt });

      const actor = await dataSource.findUserById(credential.userId);
      if (!actor) {
        return context.json({ error: "user_not_found" }, 404);
      }
      if (!(await isWorkspaceUserActive(actor))) {
        return context.json({ error: "user_inactive" }, 403);
      }

      const rawToken = randomBytes(32).toString("hex");
      const loginNow = new Date();
      await dataSource.createSession({
        id: `session-${randomUUID()}`,
        tenantId: credential.tenantId,
        userId: credential.userId,
        tokenHash: hashSessionToken(rawToken),
        expiresAt: new Date(loginNow.getTime() + sessionTtlMs),
        userAgent: normalizeUserAgent(context.req.header("user-agent")),
        ipAddress: rateLimitInput.ip ?? null,
        lastSeenAt: loginNow
      });

      context.header(
        "Set-Cookie",
        buildSessionCookieHeader(rawToken, { secure: secureCookies })
      );

      return context.json({
        user: toPublicUser(actor),
        workspace: {
          id: actor.tenantId
        }
      });
    } catch (error) {
      if (reservedAttempt) {
        await deps.authRateLimiter.releaseReservedAttempt?.(rateLimitInput);
      }
      throw error;
    }
  });

  app.post("/api/auth/logout", async (context) => {
    if (dataSource.deleteSessionByTokenHash) {
      const token = getSessionTokenFromCookie(context.req.header("cookie") ?? null);
      if (token) {
        await dataSource.deleteSessionByTokenHash(hashSessionToken(token));
      }
    }

    context.header(
      "Set-Cookie",
      buildExpiredSessionCookieHeader({ secure: secureCookies })
    );
    return context.json({ status: "ok" });
  });

  app.get("/api/auth/me", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    const profile = await getActorProfile(actor);
    const users = dataSource.listWorkspaceUsers
      ? await dataSource.listWorkspaceUsers(actor.tenantId)
      : [];
    const fullUser = users.find((user) => user.id === actor.id);

    return context.json({
      user: fullUser ?? toPublicUser(actor),
      permissions: profile.permissions,
      workspace: {
        id: actor.tenantId
      }
    });
  });

  // Активные сессии текущего пользователя (устройство/IP/последняя активность).
  app.get("/api/auth/sessions", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listUserSessions) return context.json({ error: "auth_not_configured" }, 501);

    const token = getSessionTokenFromCookie(context.req.header("cookie") ?? null);
    const currentHash = token ? hashSessionToken(token) : null;
    const sessions = await dataSource.listUserSessions(actor.tenantId, actor.id);
    return context.json({
      sessions: sessions.map((session) => serializeSession(session, currentHash))
    });
  });

  // Отзыв конкретной сессии (кроме текущей — для выхода есть /logout).
  app.delete("/api/auth/sessions/:sessionId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listUserSessions || !dataSource.deleteSessionById) {
      return context.json({ error: "auth_not_configured" }, 501);
    }
    const sessionId = parseSessionId(context.req.param("sessionId"));
    if (!sessionId) return context.json({ error: "invalid_session_id" }, 400);

    const token = getSessionTokenFromCookie(context.req.header("cookie") ?? null);
    const currentHash = token ? hashSessionToken(token) : null;
    const sessions = await dataSource.listUserSessions(actor.tenantId, actor.id);
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return context.json({ error: "session_not_found" }, 404);
    if (currentHash && target.tokenHash === currentHash) {
      return context.json({ error: "self_session_revoke_forbidden" }, 400);
    }

    const deleted = await dataSource.deleteSessionById(actor.tenantId, actor.id, sessionId);
    if (!deleted) return context.json({ error: "session_not_found" }, 404);
    return context.json({ status: "deleted" });
  });
}

// Сессия → публичный вид: derived deviceLabel из UA, IP, время входа/активности, флаг текущей.
function serializeSession(
  session: {
    id: string;
    expiresAt: Date;
    createdAt?: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
    lastSeenAt?: Date | null;
    tokenHash: string;
  },
  currentHash: string | null
) {
  return {
    id: session.id,
    deviceLabel: describeUserAgent(session.userAgent ?? null),
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null,
    createdAt: (session.createdAt ?? session.lastSeenAt ?? session.expiresAt).toISOString(),
    lastSeenAt: (session.lastSeenAt ?? session.createdAt ?? session.expiresAt).toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    current: currentHash !== null && session.tokenHash === currentHash
  };
}

// UA → короткий человекочитаемый ярлык «Браузер · ОС». Эвристика (не библиотека) — достаточно для списка.
function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Неизвестное устройство";
  const ua = userAgent;
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : null;
  const os = /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : null;
  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return "Неизвестное устройство";
}

// Параметр маршрута sessionId: непустая строка ≤ 200, без управляющих символов.
function parseSessionId(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200 || hasControlChar(trimmed)) {
    return null;
  }
  return trimmed;
}

// UA из заголовка → null|строка ≤ 1024 без управляющих символов (защита от мусора в БД).
function normalizeUserAgent(userAgent: string | undefined): string | null {
  if (typeof userAgent !== "string") return null;
  const trimmed = userAgent.trim();
  if (trimmed.length === 0) return null;
  const clean = stripControlChars(trimmed);
  return clean.length === 0 ? null : clean.slice(0, 1024);
}

// Управляющие символы (0x00–0x1f, 0x7f) по char-кодам — без regex-литералов с control-байтами.
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

function stripControlChars(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c > 0x1f && c !== 0x7f) out += value[i];
  }
  return out;
}

export function verifyLoginPassword(
  password: string,
  credential:
    | {
        passwordHash: string;
        passwordSalt: string;
      }
    | undefined
) {
  return verifyPassword({
    password,
    passwordHash: credential?.passwordHash ?? dummyLoginPasswordRecord.passwordHash,
    passwordSalt: credential?.passwordSalt ?? dummyLoginPasswordRecord.passwordSalt
  });
}

function parseLoginCredentials(
  value: unknown
):
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "invalid_login_payload" };
  }
  const record = value as { email?: unknown; password?: unknown };
  if (typeof record.email !== "string" || typeof record.password !== "string") {
    return { ok: false, error: "invalid_login_payload" };
  }
  const email = record.email.trim().toLowerCase();
  const password = record.password;
  if (
    email.length < 3 ||
    email.length > maxLoginEmailLength ||
    /[\u0000-\u001f\u007f]/.test(email) ||
    !loginEmailPattern.test(email) ||
    password.length < 1 ||
    password.length > maxLoginPasswordLength
  ) {
    return { ok: false, error: "invalid_login_payload" };
  }
  return { ok: true, value: { email, password } };
}

function toPublicUser(user: TenantUser) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    accessProfileId: user.accessProfileId
  };
}
