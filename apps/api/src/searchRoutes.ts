import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource } from "./apiTypes";
import {
  parseWorkspaceSearchQuery,
  parseWorkspaceSearchLimit,
  parseWorkspaceSearchTypes,
  searchWorkspace
} from "./search/workspaceSearch";

type SearchRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

export function registerSearchRoutes(app: Hono, deps: SearchRouteDeps) {
  app.get("/api/workspace/search", async (context) => {
    const parsedQuery = parseWorkspaceSearchQuery(context.req.query("q"));
    if (!parsedQuery.ok) {
      return context.json({ error: parsedQuery.error }, 400);
    }
    const parsedTypes = parseWorkspaceSearchTypes(context.req.query("types"));
    if (!parsedTypes.ok) {
      return context.json({ error: parsedTypes.error }, 400);
    }
    const parsedLimit = parseWorkspaceSearchLimit(context.req.query("limit"));
    if (!parsedLimit.ok) {
      return context.json({ error: parsedLimit.error }, 400);
    }

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);

    const results = await searchWorkspace({
      actor,
      dataSource: deps.dataSource,
      limit: parsedLimit.value,
      profile,
      query: parsedQuery.value,
      requestedTypes: parsedTypes.value
    });

    return context.json({ results });
  });
}
