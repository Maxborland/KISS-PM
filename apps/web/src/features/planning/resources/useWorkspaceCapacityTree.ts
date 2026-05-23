"use client";

import { useQuery } from "@tanstack/react-query";

import type { OrgCapacityTree } from "./resourceMatrixTypes";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export function capacityTreeQueryKey(monthIso: string, projectId?: string | null) {
  return ["workspace-capacity-tree", monthIso, projectId ?? ""] as const;
}

export function useWorkspaceCapacityTree(
  monthIso: string,
  enabled: boolean,
  projectId?: string | null
) {
  return useQuery({
    queryKey: capacityTreeQueryKey(monthIso, projectId),
    queryFn: () => fetchCapacityTree(monthIso, projectId),
    enabled: enabled && monthIso.length > 0,
    staleTime: 30_000
  });
}

async function fetchCapacityTree(
  monthIso: string,
  projectId?: string | null
): Promise<OrgCapacityTree> {
  const params = new URLSearchParams({ monthIso });
  if (projectId) params.set("projectId", projectId);
  const response = await fetch(`${apiOrigin}/api/workspace/capacity/tree?${params.toString()}`, {
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`capacity_tree_${response.status}`);
  }
  return (await response.json()) as OrgCapacityTree;
}
