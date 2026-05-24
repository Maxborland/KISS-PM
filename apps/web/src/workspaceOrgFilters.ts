import type {
  OrgStructureTrack,
  TenantOrgStructureSnapshot
} from "@kiss-pm/tenant-org-structure";
import {
  buildOrgNodeById,
  getOrgStructureTrackSnapshot,
  listOrgFilterUnitOptions,
  placementMatchesOrgFilter
} from "@kiss-pm/tenant-org-structure";

import type { WorkspaceUser } from "./api";

export type UsersOrgFilter = {
  track: OrgStructureTrack;
  directionId: string;
  unitId: string;
  unplacedOnly: boolean;
};

export { placementMatchesOrgFilter };

export function filterUsersByOrgPlacement(
  users: WorkspaceUser[],
  orgStructure: TenantOrgStructureSnapshot | undefined,
  filter: UsersOrgFilter
): WorkspaceUser[] {
  if (!orgStructure) return users;

  const trackSnapshot = getOrgStructureTrackSnapshot(orgStructure, filter.track);
  const placementByUserId = new Map(
    trackSnapshot.placements.map((placement) => [placement.userId, placement])
  );
  const nodeById = buildOrgNodeById(trackSnapshot.nodes);

  return users.filter((user) => {
    const placement = placementByUserId.get(user.id);
    if (filter.unplacedOnly) return !placement;
    if (!filter.directionId && !filter.unitId) return true;
    if (!placement) return false;
    return placementMatchesOrgFilter(placement, filter.track, nodeById, filter);
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

  const trackSnapshot = getOrgStructureTrackSnapshot(orgStructure, track);
  const directions = trackSnapshot.nodes
    .filter((node) => node.nodeType === "direction")
    .map((node) => ({ id: node.id, name: node.name }));

  return { directions, units: listOrgFilterUnitOptions(trackSnapshot, track) };
}
