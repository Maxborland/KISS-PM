import {
  canManageTenantUsers,
  canReadTenantUsers,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantId, TenantUser, UserId } from "@kiss-pm/domain";
import { hashPassword } from "@kiss-pm/persistence";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import { parseUserIdParam } from "./routeParamParsers";
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
    if (!decision.allowed) {
      await appendWorkspaceUserDeniedAudit(deps, actor, {
        actionType: "workspace.user.read_denied",
        entityId: "users",
        commandInput: { resource: "users" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

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
    if (!decision.allowed) {
      await appendWorkspaceUserDeniedAudit(deps, actor, {
        actionType: "workspace.user.create_denied",
        entityId: "new",
        commandInput: { operation: "create_user" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseWorkspaceUserBody(body.value, actor.tenantId);
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
    if (!(await emailDomainAllowed(dataSource, actor.tenantId, parsed.value.email))) {
      return context.json({ error: "email_domain_not_allowed" }, 400);
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

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ user }, 201);
  });

  app.patch("/api/workspace/users/:userId", async (context) => {
    const parsedUserId = parseUserIdParam(context.req.param("userId"));
    if (!parsedUserId.ok) return context.json({ error: parsedUserId.error }, 400);
    const userId = parsedUserId.value;
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
    if (!decision.allowed) {
      await appendWorkspaceUserDeniedAudit(deps, actor, {
        actionType: "workspace.user.update_denied",
        entityId: userId,
        commandInput: { userId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const workspaceUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    const beforeState =
      workspaceUsers.find((user) => user.id === userId) ?? null;
    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    const parsed = parseWorkspaceUserPatchBody(
      body.value,
      actor.tenantId,
      userId,
      beforeState
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      actor.id === userId &&
      (parsed.value.status !== "active" ||
        parsed.value.accessProfileId !== actor.accessProfileId)
    ) {
      return context.json({ error: "self_access_change_forbidden" }, 400);
    }

    if (
      workspaceUsers.some(
        (user) =>
          user.id !== userId &&
          user.email === parsed.value.email
      )
    ) {
      return context.json({ error: "user_email_taken" }, 409);
    }
    // Смена email тоже обязана уважать домен-allowlist политики безопасности.
    if (
      beforeState.email !== parsed.value.email &&
      !(await emailDomainAllowed(dataSource, actor.tenantId, parsed.value.email))
    ) {
      return context.json({ error: "email_domain_not_allowed" }, 400);
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
      if (
        shouldRevokeSessionsAfterUserUpdate(beforeState, updatedUser) &&
        transactionDataSource.deleteSessionsByUserId
      ) {
        await transactionDataSource.deleteSessionsByUserId(
          updatedUser.tenantId,
          updatedUser.id
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

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ user });
  });

  app.delete("/api/workspace/users/:userId", async (context) => {
    const parsedUserId = parseUserIdParam(context.req.param("userId"));
    if (!parsedUserId.ok) return context.json({ error: parsedUserId.error }, 400);
    const userId = parsedUserId.value as UserId;
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.deleteWorkspaceUser ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    if (actor.id === userId) {
      return context.json({ error: "self_user_delete_forbidden" }, 400);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendWorkspaceUserDeniedAudit(deps, actor, {
        actionType: "workspace.user.delete_denied",
        entityId: userId,
        commandInput: { userId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState =
      (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
        (user) => user.id === userId
      ) ?? null;

    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.deleteWorkspaceUser) {
        throw new Error("transactional_user_delete_not_configured");
      }

      await transactionDataSource.deleteWorkspaceUser(actor.tenantId, userId);
      await appendManagementAuditEvent(
        {
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
        },
        transactionDataSource
      );
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ status: "deleted" });
  });
}

async function appendWorkspaceUserDeniedAudit(
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
    sourceWorkflow: "single_workspace_users",
    sourceEntity: {
      type: "TenantUser",
      id: input.entityId
    },
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.decision,
    executionResult: { status: "denied" }
  });
}

function shouldRevokeSessionsAfterUserUpdate(
  before: {
    accessProfileId: string;
    email: string;
    status: string;
  },
  after: {
    accessProfileId: string;
    email: string;
    status: string;
  }
): boolean {
  return (
    before.accessProfileId !== after.accessProfileId ||
    before.email !== after.email ||
    before.status !== after.status
  );
}

// Домен email против политики безопасности тенанта (G6-01: allowlist теперь
// применяется, а не только сохраняется). Пустой список = ограничений нет.
async function emailDomainAllowed(
  dataSource: ApiRouteDeps["dataSource"],
  tenantId: TenantId,
  email: string
): Promise<boolean> {
  if (!dataSource.getTenantSecurityPolicy) return true;
  const policy = await dataSource.getTenantSecurityPolicy(tenantId);
  if (policy.domainAllowlist.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return policy.domainAllowlist.includes(domain);
}
