import {
  canReadProjects,
  canReadProjectResources,
  type AccessProfile
} from "@kiss-pm/access-control";
import {
  buildCapacitySummary,
  collectProjectsWithOverloadedEmployees,
  listOrgCapacityRows,
  maskOrgCapacityTreeProjects
} from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiRouteDeps } from "../routeTypes";
import { parseProjectIdParam, parseUserIdParam } from "../routeParamParsers";
import { createCapacityCache } from "./capacityCache";
import {
  buildCapacityDrilldown,
  buildWorkspaceCapacityAggregation,
  isCapacityCommittedProject,
  parseCapacityDate,
  parseMonthIso,
  type WorkspaceCapacityAggregation
} from "./capacityService";

const aggregationCache = createCapacityCache<WorkspaceCapacityAggregation>(60_000);

export function invalidateCapacityCacheForTenant(tenantId: string) {
  aggregationCache.invalidateTenant(tenantId);
}

export function registerCapacityRoutes(app: Hono, deps: ApiRouteDeps) {
  app.get("/api/workspace/capacity/tree", async (context) => {
    const monthIso = parseMonthIso(context.req.query("monthIso") ?? "");
    if (!monthIso) return context.json({ error: "capacity_invalid_query" }, 400);

    const requestedProjectId = parseOptionalProjectFilter(context.req.query("projectId"));
    if (requestedProjectId === false) {
      return context.json({ error: "capacity_invalid_query" }, 400);
    }

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const access = await resolveCapacityAccess(deps, actor, profile);
    if (!access.ok) return context.json({ error: access.error }, access.status);

    if (requestedProjectId && !access.canReadProjects) {
      return context.json({ error: access.projectReadReason }, 403);
    }
    if (requestedProjectId && !access.readableProjectIds.has(requestedProjectId)) {
      return context.json({ error: "capacity_invalid_query" }, 400);
    }
    const effectiveProjectFilterId = requestedProjectId;
    const aggregation = await getRawAggregation(deps, actor.tenantId, monthIso, effectiveProjectFilterId);
    if (!aggregation) return context.json({ error: "capacity_invalid_query" }, 400);

    return context.json(maskOrgCapacityTreeProjects(aggregation.tree, access.readableProjectIds));
  });

  app.get("/api/workspace/capacity/summary", async (context) => {
    const monthIso = parseMonthIso(context.req.query("monthIso") ?? "");
    if (!monthIso) return context.json({ error: "capacity_invalid_query" }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const access = await resolveCapacityAccess(deps, actor, profile);
    if (!access.ok) return context.json({ error: access.error }, access.status);

    const aggregation = await getRawAggregation(deps, actor.tenantId, monthIso, null);
    if (!aggregation) return context.json({ error: "capacity_invalid_query" }, 400);
    const tree = maskOrgCapacityTreeProjects(aggregation.tree, access.readableProjectIds);
    const overloadProjectIds = collectProjectsWithOverloadedEmployees(listOrgCapacityRows(tree));
    return context.json(
      buildCapacitySummary({
        monthIso,
        tree,
        overloadProjectIdsFromMix: overloadProjectIds
      })
    );
  });

  app.get("/api/workspace/capacity/drilldown", async (context) => {
    const monthIso = parseMonthIso(context.req.query("monthIso") ?? "");
    const resourceId = parseResourceFilter(context.req.query("resourceId"));
    const date = parseCapacityDate(context.req.query("date") ?? "");
    if (!monthIso || !resourceId || !date || !date.startsWith(`${monthIso}-`)) {
      return context.json({ error: "capacity_invalid_query" }, 400);
    }

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const access = await resolveCapacityAccess(deps, actor, profile);
    if (!access.ok) return context.json({ error: access.error }, access.status);

    const aggregation = await getRawAggregation(deps, actor.tenantId, monthIso, null);
    if (!aggregation) return context.json({ error: "capacity_invalid_query" }, 400);

    const drilldown = buildCapacityDrilldown({
      aggregation,
      resourceId,
      date,
      readableProjectIds: access.readableProjectIds
    });
    if (!drilldown) return context.json({ error: "capacity_invalid_query" }, 400);

    return context.json(drilldown);
  });
}

function parseOptionalProjectFilter(value: string | undefined): string | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = parseProjectIdParam(normalized);
  return parsed.ok ? parsed.value : false;
}

function parseResourceFilter(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = parseUserIdParam(normalized);
  return parsed.ok ? parsed.value : null;
}

async function getRawAggregation(
  deps: ApiRouteDeps,
  tenantId: string,
  monthIso: string,
  projectFilterId: string | null
): Promise<WorkspaceCapacityAggregation | null> {
  const cacheKey = `${tenantId}:raw:${monthIso}:${projectFilterId ?? ""}`;
  const cached = aggregationCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const aggregation = await buildWorkspaceCapacityAggregation(deps.dataSource, {
    tenantId,
    monthIso,
    projectFilterId
  });
  if (aggregation) aggregationCache.set(cacheKey, aggregation);
  return aggregation;
}

async function resolveCapacityAccess(
  deps: ApiRouteDeps,
  actor: TenantUser,
  profile: AccessProfile
): Promise<
  | {
      ok: true;
      readableProjectIds: ReadonlySet<string>;
      canReadProjects: boolean;
      projectReadReason: string;
    }
  | { ok: false; status: 403 | 501; error: string }
> {
  const resourcesDecision = canReadProjectResources({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!resourcesDecision.allowed) {
    return { ok: false, status: 403, error: resourcesDecision.reason };
  }
  if (!deps.dataSource.listProjects) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const projectsDecision = canReadProjects({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!projectsDecision.allowed) {
    return {
      ok: true,
      readableProjectIds: new Set(),
      canReadProjects: false,
      projectReadReason: projectsDecision.reason
    };
  }

  const projects = await deps.dataSource.listProjects(actor.tenantId);
  return {
    ok: true,
    readableProjectIds: new Set(projects.filter(isCapacityCommittedProject).map((project) => project.id)),
    canReadProjects: true,
    projectReadReason: projectsDecision.reason
  };
}
