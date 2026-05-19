import {
  canManageTenantUsers,
  canReadTenantUsers
} from "@kiss-pm/access-control";
import type { UserId } from "@kiss-pm/domain";
import { hashPassword } from "@kiss-pm/persistence";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import {
  parseWorkspaceUserBody,
  parseWorkspaceUserPatchBody
} from "./workspaceParsers";

export function registerWorkspaceUserRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/workspace/users", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      users: await dataSource.listWorkspaceUsers(actor.tenantId)
    });
  });

  app.post("/api/workspace/users", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createWorkspaceUser ||
      !dataSource.upsertCredential ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listPositions ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const parsed = parseWorkspaceUserBody(body, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!parsed.password || parsed.password.length < 8) {
      return context.json({ error: "invalid_user_password" }, 400);
    }
    const existingUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    if (existingUsers.some((user) => user.id === parsed.value.id)) {
      return context.json({ error: "user_id_taken" }, 409);
    }
    if (existingUsers.some((user) => user.email === parsed.value.email)) {
      return context.json({ error: "user_email_taken" }, 409);
    }
    if (
      !(await dataSource.listAccessProfilesByTenantId(actor.tenantId)).some(
        (profile) => profile.id === parsed.value.accessProfileId
      )
    ) {
      return context.json({ error: "invalid_access_role" }, 400);
    }
    if (parsed.value.positionId) {
      const positionExists = (await dataSource.listPositions(actor.tenantId)).some(
        (position) => position.id === parsed.value.positionId
      );
      if (!positionExists) {
        return context.json({ error: "invalid_position" }, 400);
      }
    }

    const user = await runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.createWorkspaceUser ||
        !transactionDataSource.upsertCredential
      ) {
        throw new Error("transactional_user_create_not_configured");
      }

      const createdUser = await transactionDataSource.createWorkspaceUser(
        parsed.value
      );
      if (parsed.password) {
        await transactionDataSource.upsertCredential({
          userId: createdUser.id,
          tenantId: createdUser.tenantId,
          email: createdUser.email,
          ...hashPassword(parsed.password)
        });
      }

      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.user.created",
          sourceWorkflow: "single_workspace_users",
          sourceEntity: {
            type: "TenantUser",
            id: createdUser.id
          },
          commandInput: {
            ...parsed.value,
            password: parsed.password ? "***" : undefined
          },
          beforeState: null,
          afterState: createdUser,
          permissionResult: decision
        },
        transactionDataSource
      );

      return createdUser;
    });

    return context.json({ user }, 201);
  });

  app.patch("/api/workspace/users/:userId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.updateWorkspaceUser ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listPositions ||
      !dataSource.updateCredentialEmail ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const workspaceUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    const beforeState =
      workspaceUsers.find((user) => user.id === context.req.param("userId")) ?? null;
    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    const parsed = parseWorkspaceUserPatchBody(
      body,
      actor.tenantId,
      context.req.param("userId"),
      beforeState
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      actor.id === context.req.param("userId") &&
      (parsed.value.status !== "active" ||
        parsed.value.accessProfileId !== actor.accessProfileId)
    ) {
      return context.json({ error: "self_access_change_forbidden" }, 400);
    }

    if (
      workspaceUsers.some(
        (user) =>
          user.id !== context.req.param("userId") &&
          user.email === parsed.value.email
      )
    ) {
      return context.json({ error: "user_email_taken" }, 409);
    }
    if (
      !(await dataSource.listAccessProfilesByTenantId(actor.tenantId)).some(
        (profile) => profile.id === parsed.value.accessProfileId
      )
    ) {
      return context.json({ error: "invalid_access_role" }, 400);
    }
    if (parsed.value.positionId) {
      const positionExists = (await dataSource.listPositions(actor.tenantId)).some(
        (position) => position.id === parsed.value.positionId
      );
      if (!positionExists) {
        return context.json({ error: "invalid_position" }, 400);
      }
    }
    const user = await runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.updateWorkspaceUser ||
        !transactionDataSource.updateCredentialEmail
      ) {
        throw new Error("transactional_user_update_not_configured");
      }

      const updatedUser = await transactionDataSource.updateWorkspaceUser(
        parsed.value
      );
      if (beforeState.email !== updatedUser.email) {
        await transactionDataSource.updateCredentialEmail(
          updatedUser.tenantId,
          updatedUser.id,
          updatedUser.email
        );
      }

      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.user.updated",
          sourceWorkflow: "single_workspace_users",
          sourceEntity: {
            type: "TenantUser",
            id: updatedUser.id
          },
          commandInput: parsed.value,
          beforeState,
          afterState: updatedUser,
          permissionResult: decision
        },
        transactionDataSource
      );

      return updatedUser;
    });

    return context.json({ user });
  });

  app.delete("/api/workspace/users/:userId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.deleteWorkspaceUser || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const userId = context.req.param("userId") as UserId;
    if (actor.id === userId) {
      return context.json({ error: "self_user_delete_forbidden" }, 400);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const beforeState =
      (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
        (user) => user.id === userId
      ) ?? null;

    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    await dataSource.deleteWorkspaceUser(actor.tenantId, userId);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.user.deleted",
      sourceWorkflow: "single_workspace_users",
      sourceEntity: {
        type: "TenantUser",
        id: userId
      },
      commandInput: { id: userId },
      beforeState,
      afterState: null,
      permissionResult: decision
    });

    return context.json({ status: "deleted" });
  });
}
