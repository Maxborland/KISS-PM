"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  OrgNodeType,
  OrgStructureNodeInput,
  OrgStructureNodeRecord,
  OrgStructurePlacementInput,
  OrgStructurePlacementRecord,
  OrgStructureReplaceInput,
  OrgStructureTrack,
  OrgStructureTrackSnapshot,
  TenantOrgStructureSnapshot
} from "@kiss-pm/tenant-org-structure";

import { getOrgStructureTrackSnapshot } from "./orgStructureTrackUtils";

export type {
  OrgNodeType,
  OrgStructureNodeInput,
  OrgStructurePlacementInput,
  OrgStructureReplaceInput,
  OrgStructureTrack,
  TenantOrgStructureSnapshot
};

export type OrgStructureNode = OrgStructureNodeRecord;
export type OrgStructurePlacement = OrgStructurePlacementRecord;
export type { OrgStructureTrackSnapshot };

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";
const orgStructureKey = ["tenant-org-structure"] as const;

export function useOrgStructure(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: orgStructureKey,
    queryFn: fetchOrgStructure,
    enabled
  });

  const saveMutation = useMutation({
    mutationFn: (input: OrgStructureReplaceInput) => saveOrgStructure(input),
    onSuccess: (orgStructure) => {
      queryClient.setQueryData(orgStructureKey, orgStructure);
    }
  });

  return {
    orgStructure: query.data,
    isLoading: query.isLoading,
    error: query.error,
    saveOrgStructure: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending
  };
}

async function fetchOrgStructure(): Promise<TenantOrgStructureSnapshot> {
  const response = await fetch(`${apiOrigin}/api/tenant/current/org-structure`, {
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`org_structure_load_failed_${response.status}`);
  }
  const body = (await response.json()) as { orgStructure: TenantOrgStructureSnapshot };
  return body.orgStructure;
}

async function saveOrgStructure(input: OrgStructureReplaceInput): Promise<TenantOrgStructureSnapshot> {
  const response = await fetch(`${apiOrigin}/api/tenant/current/org-structure`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `org_structure_save_failed_${response.status}`);
  }
  const body = (await response.json()) as { orgStructure: TenantOrgStructureSnapshot };
  return body.orgStructure;
}

export function hasOrgDirections(snapshot: TenantOrgStructureSnapshot | undefined, track: OrgStructureTrack): boolean {
  if (!snapshot) return false;
  return getOrgStructureTrackSnapshot(snapshot, track).nodes.some(
    (node) => node.nodeType === "direction"
  );
}
