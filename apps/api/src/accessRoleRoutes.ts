import {
  canManageAccessProfiles,
  canReadAccessProfiles,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { readLimitedJsonBody } from "./jsonBody";
import { parseAccessRoleIdParam } from "./routeParamParsers";
import { parseAccessProfileCreateBody } from "./workspaceParsers";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerAccessRoleRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/tenant/current/access-profiles", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (!dataSource.listAccessProfilesByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      await appendAccessRoleDeniedAudit(deps, actor, {
        actionType: "tenant.access_profile.read_denied",
        entityId: "access-profiles",
        commandInput: { resource: "access-profiles" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const accessProfiles = await dataSource.listAccessProfilesByTenantId(
      actor.tenantId
    );

    return context.json({ accessProfiles });
  });

  app.post("/api/tenant/current/access-profiles", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (
      !dataSource.createAccessProfile ||
      !dataSource.appendAuditEvent ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      await appendAccessRoleDeniedAudit(deps, actor, {
        actionType: "tenant.access_profile.create_denied",
        entityId: "new",
        commandInput: { operation: "create_access_profile" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseAccessProfileCreateBody(body.value);

    if (!parsed.ok) {
      return context.json({ error: parsed.error }, 400);
    }

    const existingProfiles = await dataSource.listAccessProfilesByTenantId(
      actor.tenantId
    );
    if (existingProfiles.some((profile) => profile.id === parsed.value.id)) {
      return context.json({ error: "access_role_id_taken" }, 409);
    }
    if (existingProfiles.some((profile) => profile.name === parsed.value.name)) {
      return context.json({ error: "access_role_name_taken" }, 409);
    }

    const accessProfile = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createAccessProfile) {
        throw new Error("transactional_access_profile_create_not_configured");
      }

      const createdProfile = await transactionDataSource.createAccessProfile({
        ...parsed.value,
        tenantId: actor.tenantId
      });
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "tenant.access_profile.created",
          sourceWorkflow: "tenant_admin_access_profile",
          sourceEntity: {
            type: "AccessProfile",
            id: createdProfile.id
          },
          commandInput: parsed.value,
          beforeState: null,
          afterState: createdProfile,
          permissionResult: decision
        },
        transactionDataSource
      );

      return createdProfile;
    });

    return context.json({ accessProfile }, 201);
  });

  app.get("/api/workspace/access-roles", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listAccessProfilesByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const decision = canReadAccessProfiles({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendAccessRoleDeniedAudit(deps, actor, {
        actionType: "tenant.access_profile.read_denied",
        entityId: "access-roles",
        commandInput: { resource: "access-roles" },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    return context.json({
      accessRoles: await dataSource.listAccessProfilesByTenantId(actor.tenantId)
    });
  });

  app.patch("/api/workspace/access-roles/:roleId", async (context) => {
    const parsedRoleId = parseAccessRoleIdParam(context.req.param("roleId"));
    if (!parsedRoleId.ok) return context.json({ error: parsedRoleId.error }, 400);
    const roleId = parsedRoleId.value;
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    if (
      !dataSource.updateAccessProfile ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      await appendAccessRoleDeniedAudit(deps, actor, {
        actionType: "tenant.access_profile.update_denied",
        entityId: roleId,
        commandInput: { roleId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState =
      (await dataSource.listAccessProfilesByTenantId(actor.tenantId)).find(
        (profile) => profile.id === roleId
      ) ?? null;

    if (!beforeState) {
      return context.json({ error: "access_role_not_found" }, 404);
    }
    if (roleId === actor.accessProfileId) {
      return context.json({ error: "self_access_role_update_forbidden" }, 400);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseAccessProfileCreateBody({
      ...(body.value && typeof body.value === "object" ? body.value : {}),
      id: roleId
    });

    if (!parsed.ok) {
      return context.json({ error: parsed.error }, 400);
    }

    const duplicateName = (
      await dataSource.listAccessProfilesByTenantId(actor.tenantId)
    ).some(
      (profile) => profile.id !== roleId && profile.name === parsed.value.name
    );
    if (duplicateName) {
      return context.json({ error: "access_role_name_taken" }, 409);
    }

    const accessRole = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateAccessProfile) {
        throw new Error("transactional_access_profile_update_not_configured");
      }

      const updatedRole = await transactionDataSource.updateAccessProfile({
        ...parsed.value,
        tenantId: actor.tenantId
      });
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "tenant.access_profile.updated",
          sourceWorkflow: "single_workspace_access_roles",
          sourceEntity: {
            type: "AccessProfile",
            id: updatedRole.id
          },
          commandInput: parsed.value,
          beforeState,
          afterState: updatedRole,
          permissionResult: decision
        },
        transactionDataSource
      );

      return updatedRole;
    });

    return context.json({ accessRole });
  });

  app.delete("/api/workspace/access-roles/:roleId", async (context) => {
    const parsedRoleId = parseAccessRoleIdParam(context.req.param("roleId"));
    if (!parsedRoleId.ok) return context.json({ error: parsedRoleId.error }, 400);
    const roleId = parsedRoleId.value;
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    if (
      !dataSource.deleteAccessProfile ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    if (actor.accessProfileId === roleId) {
      return context.json({ error: "self_access_role_delete_forbidden" }, 400);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      await appendAccessRoleDeniedAudit(deps, actor, {
        actionType: "tenant.access_profile.delete_denied",
        entityId: roleId,
        commandInput: { roleId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState =
      (await dataSource.listAccessProfilesByTenantId(actor.tenantId)).find(
        (profile) => profile.id === roleId
      ) ?? null;

    if (!beforeState) {
      return context.json({ error: "access_role_not_found" }, 404);
    }

    const assignedUsers = (await dataSource.listWorkspaceUsers(actor.tenantId)).filter(
      (user) => user.accessProfileId === roleId
    );
    if (assignedUsers.length > 0) {
      return context.json({ error: "access_role_assigned" }, 409);
    }

    await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.deleteAccessProfile) {
        throw new Error("transactional_access_profile_delete_not_configured");
      }

      await transactionDataSource.deleteAccessProfile(actor.tenantId, roleId);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "tenant.access_profile.deleted",
          sourceWorkflow: "single_workspace_access_roles",
          sourceEntity: {
            type: "AccessProfile",
            id: roleId
          },
          commandInput: { id: roleId },
          beforeState,
          afterState: null,
          permissionResult: decision
        },
        transactionDataSource
      );
    });

    return context.json({ status: "deleted" });
  });
}

async function appendAccessRoleDeniedAudit(
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
    sourceWorkflow: "single_workspace_access_roles",
    sourceEntity: {
      type: "AccessProfile",
      id: input.entityId
    },
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.decision,
    executionResult: { status: "denied" }
  });
}
