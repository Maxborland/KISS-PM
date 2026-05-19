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

export function registerAuthRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    isWorkspaceUserActive,
    secureCookies
  } = deps;

  app.post("/api/auth/login", async (context) => {
    if (!dataSource.findCredentialByEmail || !dataSource.createSession) {
      return context.json({ error: "auth_not_configured" }, 501);
    }

    const body = await context.req.json().catch(() => null);
    const email =
      body &&
      typeof body === "object" &&
      typeof (body as { email?: unknown }).email === "string"
        ? (body as { email: string }).email.toLowerCase()
        : "";
    const password =
      body &&
      typeof body === "object" &&
      typeof (body as { password?: unknown }).password === "string"
        ? (body as { password: string }).password
        : "";
    const credential = await dataSource.findCredentialByEmail(email);

    if (
      !credential ||
      !verifyPassword({
        password,
        passwordHash: credential.passwordHash,
        passwordSalt: credential.passwordSalt
      })
    ) {
      return context.json({ error: "invalid_credentials" }, 401);
    }

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

function toPublicUser(user: TenantUser) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    accessProfileId: user.accessProfileId
  };
}
