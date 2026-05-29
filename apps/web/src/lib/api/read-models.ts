"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { Client, DealStage, Opportunity, Project, ProjectType } from "@/lib/api-types";
import { queryKeys } from "@/lib/api/query-keys";

type ListResponse<Key extends string, Item> = Record<Key, Item[]>;

export type ProjectsListReadModel = {
  projects: Project[];
};

export type DealsBoardReadModel = {
  opportunities: Opportunity[];
  dealStages: DealStage[];
  clients: Client[];
  projectTypes: ProjectType[];
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

export async function fetchWorkspaceClients(): Promise<Client[]> {
  const response = await apiFetch<ListResponse<"clients", Client>>("/api/workspace/clients", {
    method: "GET"
  });
  return response.clients;
}

export async function fetchWorkspaceProjectTypes(): Promise<ProjectType[]> {
  const response = await apiFetch<ListResponse<"projectTypes", ProjectType>>(
    "/api/workspace/project-types",
    { method: "GET" }
  );
  return response.projectTypes;
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
      },
      {
        queryKey: queryKeys.workspace.clients,
        queryFn: fetchWorkspaceClients
      },
      {
        queryKey: queryKeys.workspace.projectTypes,
        queryFn: fetchWorkspaceProjectTypes
      }
    ]
  });

  const [opportunitiesQuery, dealStagesQuery, clientsQuery, projectTypesQuery] = queries;
  const data =
    opportunitiesQuery.data && dealStagesQuery.data && clientsQuery.data && projectTypesQuery.data
      ? {
          opportunities: opportunitiesQuery.data,
          dealStages: dealStagesQuery.data,
          clients: clientsQuery.data,
          projectTypes: projectTypesQuery.data
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
