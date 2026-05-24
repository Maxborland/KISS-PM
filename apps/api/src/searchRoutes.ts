import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource } from "./apiTypes";
import {
  normalizeWorkspaceSearchQuery,
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
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const query = normalizeWorkspaceSearchQuery(context.req.query("q") ?? "");
    if (query.length < 2) {
      return context.json({ error: "search_query_too_short" }, 400);
    }
    const limit = parseWorkspaceSearchLimit(context.req.query("limit"));
    const requestedTypes = parseWorkspaceSearchTypes(context.req.query("types"));
    const profile = await deps.getActorProfile(actor);

    const results = await searchWorkspace({
      actor,
      dataSource: deps.dataSource,
      limit,
      profile,
      query,
      requestedTypes
    });

    return context.json({ results });
  });
}
