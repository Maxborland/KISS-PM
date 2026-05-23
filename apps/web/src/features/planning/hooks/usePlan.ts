"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { planningApi } from "../planningApi";
import { planKeys } from "./planKeys";
import { subscribeToPlanEvents } from "./subscribeToPlanEvents";

export function usePlan(projectId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !projectId) return;
    const subscription = subscribeToPlanEvents(projectId, (event) => {
      if (event.type === "planVersionChanged" || event.type === "planSnapshotInvalidated") {
        void queryClient.invalidateQueries({ queryKey: planKeys.project(projectId) });
      }
    });
    return () => subscription.unsubscribe();
  }, [enabled, projectId, queryClient]);

  return useQuery({
    queryKey: planKeys.project(projectId),
    queryFn: () => planningApi.getPlanReadModel(projectId),
    enabled: enabled && projectId.length > 0,
    placeholderData: keepPreviousData
  });
}
