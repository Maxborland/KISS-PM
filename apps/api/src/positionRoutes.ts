import {
  canManagePositions,
  canReadPositions,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import { parsePositionIdParam } from "./routeParamParsers";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import { parsePositionBody } from "./workspaceParsers";

export function registerPositionRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
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
    if (!decision.allowed) {
      await appendPositionDeniedAudit(deps, actor, {
        actionType: "workspace.position.read_denied",
        entityId: "positions",
        commandInput: { resource: "positions" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    return context.json({ positions: await dataSource.listPositions(actor.tenantId) });
  });

  app.post("/api/workspace/positions", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createPosition ||
      !dataSource.listPositions ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendPositionDeniedAudit(deps, actor, {
        actionType: "workspace.position.create_denied",
        entityId: "new",
        commandInput: { operation: "create_position" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

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

    const position = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createPosition) {
        throw new Error("transactional_position_create_not_configured");
      }

      const createdPosition = await transactionDataSource.createPosition(parsed.value);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.position.created",
          sourceWorkflow: "single_workspace_positions",
          sourceEntity: {
            type: "Position",
            id: createdPosition.id
          },
          commandInput: parsed.value,
          beforeState: null,
          afterState: createdPosition,
          permissionResult: decision
        },
        transactionDataSource
      );

      return createdPosition;
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ position }, 201);
  });

  app.patch("/api/workspace/positions/:positionId", async (context) => {
    const parsedPositionId = parsePositionIdParam(context.req.param("positionId"));
    if (!parsedPositionId.ok) return context.json({ error: parsedPositionId.error }, 400);
    const positionId = parsedPositionId.value;
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.updatePosition ||
      !dataSource.listPositions ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendPositionDeniedAudit(deps, actor, {
        actionType: "workspace.position.update_denied",
        entityId: positionId,
        commandInput: { positionId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const existingPositions = await dataSource.listPositions(actor.tenantId);
    const beforeState =
      existingPositions.find(
        (position) => position.id === positionId
      ) ?? null;
    if (!beforeState) return context.json({ error: "position_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePositionBody(
      body.value,
      actor.tenantId,
      positionId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      existingPositions.some(
        (position) =>
          position.id !== positionId &&
          position.name === parsed.value.name
      )
    ) {
      return context.json({ error: "position_name_taken" }, 409);
    }

    const position = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updatePosition) {
        throw new Error("transactional_position_update_not_configured");
      }

      const updatedPosition = await transactionDataSource.updatePosition(parsed.value);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.position.updated",
          sourceWorkflow: "single_workspace_positions",
          sourceEntity: {
            type: "Position",
            id: updatedPosition.id
          },
          commandInput: parsed.value,
          beforeState,
          afterState: updatedPosition,
          permissionResult: decision
        },
        transactionDataSource
      );

      return updatedPosition;
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ position });
  });

  app.delete("/api/workspace/positions/:positionId", async (context) => {
    const parsedPositionId = parsePositionIdParam(context.req.param("positionId"));
    if (!parsedPositionId.ok) return context.json({ error: parsedPositionId.error }, 400);
    const positionId = parsedPositionId.value;
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.deletePosition ||
      !dataSource.listPositions ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendPositionDeniedAudit(deps, actor, {
        actionType: "workspace.position.delete_denied",
        entityId: positionId,
        commandInput: { positionId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

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

    await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.deletePosition) {
        throw new Error("transactional_position_delete_not_configured");
      }

      await transactionDataSource.deletePosition(actor.tenantId, positionId);
      await appendManagementAuditEvent(
        {
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
        },
        transactionDataSource
      );
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ status: "deleted" });
  });
}

async function appendPositionDeniedAudit(
  deps: ApiRouteDeps,
  actor: TenantUser,
  input: {
    actionType: string;
    entityId: string;
    commandInput: Record<string, unknown>;
    decision: PolicyDecision;
  }
) {
  if (!deps.dataSource.appendAuditEvent) return;
  await deps.appendManagementAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actionType: input.actionType,
    sourceWorkflow: "single_workspace_positions",
    sourceEntity: {
      type: "Position",
      id: input.entityId
    },
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.decision,
    executionResult: { status: "denied" }
  });
}
