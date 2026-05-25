import {
  canManageOrgStructure,
  canReadOrgStructure,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import {
  ORG_NODE_TYPES,
  createTenantOrgStructureRepository,
  type OrgNodeType,
  type OrgStructureTrack,
  type OrgStructureTrackInput,
  type KissPmDatabase
} from "@kiss-pm/persistence";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import {
  replaceTenantOrgStructureCommand,
  tenantOrgStructureErrorMessage
} from "./tenantOrgStructure/replaceTenantOrgStructureCommand";

type OrgStructureRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  appendManagementAuditEvent(input: ManagementAuditEventInput): Promise<string>;
};

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

function isNodeType(value: string): value is OrgNodeType {
  return (ORG_NODE_TYPES as readonly string[]).includes(value);
}

function parseTrackInput(
  value: unknown,
  track: OrgStructureTrack
):
  | {
      ok: true;
      value: OrgStructureTrackInput;
    }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "tenant_org_structure_invalid" };
  const row = value as Record<string, unknown>;
  const nodesRaw = Array.isArray(row.nodes) ? row.nodes : [];
  const placementsRaw = Array.isArray(row.placements) ? row.placements : [];
  const nodes = [];
  for (const item of nodesRaw) {
    if (!item || typeof item !== "object") return { ok: false, error: "tenant_org_structure_invalid" };
    const node = item as Record<string, unknown>;
    const id = typeof node.id === "string" ? node.id.trim() : "";
    const nodeType = typeof node.nodeType === "string" ? node.nodeType.trim() : "";
    const name = typeof node.name === "string" ? node.name.trim() : "";
    const parentId =
      node.parentId === null || node.parentId === undefined
        ? null
        : typeof node.parentId === "string"
          ? node.parentId.trim() || null
          : null;
    const sortOrder =
      typeof node.sortOrder === "number" && Number.isFinite(node.sortOrder)
        ? Math.trunc(node.sortOrder)
        : 0;
    if (!id || !name || !isNodeType(nodeType)) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    nodes.push({ id, nodeType, name, parentId, sortOrder });
  }
  const placements = [];
  for (const item of placementsRaw) {
    if (!item || typeof item !== "object") return { ok: false, error: "tenant_org_structure_invalid" };
    const placement = item as Record<string, unknown>;
    const userId = typeof placement.userId === "string" ? placement.userId.trim() : "";
    const directionId =
      typeof placement.directionId === "string" ? placement.directionId.trim() : "";
    const positionId = typeof placement.positionId === "string" ? placement.positionId.trim() : "";
    const departmentId =
      placement.departmentId === null || placement.departmentId === undefined
        ? null
        : typeof placement.departmentId === "string"
          ? placement.departmentId.trim() || null
          : null;
    const teamId =
      placement.teamId === null || placement.teamId === undefined
        ? null
        : typeof placement.teamId === "string"
          ? placement.teamId.trim() || null
          : null;
    if (!userId || !directionId || !positionId) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    if (track === "functional" && !departmentId) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    if (track === "project" && !teamId) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    placements.push({ userId, directionId, departmentId, teamId, positionId });
  }
  return { ok: true, value: { nodes, placements } };
}

function parseReplaceBody(input: unknown):
  | {
      ok: true;
      value: {
        functional: OrgStructureTrackInput;
        project: OrgStructureTrackInput;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "tenant_org_structure_invalid" };
  const row = input as Record<string, unknown>;
  const functional = parseTrackInput(row.functional, "functional");
  if (!functional.ok) return functional;
  const project = parseTrackInput(row.project, "project");
  if (!project.ok) return project;
  return { ok: true, value: { functional: functional.value, project: project.value } };
}

export function registerOrgStructureRoutes(app: Hono, deps: OrgStructureRouteDeps) {
  app.get("/api/tenant/current/org-structure", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canReadOrgStructure({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const repository = createTenantOrgStructureRepository(db);
    const orgStructure = await repository.getOrgStructure(actor.tenantId);
    return context.json({ orgStructure });
  });

  app.put("/api/tenant/current/org-structure", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canManageOrgStructure({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseReplaceBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    try {
      const orgStructure = await replaceTenantOrgStructureCommand({
        db,
        tenantId: actor.tenantId,
        actor,
        body: parsed.value,
        permissionResult: decision,
        appendManagementAuditEvent: deps.appendManagementAuditEvent
      });
      return context.json({ orgStructure });
    } catch (error) {
      const message = tenantOrgStructureErrorMessage(error);
      if (message) return context.json({ error: message }, 400);
      throw error;
    }
  });
}
