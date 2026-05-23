import { and, asc, eq } from "drizzle-orm";

import type { TenantId } from "@kiss-pm/domain";
import {
  ORG_NODE_TYPES,
  ORG_STRUCTURE_TRACKS,
  validateOrgStructureReplace,
  type OrgNodeType,
  type OrgStructureNodeInput,
  type OrgStructurePlacementInput,
  type OrgStructureReplaceInput,
  type OrgStructureTrack,
  type OrgStructureTrackInput,
  type OrgStructureTrackSnapshot,
  type OrgStructureNodeRecord,
  type OrgStructurePlacementRecord,
  type TenantOrgStructureSnapshot
} from "@kiss-pm/tenant-org-structure";

import type { KissPmDatabase } from "./connection";
import { positions, tenantOrgNodes, tenantUserOrgPlacements, tenantUsers } from "./schema";

export {
  ORG_NODE_TYPES,
  ORG_STRUCTURE_TRACKS,
  validateOrgStructureReplace,
  type OrgNodeType,
  type OrgStructureNodeInput,
  type OrgStructurePlacementInput,
  type OrgStructureReplaceInput,
  type OrgStructureTrack,
  type OrgStructureTrackInput
};

export type TenantOrgNodeRecord = OrgStructureNodeRecord;
export type TenantUserOrgPlacementRecord = OrgStructurePlacementRecord;
export type { OrgStructureTrackSnapshot, TenantOrgStructureSnapshot };

export type TenantOrgStructureRepository = {
  getOrgStructure(tenantId: TenantId): Promise<TenantOrgStructureSnapshot>;
  replaceOrgStructure(
    tenantId: TenantId,
    input: OrgStructureReplaceInput
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

export async function validateOrgStructureReplaceForTenant(
  db: KissPmDatabase,
  tenantId: TenantId,
  input: OrgStructureReplaceInput
): Promise<string | null> {
  const syncError = validateOrgStructureReplace(input);
  if (syncError) return syncError;

  const [positionRows, userRows] = await Promise.all([
    db.select({ id: positions.id }).from(positions).where(eq(positions.tenantId, tenantId)),
    db.select({ id: tenantUsers.id }).from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId))
  ]);
  const positionIds = new Set(positionRows.map((row) => row.id));
  const userIds = new Set(userRows.map((row) => row.id));

  for (const trackInput of [input.functional, input.project]) {
    for (const placement of trackInput.placements) {
      if (!userIds.has(placement.userId)) return "tenant_org_placement_invalid_user";
      if (!positionIds.has(placement.positionId)) return "tenant_org_placement_invalid_position";
    }
  }

  return null;
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
      const validationError = await validateOrgStructureReplaceForTenant(db, tenantId, input);
      if (validationError) {
        throw new Error(validationError);
      }

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
