import type { WorkspaceUser } from "./api";
import type { OrgStructureTrack, TenantOrgStructureSnapshot } from "./features/org-structure/useOrgStructure";

export type UsersOrgFilter = {
  track: OrgStructureTrack;
  directionId: string;
  unitId: string;
  unplacedOnly: boolean;
};

export function filterUsersByOrgPlacement(
  users: WorkspaceUser[],
  orgStructure: TenantOrgStructureSnapshot | undefined,
  filter: UsersOrgFilter
): WorkspaceUser[] {
  if (!orgStructure) return users;

  const trackSnapshot =
    filter.track === "functional" ? orgStructure.functional : orgStructure.project;
  const placementByUserId = new Map(
    trackSnapshot.placements.map((placement) => [placement.userId, placement])
  );

  return users.filter((user) => {
    const placement = placementByUserId.get(user.id);
    if (filter.unplacedOnly) return !placement;
    if (!filter.directionId && !filter.unitId) return true;
    if (!placement) return false;
    if (filter.directionId && placement.directionId !== filter.directionId) return false;
    if (filter.unitId) {
      const unitId =
        filter.track === "functional" ? placement.departmentId : placement.teamId;
      if (unitId !== filter.unitId) return false;
    }
    return true;
  });
}

export function listOrgFilterOptions(
  orgStructure: TenantOrgStructureSnapshot | undefined,
  track: OrgStructureTrack
): {
  directions: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; directionId: string }>;
} {
  if (!orgStructure) return { directions: [], units: [] };
  const trackSnapshot = track === "functional" ? orgStructure.functional : orgStructure.project;
  const directions = trackSnapshot.nodes
    .filter((node) => node.nodeType === "direction")
    .map((node) => ({ id: node.id, name: node.name }));
  const unitType = track === "functional" ? "department" : "team";
  const units = trackSnapshot.nodes
    .filter((node) => node.nodeType === unitType && node.parentId)
    .map((node) => ({
      id: node.id,
      name: node.name,
      directionId: node.parentId!
    }));
  return { directions, units };
}
