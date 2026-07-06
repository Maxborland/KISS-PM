import { canReadTenantUsers } from "@kiss-pm/access-control";
import { parseTenantIdParam, parseUserIdParam } from "./routeParamParsers";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerDevTenantRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const { dataSource, getActor, getActorProfile, getDevActorFromHeaders } = deps;

  app.get("/api/session/dev-users", async (context) => {
    const users = (await dataSource.listDevUsers?.()) ?? [];

    return context.json({
      users: users.map((user) => ({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name
      }))
    });
  });

  app.get("/api/session/dev-login", async (context) => {
    const requestedUserId = context.req.query("userId") ?? null;
    if (requestedUserId !== null) {
      const parsedUserId = parseUserIdParam(requestedUserId);
      if (!parsedUserId.ok) return context.json({ error: parsedUserId.error }, 400);
    }

    const userId = requestedUserId?.trim() ?? null;
    const actor = await getActor(userId);

    if (!actor) {
      return context.json({ error: "dev_user_not_found" }, 404);
    }

    return context.json({
      user: {
        id: actor.id,
        tenantId: actor.tenantId,
        name: actor.name
      }
    });
  });

  app.get("/api/tenant/current", async (context) => {
    const actor = await getDevActorFromHeaders({
      cookie: context.req.header("cookie") ?? null,
      userId: context.req.header("x-user-id") ?? null
    });

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    const tenant = await dataSource.findTenantById?.(actor.tenantId);

    if (!tenant) {
      return context.json({ error: "tenant_not_found" }, 404);
    }

    return context.json({
      tenant,
      user: {
        id: actor.id,
        tenantId: actor.tenantId,
        name: actor.name
      }
    });
  });

  app.get("/api/tenant/:tenantId/users", async (context) => {
    const parsedTenantId = parseTenantIdParam(context.req.param("tenantId"));
    if (!parsedTenantId.ok) return context.json({ error: parsedTenantId.error }, 400);

    const actor = await getDevActorFromHeaders({
      cookie: context.req.header("cookie") ?? null,
      userId: context.req.header("x-user-id") ?? null
    });

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    const targetTenantId = parsedTenantId.value;
    const actorProfile = await getActorProfile(actor);
    const decision = canReadTenantUsers({
      actor,
      profile: actorProfile,
      targetTenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const users = (await dataSource.listUsersByTenantId?.(targetTenantId)) ?? [];

    return context.json({
      users: users.map((user) => ({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name
      }))
    });
  });
}
