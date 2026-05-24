import {
  canManagePositions,
  canReadPositions
} from "@kiss-pm/access-control";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import { parsePositionBody } from "./workspaceParsers";

export function registerPositionRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;

  app.get("/api/workspace/positions", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listPositions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadPositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ positions: await dataSource.listPositions(actor.tenantId) });
  });

  app.post("/api/workspace/positions", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.createPosition || !dataSource.listPositions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePositionBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const existingPositions = await dataSource.listPositions(actor.tenantId);
    if (existingPositions.some((position) => position.id === parsed.value.id)) {
      return context.json({ error: "position_id_taken" }, 409);
    }
    if (existingPositions.some((position) => position.name === parsed.value.name)) {
      return context.json({ error: "position_name_taken" }, 409);
    }

    const position = await dataSource.createPosition(parsed.value);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.position.created",
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: {
        type: "Position",
        id: position.id
      },
      commandInput: parsed.value,
      beforeState: null,
      afterState: position,
      permissionResult: decision
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ position }, 201);
  });

  app.patch("/api/workspace/positions/:positionId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updatePosition || !dataSource.listPositions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const existingPositions = await dataSource.listPositions(actor.tenantId);
    const beforeState =
      existingPositions.find(
        (position) => position.id === context.req.param("positionId")
      ) ?? null;
    if (!beforeState) return context.json({ error: "position_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePositionBody(
      body.value,
      actor.tenantId,
      context.req.param("positionId")
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      existingPositions.some(
        (position) =>
          position.id !== context.req.param("positionId") &&
          position.name === parsed.value.name
      )
    ) {
      return context.json({ error: "position_name_taken" }, 409);
    }

    const position = await dataSource.updatePosition(parsed.value);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.position.updated",
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: {
        type: "Position",
        id: position.id
      },
      commandInput: parsed.value,
      beforeState,
      afterState: position,
      permissionResult: decision
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ position });
  });

  app.delete("/api/workspace/positions/:positionId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.deletePosition ||
      !dataSource.listPositions ||
      !dataSource.listWorkspaceUsers
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const positionId = context.req.param("positionId");
    const beforeState =
      (await dataSource.listPositions(actor.tenantId)).find(
        (position) => position.id === positionId
      ) ?? null;
    if (!beforeState) return context.json({ error: "position_not_found" }, 404);

    const assignedUsers = (await dataSource.listWorkspaceUsers(actor.tenantId)).filter(
      (user) => user.positionId === positionId
    );
    if (assignedUsers.length > 0) {
      return context.json({ error: "position_assigned" }, 409);
    }

    await dataSource.deletePosition(actor.tenantId, positionId);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.position.deleted",
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: {
        type: "Position",
        id: positionId
      },
      commandInput: { id: positionId },
      beforeState,
      afterState: null,
      permissionResult: decision
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ status: "deleted" });
  });
}
