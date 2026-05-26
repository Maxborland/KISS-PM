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
    const rateLimitDecision = deps.authRateLimiter.check(rateLimitInput);
    if (!rateLimitDecision.allowed) {
      context.header("Retry-After", String(rateLimitDecision.retryAfterSeconds));
      return context.json({ error: "too_many_login_attempts" }, 429);
    }
    const credential = await dataSource.findCredentialByEmail(email);

    const passwordMatches = verifyLoginPassword(password, credential);

    if (!credential || !passwordMatches) {
      deps.authRateLimiter.recordFailure(rateLimitInput);
      return context.json({ error: "invalid_credentials" }, 401);
    }
    deps.authRateLimiter.recordSuccess(rateLimitInput);

    const actor = await dataSource.findUserById(credential.userId);
    if (!actor) {
      return context.json({ error: "user_not_found" }, 404);
    }
    if (!(await isWorkspaceUserActive(actor))) {
      return context.json({ error: "user_inactive" }, 403);
    }

    const rawToken = randomBytes(32).toString("hex");
    await dataSource.createSession({
      id: `session-${randomUUID()}`,
      tenantId: credential.tenantId,
      userId: credential.userId,
      tokenHash: hashSessionToken(rawToken),
      expiresAt: new Date(Date.now() + sessionTtlMs)
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
