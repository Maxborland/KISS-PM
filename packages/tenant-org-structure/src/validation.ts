import {
  isPlacementConsistentWithNodes,
  nodeByIdFrom,
  unitNodeTypeForTrack
} from "./graph";
import type {
  OrgNodeType,
  OrgStructureTrack,
  OrgStructureTrackInput,
  OrgStructureReplaceInput
} from "./types";
import { ORG_NODE_TYPES } from "./types";

function isNodeType(value: string): value is OrgNodeType {
  return (ORG_NODE_TYPES as readonly string[]).includes(value);
}

function isNodeTypeAllowedOnTrack(track: OrgStructureTrack, nodeType: OrgNodeType): boolean {
  if (track === "functional" && nodeType === "team") return false;
  if (track === "project" && nodeType === "department") return false;
  return true;
}

function captureOrgStructureValidationError(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "tenant_org_structure_invalid";
  }
}

function validateDuplicateNodeIds(input: OrgStructureReplaceInput): void {
  const seen = new Set<string>();
  for (const node of [...input.functional.nodes, ...input.project.nodes]) {
    if (seen.has(node.id)) {
      throw new Error("tenant_org_node_duplicate_id");
    }
    seen.add(node.id);
  }
}

function validateTrackInput(track: OrgStructureTrack, input: OrgStructureTrackInput): void {
  const nodeById = nodeByIdFrom(input.nodes);

  for (const node of input.nodes) {
    if (!isNodeType(node.nodeType) || !isNodeTypeAllowedOnTrack(track, node.nodeType)) {
      throw new Error("tenant_org_node_invalid_type");
    }
    if (node.nodeType === "direction") {
      if (node.parentId !== null) throw new Error("tenant_org_node_invalid_parent");
      continue;
    }
    if (!node.parentId) {
      throw new Error("tenant_org_node_invalid_parent");
    }
    const parent = nodeById.get(node.parentId);
    if (!parent || parent.nodeType !== "direction") {
      throw new Error("tenant_org_node_invalid_parent");
    }
  }

  const placementUserIds = new Set<string>();
  for (const placement of input.placements) {
    if (placementUserIds.has(placement.userId)) {
      throw new Error("tenant_org_placement_duplicate_user");
    }
    placementUserIds.add(placement.userId);

    if (!isPlacementConsistentWithNodes(placement, track, nodeById)) {
      const direction = nodeById.get(placement.directionId);
      if (!direction || direction.nodeType !== "direction") {
        throw new Error("tenant_org_placement_invalid_direction");
      }
      if (track === "functional") {
        if (!placement.departmentId) throw new Error("tenant_org_placement_invalid_department");
        if (placement.teamId) throw new Error("tenant_org_placement_invalid_team");
        throw new Error("tenant_org_placement_invalid_department");
      }
      if (!placement.teamId) throw new Error("tenant_org_placement_invalid_team");
      if (placement.departmentId) throw new Error("tenant_org_placement_invalid_department");
      throw new Error("tenant_org_placement_invalid_team");
    }
  }
}

export function validateOrgStructureReplace(input: OrgStructureReplaceInput): string | null {
  return captureOrgStructureValidationError(() => {
    validateDuplicateNodeIds(input);
    validateTrackInput("functional", input.functional);
    validateTrackInput("project", input.project);
  });
}
