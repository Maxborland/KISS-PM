import {
  canManageAccessProfiles,
  canReadAccessProfiles
} from "@kiss-pm/access-control";
import { randomUUID } from "node:crypto";
import { parseAccessProfileCreateBody } from "./workspaceParsers";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerAccessRoleRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
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
      !dataSource.listAccessProfilesByTenantId
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
      return context.json({ error: decision.reason }, 403);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = parseAccessProfileCreateBody(body);

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

    const accessProfile = await dataSource.createAccessProfile({
      ...parsed.value,
      tenantId: actor.tenantId
    });
    const correlationId = randomUUID();

    await dataSource.appendAuditEvent({
      id: `audit-${randomUUID()}`,
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.access_profile.created",
      sourceSurfaceId: null,
      sourceWorkflow: "tenant_admin_access_profile",
      sourceEntity: {
        type: "AccessProfile",
        id: accessProfile.id
      },
      input: parsed.value,
      beforeState: null,
      afterState: accessProfile,
      permissionResult: decision,
      executionResult: {
        status: "succeeded"
      },
      correlationId,
      createdAt: new Date()
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
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      accessRoles: await dataSource.listAccessProfilesByTenantId(actor.tenantId)
    });
  });

  app.patch("/api/workspace/access-roles/:roleId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    if (!dataSource.updateAccessProfile || !dataSource.listAccessProfilesByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const roleId = context.req.param("roleId");
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

    const body = await context.req.json().catch(() => null);
    const parsed = parseAccessProfileCreateBody({
      ...(body && typeof body === "object" ? body : {}),
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

    const accessRole = await dataSource.updateAccessProfile({
      ...parsed.value,
      tenantId: actor.tenantId
    });

    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.access_profile.updated",
      sourceWorkflow: "single_workspace_access_roles",
      sourceEntity: {
        type: "AccessProfile",
        id: accessRole.id
      },
      commandInput: parsed.value,
      beforeState,
      afterState: accessRole,
      permissionResult: decision
    });

    return context.json({ accessRole });
  });

  app.delete("/api/workspace/access-roles/:roleId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    if (
      !dataSource.deleteAccessProfile ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listWorkspaceUsers
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    if (actor.accessProfileId === context.req.param("roleId")) {
      return context.json({ error: "self_access_role_delete_forbidden" }, 400);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const roleId = context.req.param("roleId");
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

    await dataSource.deleteAccessProfile(actor.tenantId, roleId);
    await appendManagementAuditEvent({
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
    });

    return context.json({ status: "deleted" });
  });
}
