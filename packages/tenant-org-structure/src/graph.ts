import type {
  OrgNodeType,
  OrgStructureNodeInput,
  OrgStructureNodeRecord,
  OrgStructurePlacementInput,
  OrgStructurePlacementRecord,
  OrgStructureTrack,
  OrgStructureTrackSnapshot,
  TenantOrgStructureSnapshot
} from "./types";

export type OrgNodeShape = {
  nodeType: OrgNodeType;
  parentId: string | null;
};

export function getOrgStructureTrackSnapshot(
  snapshot: TenantOrgStructureSnapshot,
  track: OrgStructureTrack
): OrgStructureTrackSnapshot {
  return track === "functional" ? snapshot.functional : snapshot.project;
}

export function buildOrgNodeById<T extends { id: string }>(nodes: T[]): Map<string, T> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function placementUnitId(
  placement: Pick<OrgStructurePlacementRecord, "departmentId" | "teamId"> | OrgStructurePlacementInput,
  track: OrgStructureTrack
): string | null {
  return track === "functional" ? (placement.departmentId ?? null) : (placement.teamId ?? null);
}

export function unitNodeTypeForTrack(track: OrgStructureTrack): "department" | "team" {
  return track === "functional" ? "department" : "team";
}

export function isPlacementConsistentWithNodes(
  placement: OrgStructurePlacementInput | OrgStructurePlacementRecord,
  track: OrgStructureTrack,
  nodeById: Map<string, OrgNodeShape>
): boolean {
  const direction = nodeById.get(placement.directionId);
  if (!direction || direction.nodeType !== "direction") return false;

  const unitId = placementUnitId(placement, track);
  if (!unitId) return false;

  const unit = nodeById.get(unitId);
  const expectedUnitType = unitNodeTypeForTrack(track);
  return Boolean(
    unit && unit.parentId === placement.directionId && unit.nodeType === expectedUnitType
  );
}

export function placementMatchesOrgFilter(
  placement: OrgStructurePlacementRecord,
  track: OrgStructureTrack,
  nodeById: Map<string, OrgNodeShape>,
  filter: { directionId?: string; unitId?: string }
): boolean {
  if (!isPlacementConsistentWithNodes(placement, track, nodeById)) return false;
  if (filter.directionId && placement.directionId !== filter.directionId) return false;
  const unitId = placementUnitId(placement, track);
  if (filter.unitId && unitId !== filter.unitId) return false;
  return true;
}

export function listDirectionChildUnits(
  trackSnapshot: OrgStructureTrackSnapshot,
  track: OrgStructureTrack
): Map<string, Array<{ id: string; name: string }>> {
  const nodeById = buildOrgNodeById(trackSnapshot.nodes);
  const unitType = unitNodeTypeForTrack(track);
  const unitsByDirection = new Map<string, Array<{ id: string; name: string }>>();

  for (const node of trackSnapshot.nodes) {
    if (node.nodeType !== unitType || !node.parentId) continue;
    const parent = nodeById.get(node.parentId);
    if (!parent || parent.nodeType !== "direction") continue;
    const units = unitsByDirection.get(node.parentId) ?? [];
    units.push({ id: node.id, name: node.name });
    unitsByDirection.set(node.parentId, units);
  }

  return unitsByDirection;
}

export function sortedDirectionNodes(
  trackSnapshot: OrgStructureTrackSnapshot
): OrgStructureNodeRecord[] {
  return trackSnapshot.nodes
    .filter((node) => node.nodeType === "direction")
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ru")
    );
}

export function listOrgFilterUnitOptions(
  trackSnapshot: OrgStructureTrackSnapshot,
  track: OrgStructureTrack
): Array<{ id: string; name: string; directionId: string }> {
  const nodeById = buildOrgNodeById(trackSnapshot.nodes);
  const unitType = unitNodeTypeForTrack(track);
  return trackSnapshot.nodes
    .filter((node) => {
      if (node.nodeType !== unitType || !node.parentId) return false;
      const parent = nodeById.get(node.parentId);
      return parent?.nodeType === "direction";
    })
    .map((node) => ({
      id: node.id,
      name: node.name,
      directionId: node.parentId!
    }));
}

export function nodeByIdFrom(nodes: OrgStructureNodeInput[]): Map<string, OrgStructureNodeInput> {
  return buildOrgNodeById(nodes);
}
