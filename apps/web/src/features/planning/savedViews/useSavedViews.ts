"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export type SavedViewScope = "user" | "project";

export type SavedViewPayload = {
  visibleColumnIds?: string[];
  filters?: Record<string, unknown>;
};

export type SavedView = {
  id: string;
  projectId: string;
  ownerUserId: string;
  scope: SavedViewScope;
  name: string;
  payload: SavedViewPayload;
  createdAt: string;
};

const savedViewsKey = (projectId: string) => ["planning-saved-views", projectId] as const;

export function useSavedViews(projectId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: savedViewsKey(projectId),
    queryFn: () => fetchSavedViews(projectId),
    enabled
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      id: string;
      scope: SavedViewScope;
      name: string;
      payload: SavedViewPayload;
    }) => createSavedView(projectId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedViewsKey(projectId) })
  });

  const deleteMutation = useMutation({
    mutationFn: (viewId: string) => deleteSavedView(projectId, viewId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedViewsKey(projectId) })
  });

  return {
    views: query.data?.views ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createSavedView: createMutation.mutateAsync,
    deleteSavedView: deleteMutation.mutateAsync,
    isMutating: createMutation.isPending || deleteMutation.isPending
  };
}

async function fetchSavedViews(projectId: string): Promise<{ views: SavedView[] }> {
  const response = await fetch(
    `${apiOrigin}/api/workspace/projects/${encodeURIComponent(projectId)}/planning/saved-views`,
    { credentials: "same-origin" }
  );
  if (!response.ok) {
    if (response.status === 404 || response.status === 501) {
      return { views: [] };
    }
    throw new Error(`saved_views_load_failed_${response.status}`);
  }
  const body = (await response.json()) as { savedViews?: SavedView[]; views?: SavedView[] };
  return { views: body.savedViews ?? body.views ?? [] };
}

async function createSavedView(
  projectId: string,
  input: {
    id: string;
    scope: SavedViewScope;
    name: string;
    payload: SavedViewPayload;
  }
): Promise<SavedView | null> {
  const response = await fetch(
    `${apiOrigin}/api/workspace/projects/${encodeURIComponent(projectId)}/planning/saved-views`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify(input)
    }
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `saved_view_create_failed_${response.status}`);
  }
  const body = (await response.json()) as { savedView?: SavedView; view?: SavedView };
  return body.savedView ?? body.view ?? null;
}

async function deleteSavedView(projectId: string, viewId: string): Promise<void> {
  const response = await fetch(
    `${apiOrigin}/api/workspace/projects/${encodeURIComponent(projectId)}/planning/saved-views/${encodeURIComponent(viewId)}`,
    {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "x-kiss-pm-action": "same-origin" }
    }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`saved_view_delete_failed_${response.status}`);
  }
}
