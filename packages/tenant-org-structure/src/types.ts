export const ORG_STRUCTURE_TRACKS = ["functional", "project"] as const;
export type OrgStructureTrack = (typeof ORG_STRUCTURE_TRACKS)[number];

export const ORG_NODE_TYPES = ["direction", "department", "team"] as const;
export type OrgNodeType = (typeof ORG_NODE_TYPES)[number];

export type OrgStructureNodeRecord = {
  id: string;
  tenantId: string;
  track: OrgStructureTrack;
  nodeType: OrgNodeType;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type OrgStructurePlacementRecord = {
  tenantId: string;
  userId: string;
  track: OrgStructureTrack;
  directionId: string;
  departmentId: string | null;
  teamId: string | null;
  positionId: string;
};

export type OrgStructureTrackSnapshot = {
  nodes: OrgStructureNodeRecord[];
  placements: OrgStructurePlacementRecord[];
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

export type OrgStructureReplaceInput = {
  functional: OrgStructureTrackInput;
  project: OrgStructureTrackInput;
};
