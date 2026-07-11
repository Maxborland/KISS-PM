import { canManageProjectPlan, canReadProjectPlan } from "@kiss-pm/access-control";
import type { Context, Hono } from "hono";
import { randomUUID } from "node:crypto";

import { readLimitedJsonBody } from "../jsonBody";
import { hashJson, parseProjectRouteParam, parseSavedViewRouteParam, type PlanningRouteDeps } from "./planningRouteHelpers";

const collectionPath = "/api/workspace/projects/:projectId/planning/saved-views";
const itemPath = `${collectionPath}/:viewId`;
class SavedViewNotFoundError extends Error {}
class SavedViewNameConflictError extends Error {}

export function registerPlanningSavedViewRoutes(app: Hono, deps: PlanningRouteDeps) {
  app.get(collectionPath, async (context) => {
    const projectId = parseProjectRouteParam(context);
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);
    const access = await authorize(context, deps, false, Boolean(deps.dataSource.listSavedViews));
    if (!access.ok) return access.response;
    const views = await deps.dataSource.listSavedViews!(access.actor.tenantId, projectId.value, access.actor.id);
    return context.json({ savedViews: views });
  });
  app.post(collectionPath, async (context) => {
    const projectId = parseProjectRouteParam(context);
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);
    const configured = Boolean(deps.dataSource.createSavedView) && Boolean(deps.dataSource.listSavedViews) && Boolean(deps.dataSource.claimWriteFlowIdempotencyKey);
    const access = await authorize(context, deps, true, configured);
    if (!access.ok) return access.response;
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = body.value as Record<string, unknown>;
    const parsed = parseNameRequest(record);
    const scope = record.scope === "project" ? "project" : "user";
    const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? record.payload as Record<string, unknown> : null;
    if (!parsed || !payload) return context.json({ error: "saved_view_invalid" }, 400);
    const result = await deps.runDataSourceTransaction(async (store) => {
      if (!store.createSavedView || !store.listSavedViews || !store.claimWriteFlowIdempotencyKey) return persistenceMissing();
      const claim = await store.claimWriteFlowIdempotencyKey({
        tenantId: access.actor.tenantId, actorUserId: access.actor.id,
        surface: "planning.saved-view.create", clientRequestId: parsed.clientRequestId,
        resourceId: `saved-view-${randomUUID()}`,
        requestHash: hashJson({ projectId: projectId.value, name: parsed.name, scope, payload })
      });
      if (claim.conflict) return idempotencyConflict();
      if (!claim.claimed) {
        const views = await store.listSavedViews(access.actor.tenantId, projectId.value, access.actor.id);
        const view = views.find((candidate) => candidate.id === claim.resourceId);
        return view ? { ok: true as const, view } : replayMissing();
      }
      const view = await store.createSavedView({ id: claim.resourceId, tenantId: access.actor.tenantId, projectId: projectId.value, ownerUserId: access.actor.id, scope, name: parsed.name, payload }).catch(rethrowNameConflict);
      return { ok: true as const, view };
    }).catch((error: unknown) => error instanceof SavedViewNameConflictError ? nameConflict() : Promise.reject(error));
    return result.ok ? context.json({ savedView: result.view }, 201) : context.json({ error: result.error }, result.status);
  });
  app.patch(itemPath, async (context) => {
    const projectId = parseProjectRouteParam(context);
    const viewId = parseSavedViewRouteParam(context);
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);
    if (!viewId.ok) return context.json({ error: viewId.error }, 400);
    const configured = Boolean(deps.dataSource.updateSavedViewName) && Boolean(deps.dataSource.listSavedViews) && Boolean(deps.dataSource.claimWriteFlowIdempotencyKey);
    const access = await authorize(context, deps, true, configured);
    if (!access.ok) return access.response;
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseNameRequest(body.value as Record<string, unknown>);
    if (!parsed) return context.json({ error: "saved_view_invalid" }, 400);
    const result = await deps.runDataSourceTransaction(async (store) => {
      if (!store.updateSavedViewName || !store.listSavedViews || !store.claimWriteFlowIdempotencyKey) return persistenceMissing();
      const claim = await store.claimWriteFlowIdempotencyKey({
        tenantId: access.actor.tenantId, actorUserId: access.actor.id,
        surface: "planning.saved-view.rename", clientRequestId: parsed.clientRequestId,
        resourceId: viewId.value,
        requestHash: hashJson({ projectId: projectId.value, viewId: viewId.value, name: parsed.name })
      });
      if (claim.conflict) return idempotencyConflict();
      if (!claim.claimed) {
        const views = await store.listSavedViews(access.actor.tenantId, projectId.value, access.actor.id);
        const view = views.find((candidate) => candidate.id === claim.resourceId);
        if (!view) throw new SavedViewNotFoundError();
        return { ok: true as const, view };
      }
      const view = await store.updateSavedViewName(access.actor.tenantId, projectId.value, viewId.value, access.actor.id, parsed.name).catch(rethrowNameConflict);
      if (!view) throw new SavedViewNotFoundError();
      return { ok: true as const, view };
    }).catch((error: unknown) => {
      if (error instanceof SavedViewNotFoundError) return null;
      if (error instanceof SavedViewNameConflictError) return nameConflict();
      throw error;
    });
    if (!result) return context.json({ error: "saved_view_not_found" }, 404);
    return result.ok ? context.json({ savedView: result.view }, 200) : context.json({ error: result.error }, result.status);
  });
  app.delete(itemPath, async (context) => {
    const projectId = parseProjectRouteParam(context);
    const viewId = parseSavedViewRouteParam(context);
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);
    if (!viewId.ok) return context.json({ error: viewId.error }, 400);
    const configured = Boolean(deps.dataSource.deleteSavedView) && Boolean(deps.dataSource.claimWriteFlowIdempotencyKey);
    const access = await authorize(context, deps, true, configured);
    if (!access.ok) return access.response;
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const clientRequestId = parseClientRequestId(body.value as Record<string, unknown>);
    if (!clientRequestId) return context.json({ error: "saved_view_invalid" }, 400);
    const result = await deps.runDataSourceTransaction(async (store) => {
      if (!store.deleteSavedView || !store.claimWriteFlowIdempotencyKey) return persistenceMissing();
      const claim = await store.claimWriteFlowIdempotencyKey({
        tenantId: access.actor.tenantId, actorUserId: access.actor.id,
        surface: "planning.saved-view.delete", clientRequestId,
        resourceId: viewId.value,
        requestHash: hashJson({ projectId: projectId.value, viewId: viewId.value })
      });
      if (claim.conflict) return idempotencyConflict();
      if (!claim.claimed) return { ok: true as const };
      const deleted = await store.deleteSavedView(access.actor.tenantId, projectId.value, viewId.value, access.actor.id);
      if (!deleted) throw new SavedViewNotFoundError();
      return { ok: true as const };
    }).catch((error: unknown) => error instanceof SavedViewNotFoundError ? null : Promise.reject(error));
    if (!result) return context.json({ error: "saved_view_not_found" }, 404);
    return result.ok ? context.json({ ok: true }) : context.json({ error: result.error }, result.status);
  });
}
async function authorize(context: Context, deps: PlanningRouteDeps, manage: boolean, configured: boolean) {
  const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
  if (!actor) return { ok: false as const, response: context.json({ error: "session_required" }, 401) };
  if (!configured) return { ok: false as const, response: context.json({ error: "persistence_not_configured" }, 501) };
  const profile = await deps.getActorProfile(actor);
  const input = { actor, profile, targetTenantId: actor.tenantId };
  const decision = manage ? canManageProjectPlan(input) : canReadProjectPlan(input);
  return decision.allowed ? { ok: true as const, actor } : { ok: false as const, response: context.json({ error: decision.reason }, 403) };
}
function parseNameRequest(record: Record<string, unknown>) {
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const value = record.clientRequestId;
  const clientRequestId = typeof value === "string" ? value.trim() : "";
  return name && name.length <= 80 && /^[A-Za-z0-9._:-]{8,128}$/.test(clientRequestId) ? { name, clientRequestId } : null;
}
function parseClientRequestId(record: Record<string, unknown>) {
  const value = record.clientRequestId;
  const clientRequestId = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._:-]{8,128}$/.test(clientRequestId) ? clientRequestId : null;
}
function rethrowNameConflict(error: unknown): never {
  if (error instanceof Error && error.message === "planning_saved_view_name_conflict") throw new SavedViewNameConflictError();
  throw error;
}
function persistenceMissing() { return { ok: false as const, status: 501 as const, error: "persistence_not_configured" as const }; }
function idempotencyConflict() { return { ok: false as const, status: 409 as const, error: "idempotency_key_conflict" as const }; }
function nameConflict() { return { ok: false as const, status: 409 as const, error: "saved_view_name_conflict" as const }; }
function replayMissing() { return { ok: false as const, status: 409 as const, error: "idempotency_replay_missing" as const }; }