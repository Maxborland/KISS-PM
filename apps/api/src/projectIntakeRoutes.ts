import {
  canReadOpportunities,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import {
  parseDealStageChangeBody,
  parseOpportunityPipelineChangeBody
} from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseOpportunityBody,
  parseOpportunityFinalActionBody,
  parseOpportunityUpdateBody,
  parseProjectActivationBody
} from "./projectIntakeParsers";
import { createProjectIntakeService } from "./projectIntakeService";
import { parseOpportunityIdParam } from "./routeParamParsers";

type ProjectIntakeRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export function registerProjectIntakeRoutes(
  app: Hono,
  deps: ProjectIntakeRouteDeps
) {
  const {
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;
  const projectIntakeService = createProjectIntakeService(deps);

  app.get("/api/workspace/opportunities", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listOpportunities) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadOpportunities({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      opportunities: await dataSource.listOpportunities(actor.tenantId)
    });
  });

  app.get("/api/workspace/opportunities/:opportunityId", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findOpportunityById) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadOpportunities({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const opportunity = await dataSource.findOpportunityById(
      actor.tenantId,
      opportunityId.value
    );
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);

    return context.json({ opportunity });
  });

  app.post("/api/workspace/opportunities", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const preflight = await projectIntakeService.preflightCreateOpportunity({ actor });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseOpportunityBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await projectIntakeService.createOpportunity({
      actor,
      input: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ opportunity: result.opportunity }, result.status);
  });

  app.patch("/api/workspace/opportunities/:opportunityId", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const preflight = await projectIntakeService.preflightUpdateOpportunity({
      actor,
      opportunityId: opportunityId.value
    });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseOpportunityUpdateBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await projectIntakeService.updateOpportunity({
      actor,
      opportunityId: opportunityId.value,
      input: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ opportunity: result.opportunity });
  });

  app.patch("/api/workspace/opportunities/:opportunityId/stage", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const preflight = await projectIntakeService.preflightChangeOpportunityStage({
      actor,
      opportunityId: opportunityId.value
    });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDealStageChangeBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await projectIntakeService.changeOpportunityStage({
      actor,
      opportunityId: opportunityId.value,
      stageId: parsed.value.stageId
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ opportunity: result.opportunity });
  });

  // Мультиворонки: перенос сделки в другую воронку на её стадию.
  app.patch("/api/workspace/opportunities/:opportunityId/pipeline", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const preflight = await projectIntakeService.preflightChangeOpportunityPipeline({
      actor,
      opportunityId: opportunityId.value
    });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseOpportunityPipelineChangeBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await projectIntakeService.changeOpportunityPipeline({
      actor,
      opportunityId: opportunityId.value,
      pipelineId: parsed.value.pipelineId,
      stageId: parsed.value.stageId
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ opportunity: result.opportunity });
  });

  app.patch("/api/workspace/opportunities/:opportunityId/finalize", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const preflight = await projectIntakeService.preflightFinalizeOpportunity({
      actor,
      opportunityId: opportunityId.value
    });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseOpportunityFinalActionBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await projectIntakeService.finalizeOpportunity({
      actor,
      opportunityId: opportunityId.value,
      finalAction: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ opportunity: result.opportunity });
  });

  app.post("/api/workspace/opportunities/:opportunityId/feasibility", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const result = await projectIntakeService.checkOpportunityFeasibility({
      actor,
      opportunityId: opportunityId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({
      opportunity: result.opportunity,
      assessment: result.assessment
    });
  });

  app.post("/api/workspace/opportunities/:opportunityId/activate", async (context) => {
    const opportunityId = parseOpportunityIdParam(context.req.param("opportunityId"));
    if (!opportunityId.ok) return context.json({ error: opportunityId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const preflight = await projectIntakeService.preflightProjectActivation({
      actor,
      opportunityId: opportunityId.value
    });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

    const body = await readLimitedJsonBody(context, {});
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProjectActivationBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await projectIntakeService.activateProjectFromOpportunity({
      actor,
      opportunityId: opportunityId.value,
      activation: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ project: result.project }, result.status);
  });

  app.get("/api/workspace/projects", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjects) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProjects({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      projects: (await dataSource.listProjects(actor.tenantId)).filter(
        (project) => project.status === "active"
      )
    });
  });
}
