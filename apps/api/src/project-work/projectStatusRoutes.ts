import { canManageProjects } from "@kiss-pm/access-control";
import type { Hono } from "hono";

import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "../jsonBody";
import { parseUpdateProjectStatusBody } from "../projectWorkParsers";
import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import { parseProjectIdParam } from "../routeParamParsers";
import {
  appendProjectStatusDeniedAudit,
  isMutableProjectStatus,
  projectManagePermissionResult
} from "./projectWorkAudit";

export function registerProjectStatusRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const { getSessionActorFromHeaders, getActorProfile, dataSource } = deps;

  app.patch("/api/workspace/projects/:projectId/status", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseUpdateProjectStatusBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await getActorProfile(actor);
    const permissionResult = projectManagePermissionResult(canManageProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    }));
    if (!permissionResult.allowed) {
      await appendProjectStatusDeniedAudit(
        deps,
        actor,
        projectId.value,
        parsed.value.status,
        permissionResult
      );
      return context.json({ error: permissionResult.reason }, 403);
    }

    if (!deps.dataSource.listProjects || !deps.dataSource.updateProjectStatus) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.listProjects || !transactionDataSource.updateProjectStatus) {
        throw new Error("persistence_not_configured");
      }

      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
      const project = (await transactionDataSource.listProjects(actor.tenantId)).find(
        (candidate) => candidate.id === projectId.value
      );
      if (!project) return { ok: false as const, status: 404 as const, error: "project_not_found" };
      if (
        !isMutableProjectStatus(project.status) ||
        !isMutableProjectStatus(parsed.value.status) ||
        project.status === parsed.value.status
      ) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "project_status_transition_not_allowed"
        };
      }

      const updated = await transactionDataSource.updateProjectStatus({
        tenantId: actor.tenantId,
        projectId: project.id,
        expectedStatus: project.status,
        status: parsed.value.status
      });
      if (!updated) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "project_status_transition_not_allowed"
        };
      }

      await deps.appendManagementAuditEvent({
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "project.status_changed",
        sourceWorkflow: "project_core",
        sourceEntity: { type: "Project", id: updated.id },
        commandInput: { status: parsed.value.status },
        beforeState: { status: project.status },
        afterState: { status: updated.status },
        permissionResult,
        executionResult: { status: "succeeded" }
      }, transactionDataSource);

      return { ok: true as const, project: updated };
    });

    if (!result.ok) return context.json({ error: result.error }, result.status);
    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ project: result.project });
  });

}
