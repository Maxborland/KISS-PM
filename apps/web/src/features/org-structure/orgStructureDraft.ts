import type { TenantOrgStructureSnapshot } from "./useOrgStructure";

type TrackSnapshot = TenantOrgStructureSnapshot["functional"];

export function removeOrgNode(snapshot: TrackSnapshot, nodeId: string): TrackSnapshot {
  const node = snapshot.nodes.find((item) => item.id === nodeId);
  if (!node) return snapshot;

  const idsToRemove = new Set<string>([nodeId]);
  if (node.nodeType === "direction") {
    for (const child of snapshot.nodes) {
      if (child.parentId === nodeId) idsToRemove.add(child.id);
    }
  }

  const nodes = snapshot.nodes.filter((item) => !idsToRemove.has(item.id));
  const placements = snapshot.placements.filter((placement) => {
    if (idsToRemove.has(placement.directionId)) return false;
    if (placement.departmentId && idsToRemove.has(placement.departmentId)) return false;
    if (placement.teamId && idsToRemove.has(placement.teamId)) return false;
    return true;
  });

  return { nodes, placements };
}

export function reparentOrgUnit(
  snapshot: TrackSnapshot,
  unitId: string,
  nextDirectionId: string
): TrackSnapshot {
  const unit = snapshot.nodes.find((item) => item.id === unitId);
  if (!unit || unit.nodeType === "direction") return snapshot;

  const nodes = snapshot.nodes.map((item) =>
    item.id === unitId ? { ...item, parentId: nextDirectionId || item.parentId } : item
  );

  const placements = snapshot.placements.map((placement) => {
    const unitField =
      placement.departmentId === unitId
        ? "departmentId"
        : placement.teamId === unitId
          ? "teamId"
          : null;
    if (!unitField) return placement;
    if (placement.directionId === nextDirectionId) return placement;
    return {
      ...placement,
      directionId: nextDirectionId,
      departmentId: unitField === "departmentId" ? null : placement.departmentId,
      teamId: unitField === "teamId" ? null : placement.teamId
    };
  });

  return { nodes, placements };
}
