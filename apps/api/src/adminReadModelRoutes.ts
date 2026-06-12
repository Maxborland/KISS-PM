import {
  canReadAccessProfiles,
  canReadPositions,
  canReadTenantUsers,
  canReadWorkspaceConfig,
  permissions,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerAdminReadModelRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const { dataSource, getActorProfile, getSessionActorFromHeaders } = deps;

  app.get("/api/workspace/admin/read-model", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.listWorkspaceUsers ||
      !dataSource.listPositions ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listCustomFieldDefinitions
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decisions = [
      canReadTenantUsers({ actor, profile, targetTenantId: actor.tenantId }),
      canReadPositions({ actor, profile, targetTenantId: actor.tenantId }),
      canReadAccessProfiles({ actor, profile, targetTenantId: actor.tenantId }),
      canReadWorkspaceConfig({ actor, profile, targetTenantId: actor.tenantId })
    ];
    const deniedDecision = decisions.find((decision) => !decision.allowed);
    if (deniedDecision) {
      await appendAdminReadModelDeniedAudit(deps, actor, deniedDecision);
      return context.json({ error: deniedDecision.reason }, 403);
    }

    const [users, positions, accessRoles, customFields] = await Promise.all([
      dataSource.listWorkspaceUsers(actor.tenantId),
      dataSource.listPositions(actor.tenantId),
      dataSource.listAccessProfilesByTenantId(actor.tenantId),
      dataSource.listCustomFieldDefinitions(actor.tenantId)
    ]);

    return context.json({
      users,
      positions,
      accessRoles,
      permissionCatalogue: permissions,
      customFields
    });
  });
}

async function appendAdminReadModelDeniedAudit(
  deps: ApiRouteDeps,
  actor: TenantUser,
  decision: PolicyDecision
) {
  if (!deps.dataSource.appendAuditEvent) return;

  await deps.appendManagementAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actionType: "workspace.admin_read_model.read_denied",
    sourceWorkflow: "single_workspace_admin_read_model",
    sourceEntity: { type: "WorkspaceAdminReadModel", id: "admin-read-model" },
    commandInput: { resource: "admin-read-model" },
    beforeState: null,
    afterState: null,
    permissionResult: decision,
    executionResult: { status: "denied", reason: decision.reason }
  });
}
