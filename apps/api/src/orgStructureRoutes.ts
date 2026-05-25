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
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import { parsePositionIdParam, parseUserIdParam } from "./routeParamParsers";
import {
  replaceTenantOrgStructureCommand,
  tenantOrgStructureErrorMessage
} from "./tenantOrgStructure/replaceTenantOrgStructureCommand";

type OrgStructureRouteDeps = {
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

const maxOrgStructureNodesPerTrack = 500;
const maxOrgStructurePlacementsPerTrack = 2_000;
const maxOrgStructureNameLength = 160;
const maxOrgStructureSortOrder = 1_000_000;

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

function isNodeType(value: string): value is OrgNodeType {
  return (ORG_NODE_TYPES as readonly string[]).includes(value);
}

function parseOrgStructureId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^[a-z0-9][a-z0-9_-]{2,119}$/.test(normalized)) return null;
  return normalized;
}

function parseOptionalOrgStructureId(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return parseOrgStructureId(normalized) ?? undefined;
}

function parseOrgStructureName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxOrgStructureNameLength) return null;
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

function parseOrgStructureSortOrder(value: unknown): number | null {
  if (value === null || value === undefined) return 0;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maxOrgStructureSortOrder
  ) {
    return null;
  }
  return value;
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
  if (
    nodesRaw.length > maxOrgStructureNodesPerTrack ||
    placementsRaw.length > maxOrgStructurePlacementsPerTrack
  ) {
    return { ok: false, error: "tenant_org_structure_invalid" };
  }
  const nodes = [];
  for (const item of nodesRaw) {
    if (!item || typeof item !== "object") return { ok: false, error: "tenant_org_structure_invalid" };
    const node = item as Record<string, unknown>;
    const id = parseOrgStructureId(node.id);
    const nodeType = typeof node.nodeType === "string" ? node.nodeType.trim() : "";
    const name = parseOrgStructureName(node.name);
    const parentId = parseOptionalOrgStructureId(node.parentId);
    const sortOrder = parseOrgStructureSortOrder(node.sortOrder);
    if (!id || !name || parentId === undefined || sortOrder === null || !isNodeType(nodeType)) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    nodes.push({ id, nodeType, name, parentId, sortOrder });
  }
  const placements = [];
  for (const item of placementsRaw) {
    if (!item || typeof item !== "object") return { ok: false, error: "tenant_org_structure_invalid" };
    const placement = item as Record<string, unknown>;
    const userId = parseUserIdParam(placement.userId);
    const directionId = parseOrgStructureId(placement.directionId);
    const positionId = parsePositionIdParam(placement.positionId);
    const departmentId = parseOptionalOrgStructureId(placement.departmentId);
    const teamId = parseOptionalOrgStructureId(placement.teamId);
    if (
      !userId.ok ||
      !directionId ||
      !positionId.ok ||
      departmentId === undefined ||
      teamId === undefined
    ) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    if (track === "functional" && !departmentId) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    if (track === "project" && !teamId) {
      return { ok: false, error: "tenant_org_structure_invalid" };
    }
    placements.push({
      userId: userId.value,
      directionId,
      departmentId,
      teamId,
      positionId: positionId.value
    });
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
    if (!db || !deps.dataSource.withTransaction || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

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
      const orgStructure = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        const transactionDb = resolveDb(transactionDataSource);
        if (!transactionDb || !transactionDataSource.appendAuditEvent) {
          throw new Error("persistence_not_configured");
        }
        return replaceTenantOrgStructureCommand({
          db: transactionDb,
          tenantId: actor.tenantId,
          actor,
          body: parsed.value,
          permissionResult: decision,
          auditDataSource: transactionDataSource,
          appendManagementAuditEvent: deps.appendManagementAuditEvent
        });
      });
      invalidateCapacityCacheForTenant(actor.tenantId);
      return context.json({ orgStructure });
    } catch (error) {
      if (error instanceof Error && error.message === "persistence_not_configured") {
        return context.json({ error: "persistence_not_configured" }, 501);
      }
      const message = tenantOrgStructureErrorMessage(error);
      if (message) return context.json({ error: message }, 400);
      throw error;
    }
  });
}
