"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { invalidateWorkspaceCapacityQueries } from "../capacity/invalidateWorkspaceCapacityQueries";
import { planningApi } from "../planningApi";
import { planKeys } from "./planKeys";
import { subscribeToPlanEvents } from "./subscribeToPlanEvents";

export function usePlan(
  projectId: string,
  enabled: boolean,
  options?: { onRemotePlanChange?: () => void }
) {
  const queryClient = useQueryClient();
  const onRemotePlanChange = options?.onRemotePlanChange;

  useEffect(() => {
    if (!enabled || !projectId) return;
    const subscription = subscribeToPlanEvents(projectId, (event) => {
      if (event.type === "planVersionChanged" || event.type === "planSnapshotInvalidated") {
        onRemotePlanChange?.();
        void queryClient.invalidateQueries({ queryKey: planKeys.project(projectId) });
        invalidateWorkspaceCapacityQueries(queryClient);
      }
    });
    return () => subscription.unsubscribe();
  }, [enabled, onRemotePlanChange, projectId, queryClient]);

  return useQuery({
    queryKey: planKeys.project(projectId),
    queryFn: () => planningApi.getPlanReadModel(projectId),
    enabled: enabled && projectId.length > 0,
    placeholderData: keepPreviousData
  });
}
