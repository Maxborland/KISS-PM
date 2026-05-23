import { canReadProjectResources, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiRouteDeps } from "../routeTypes";
import { createCapacityCache } from "./capacityCache";
import {
  buildWorkspaceCapacitySummary,
  buildWorkspaceCapacityTree
} from "./capacityService";

const treeCache = createCapacityCache<Awaited<ReturnType<typeof buildWorkspaceCapacityTree>>>(60_000);
const summaryCache = createCapacityCache<Awaited<ReturnType<typeof buildWorkspaceCapacitySummary>>>(
  60_000
);

export function invalidateCapacityCacheForTenant(tenantId: string) {
  treeCache.invalidateTenant(tenantId);
  summaryCache.invalidateTenant(tenantId);
}

export function registerCapacityRoutes(app: Hono, deps: ApiRouteDeps) {
  app.get("/api/workspace/capacity/tree", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const monthIso = context.req.query("monthIso") ?? "";
    const projectId = context.req.query("projectId") ?? null;
    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjectResources({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const cacheKey = `${actor.tenantId}:tree:${monthIso}:${projectId ?? ""}`;
    const cached = treeCache.get(cacheKey);
    if (cached !== undefined) {
      return context.json(cached);
    }

    const tree = await buildWorkspaceCapacityTree(deps.dataSource, {
      tenantId: actor.tenantId,
      monthIso,
      projectId,
      actor,
      profile
    });
    if (!tree) return context.json({ error: "capacity_invalid_month" }, 400);

    treeCache.set(cacheKey, tree);
    return context.json(tree);
  });

  app.get("/api/workspace/capacity/summary", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const monthIso = context.req.query("monthIso") ?? "";
    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjectResources({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const cacheKey = `${actor.tenantId}:summary:${monthIso}`;
    const cached = summaryCache.get(cacheKey);
    if (cached !== undefined) {
      return context.json(cached);
    }

    const summary = await buildWorkspaceCapacitySummary(deps.dataSource, {
      tenantId: actor.tenantId,
      monthIso,
      actor,
      profile
    });
    if (!summary) return context.json({ error: "capacity_invalid_month" }, 400);

    summaryCache.set(cacheKey, summary);
    return context.json(summary);
  });
}
