import {
  canReadProjectResources,
  canReadOpportunities,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource } from "./apiTypes";

type OperationsCockpitRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

export function registerOperationsCockpitRoutes(
  app: Hono,
  deps: OperationsCockpitRouteDeps
) {
  app.get("/api/workspace/operations-cockpit", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getOperationsCockpitReadModel) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const projectDecision = canReadProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!projectDecision.allowed) {
      return context.json({ error: projectDecision.reason }, 403);
    }

    const opportunityDecision = canReadOpportunities({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    const resourceDecision = canReadProjectResources({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });

    const cockpit = await deps.dataSource.getOperationsCockpitReadModel({
      tenantId: actor.tenantId,
      now: new Date(),
      includePipelinePressure: opportunityDecision.allowed,
      includeWorkloadHints: resourceDecision.allowed
    });

    return context.json({ cockpit });
  });
}
