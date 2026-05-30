"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { DealStage, Opportunity, Project } from "@/lib/api-types";
import { queryKeys } from "@/lib/api/query-keys";

type ListResponse<Key extends string, Item> = Record<Key, Item[]>;

export type ProjectsListReadModel = {
  projects: Project[];
};

export type DealsBoardReadModel = {
  opportunities: Opportunity[];
  dealStages: DealStage[];
};

export async function fetchWorkspaceProjects(): Promise<Project[]> {
  const response = await apiFetch<ListResponse<"projects", Project>>("/api/workspace/projects", {
    method: "GET"
  });
  return response.projects;
}

export async function fetchWorkspaceOpportunities(): Promise<Opportunity[]> {
  const response = await apiFetch<ListResponse<"opportunities", Opportunity>>(
    "/api/workspace/opportunities",
    { method: "GET" }
  );
  return response.opportunities;
}

export async function fetchWorkspaceDealStages(): Promise<DealStage[]> {
  const response = await apiFetch<ListResponse<"dealStages", DealStage>>("/api/workspace/deal-stages", {
    method: "GET"
  });
  return response.dealStages;
}

export function useProjectsListReadModelQuery() {
  return useQuery({
    queryKey: queryKeys.workspace.projects,
    queryFn: fetchWorkspaceProjects,
    select: (projects): ProjectsListReadModel => ({ projects })
  });
}

export function useDealsBoardReadModelQueries() {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.workspace.opportunities,
        queryFn: fetchWorkspaceOpportunities
      },
      {
        queryKey: queryKeys.workspace.dealStages,
        queryFn: fetchWorkspaceDealStages
      }
    ]
  });

  const [opportunitiesQuery, dealStagesQuery] = queries;
  const data =
    opportunitiesQuery.data && dealStagesQuery.data
      ? {
          opportunities: opportunitiesQuery.data,
          dealStages: dealStagesQuery.data
        }
      : undefined;

  return {
    data,
    error: queries.find((query) => query.error)?.error ?? null,
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    refetchAll: () => {
      for (const query of queries) {
        void query.refetch();
      }
    }
  };
}
