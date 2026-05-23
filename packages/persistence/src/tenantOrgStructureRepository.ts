import { and, asc, eq } from "drizzle-orm";

import type { TenantId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { tenantOrgNodes, tenantUserOrgPlacements } from "./schema";

export const ORG_STRUCTURE_TRACKS = ["functional", "project"] as const;
export type OrgStructureTrack = (typeof ORG_STRUCTURE_TRACKS)[number];

export const ORG_NODE_TYPES = ["direction", "department", "team"] as const;
export type OrgNodeType = (typeof ORG_NODE_TYPES)[number];

export type TenantOrgNodeRecord = {
  id: string;
  tenantId: TenantId;
  track: OrgStructureTrack;
  nodeType: OrgNodeType;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type TenantUserOrgPlacementRecord = {
  tenantId: TenantId;
  userId: string;
  track: OrgStructureTrack;
  directionId: string;
  departmentId: string | null;
  teamId: string | null;
  positionId: string;
};

export type OrgStructureTrackSnapshot = {
  nodes: TenantOrgNodeRecord[];
  placements: TenantUserOrgPlacementRecord[];
};

export type TenantOrgStructureSnapshot = {
  functional: OrgStructureTrackSnapshot;
  project: OrgStructureTrackSnapshot;
};

export type OrgStructureNodeInput = {
  id: string;
  nodeType: OrgNodeType;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type OrgStructurePlacementInput = {
  userId: string;
  directionId: string;
  departmentId?: string | null;
  teamId?: string | null;
  positionId: string;
};

export type OrgStructureTrackInput = {
  nodes: OrgStructureNodeInput[];
  placements: OrgStructurePlacementInput[];
};

export type TenantOrgStructureRepository = {
  getOrgStructure(tenantId: TenantId): Promise<TenantOrgStructureSnapshot>;
  replaceOrgStructure(
    tenantId: TenantId,
    input: {
      functional: OrgStructureTrackInput;
      project: OrgStructureTrackInput;
    }
  ): Promise<TenantOrgStructureSnapshot>;
};

function mapNode(row: typeof tenantOrgNodes.$inferSelect): TenantOrgNodeRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    track: row.track as OrgStructureTrack,
    nodeType: row.nodeType as OrgNodeType,
    name: row.name,
    parentId: row.parentId,
    sortOrder: row.sortOrder
  };
}

function mapPlacement(
  row: typeof tenantUserOrgPlacements.$inferSelect
): TenantUserOrgPlacementRecord {
  return {
    tenantId: row.tenantId,
    userId: row.userId,
    track: row.track as OrgStructureTrack,
    directionId: row.directionId,
    departmentId: row.departmentId,
    teamId: row.teamId,
    positionId: row.positionId
  };
}

function isNodeType(value: string): value is OrgNodeType {
  return (ORG_NODE_TYPES as readonly string[]).includes(value);
}

function validateTrackInput(track: OrgStructureTrack, input: OrgStructureTrackInput): void {
  const nodeIds = new Set(input.nodes.map((node) => node.id));
  for (const node of input.nodes) {
    if (!isNodeType(node.nodeType)) throw new Error("tenant_org_node_invalid_type");
    if (track === "functional" && node.nodeType === "team") {
      throw new Error("tenant_org_node_invalid_type");
    }
    if (track === "project" && node.nodeType === "department") {
      throw new Error("tenant_org_node_invalid_type");
    }
    if (node.nodeType === "direction") {
      if (node.parentId !== null) throw new Error("tenant_org_node_invalid_parent");
      continue;
    }
    if (!node.parentId || !nodeIds.has(node.parentId)) {
      throw new Error("tenant_org_node_invalid_parent");
    }
  }
  for (const placement of input.placements) {
    if (!nodeIds.has(placement.directionId)) {
      throw new Error("tenant_org_placement_invalid_direction");
    }
    if (track === "functional") {
      if (!placement.departmentId || !nodeIds.has(placement.departmentId)) {
        throw new Error("tenant_org_placement_invalid_department");
      }
      if (placement.teamId) throw new Error("tenant_org_placement_invalid_team");
    } else {
      if (!placement.teamId || !nodeIds.has(placement.teamId)) {
        throw new Error("tenant_org_placement_invalid_team");
      }
      if (placement.departmentId) throw new Error("tenant_org_placement_invalid_department");
    }
  }
}

export function createTenantOrgStructureRepository(db: KissPmDatabase): TenantOrgStructureRepository {
  async function listTrack(
    tenantId: TenantId,
    track: OrgStructureTrack
  ): Promise<OrgStructureTrackSnapshot> {
    const nodes = await db
      .select()
      .from(tenantOrgNodes)
      .where(and(eq(tenantOrgNodes.tenantId, tenantId), eq(tenantOrgNodes.track, track)))
      .orderBy(asc(tenantOrgNodes.sortOrder), asc(tenantOrgNodes.name));
    const placements = await db
      .select()
      .from(tenantUserOrgPlacements)
      .where(
        and(eq(tenantUserOrgPlacements.tenantId, tenantId), eq(tenantUserOrgPlacements.track, track))
      );
    return {
      nodes: nodes.map(mapNode),
      placements: placements.map(mapPlacement)
    };
  }

  return {
    async getOrgStructure(tenantId) {
      const [functional, project] = await Promise.all([
        listTrack(tenantId, "functional"),
        listTrack(tenantId, "project")
      ]);
      return { functional, project };
    },

    async replaceOrgStructure(tenantId, input) {
      validateTrackInput("functional", input.functional);
      validateTrackInput("project", input.project);

      await db.transaction(async (tx) => {
        await tx.delete(tenantUserOrgPlacements).where(eq(tenantUserOrgPlacements.tenantId, tenantId));
        await tx.delete(tenantOrgNodes).where(eq(tenantOrgNodes.tenantId, tenantId));

        const allNodes = [
          ...input.functional.nodes.map((node) => ({ ...node, track: "functional" as const })),
          ...input.project.nodes.map((node) => ({ ...node, track: "project" as const }))
        ];
        if (allNodes.length > 0) {
          await tx.insert(tenantOrgNodes).values(
            allNodes.map((node) => ({
              id: node.id,
              tenantId,
              track: node.track,
              nodeType: node.nodeType,
              name: node.name.trim(),
              parentId: node.parentId,
              sortOrder: node.sortOrder
            }))
          );
        }

        const allPlacements = [
          ...input.functional.placements.map((placement) => ({
            ...placement,
            track: "functional" as const,
            departmentId: placement.departmentId ?? null,
            teamId: null
          })),
          ...input.project.placements.map((placement) => ({
            ...placement,
            track: "project" as const,
            departmentId: null,
            teamId: placement.teamId ?? null
          }))
        ];
        if (allPlacements.length > 0) {
          await tx.insert(tenantUserOrgPlacements).values(
            allPlacements.map((placement) => ({
              tenantId,
              userId: placement.userId,
              track: placement.track,
              directionId: placement.directionId,
              departmentId: placement.departmentId,
              teamId: placement.teamId,
              positionId: placement.positionId
            }))
          );
        }
      });

      return this.getOrgStructure(tenantId);
    }
  };
}
