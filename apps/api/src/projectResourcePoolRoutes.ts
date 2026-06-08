import {
  canManageProjectResources,
  canReadProjectResources,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import { parseProjectIdParam } from "./routeParamParsers";

type ProjectResourcePoolRouteDeps = {
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

type ProjectResourcePoolRole = "project_manager" | "resource" | "observer";

type ProjectResourcePoolMemberWrite = {
  userId: string;
  role: ProjectResourcePoolRole;
};

const projectResourcePoolRoles = new Set<string>([
  "project_manager",
  "resource",
  "observer"
]);

export function registerProjectResourcePoolRoutes(
  app: Hono,
  deps: ProjectResourcePoolRouteDeps
) {
  app.get("/api/workspace/projects/:projectId/resource-pool", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const decision = canReadProjectResources({
      actor,
      profile: await deps.getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    if (!deps.dataSource.listProjects || !deps.dataSource.listProjectResourcePoolMembers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const project = (await deps.dataSource.listProjects(actor.tenantId)).find(
      (candidate) => candidate.id === projectId.value
    );
    if (!project || !isReadableProjectStatus(project.status)) {
      return context.json({ error: "project_not_found" }, 404);
    }

    const members = await deps.dataSource.listProjectResourcePoolMembers(
      actor.tenantId,
      project.id
    );

    return context.json({ resourcePool: serializeResourcePool(project.id, members) });
  });

  app.put("/api/workspace/projects/:projectId/resource-pool", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseResourcePoolReplaceBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const permissionResult = canManageProjectResources({
      actor,
      profile: await deps.getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!permissionResult.allowed) {
      return context.json({ error: permissionResult.reason }, 403);
    }

    if (
      !deps.dataSource.listProjects ||
      !deps.dataSource.listWorkspaceUsers ||
      !deps.dataSource.listProjectResourcePoolMembers ||
      !deps.dataSource.replaceProjectResourcePoolMembers
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.listProjects ||
        !transactionDataSource.listWorkspaceUsers ||
        !transactionDataSource.listProjectResourcePoolMembers ||
        !transactionDataSource.replaceProjectResourcePoolMembers
      ) {
        throw new Error("persistence_not_configured");
      }

      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
      const project = (await transactionDataSource.listProjects(actor.tenantId)).find(
        (candidate) => candidate.id === projectId.value
      );
      if (!project) return { ok: false as const, status: 404 as const, error: "project_not_found" };
      if (project.status !== "active") {
        return { ok: false as const, status: 409 as const, error: "project_not_active" };
      }

      const workspaceUsers = await transactionDataSource.listWorkspaceUsers(actor.tenantId);
      const usersById = new Map(workspaceUsers.map((user) => [user.id, user]));
      for (const member of parsed.value.members) {
        const user = usersById.get(member.userId);
        if (!user) {
          return { ok: false as const, status: 400 as const, error: "resource_pool_user_not_found" };
        }
        if (user.status !== "active") {
          return { ok: false as const, status: 400 as const, error: "resource_pool_user_inactive" };
        }
      }

      const beforeMembers = await transactionDataSource.listProjectResourcePoolMembers(
        actor.tenantId,
        project.id
      );
      const members = await transactionDataSource.replaceProjectResourcePoolMembers({
        tenantId: actor.tenantId,
        projectId: project.id,
        members: parsed.value.members
      });

      await deps.appendManagementAuditEvent({
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "project.resource_pool_replaced",
        sourceWorkflow: "project_resources",
        sourceEntity: { type: "Project", id: project.id },
        commandInput: { members: parsed.value.members },
        beforeState: { members: beforeMembers.map(toAuditMember) },
        afterState: { members: members.map(toAuditMember) },
        permissionResult,
        executionResult: { status: "succeeded" }
      }, transactionDataSource);

      return { ok: true as const, members, projectId: project.id };
    });

    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ resourcePool: serializeResourcePool(result.projectId, result.members) });
  });
}

function parseResourcePoolReplaceBody(
  value: unknown
): { ok: true; value: { members: ProjectResourcePoolMemberWrite[] } } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "invalid_resource_pool_body" };
  }
  const members = (value as { members?: unknown }).members;
  if (!Array.isArray(members)) return { ok: false, error: "invalid_resource_pool_members" };

  const seenUserIds = new Set<string>();
  const parsedMembers: ProjectResourcePoolMemberWrite[] = [];
  for (const member of members) {
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      return { ok: false, error: "invalid_resource_pool_member" };
    }
    const userId = (member as { userId?: unknown }).userId;
    const role = (member as { role?: unknown }).role;
    if (typeof userId !== "string" || !/^[a-z0-9][a-z0-9_-]{2,119}$/.test(userId.trim())) {
      return { ok: false, error: "invalid_resource_pool_user_id" };
    }
    if (typeof role !== "string" || !projectResourcePoolRoles.has(role)) {
      return { ok: false, error: "invalid_resource_pool_role" };
    }
    const normalizedUserId = userId.trim();
    if (seenUserIds.has(normalizedUserId)) {
      return { ok: false, error: "duplicate_resource_pool_user" };
    }
    seenUserIds.add(normalizedUserId);
    parsedMembers.push({ userId: normalizedUserId, role: role as ProjectResourcePoolRole });
  }

  return { ok: true, value: { members: parsedMembers } };
}

function isReadableProjectStatus(status: string) {
  return status === "active" || status === "paused";
}

function serializeResourcePool(
  projectId: string,
  members: Array<{ userId: string; role: string; createdAt: Date; updatedAt: Date }>
) {
  return {
    projectId,
    members: members.map((member) => ({
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString()
    }))
  };
}

function toAuditMember(member: { userId: string; role: string }) {
  return { userId: member.userId, role: member.role };
}
