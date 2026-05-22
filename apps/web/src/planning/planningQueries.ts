import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyPlanningCommand,
  applyPlanningScenarioProposal,
  fetchPlanningReadModel,
  previewPlanningCommand,
  previewPlanningScenarioProposals,
  type PlanningCommandEnvelope,
  type PlanningScenarioApplyEnvelope,
  type PlanningScenarioPreviewEnvelope
} from "./planningApi";

export const planningQueryKeys = {
  readModel: (projectId: string | null) =>
    ["workspace", "projects", projectId ?? "unknown", "planning", "readModel"] as const
};

export function usePlanningReadModelQuery(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: planningQueryKeys.readModel(projectId),
    queryFn: () => fetchPlanningReadModel(projectId ?? ""),
    enabled: enabled && Boolean(projectId)
  });
}

export function usePlanningCommandMutations(projectId: string) {
  const queryClient = useQueryClient();

  return {
    previewCommand: useMutation({
      mutationFn: (envelope: PlanningCommandEnvelope) =>
        previewPlanningCommand(projectId, envelope)
    }),
    applyCommand: useMutation({
      mutationFn: (envelope: PlanningCommandEnvelope) =>
        applyPlanningCommand(projectId, envelope),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: planningQueryKeys.readModel(projectId)
        });
      }
    })
  };
}

export function usePlanningScenarioMutations(projectId: string) {
  const queryClient = useQueryClient();

  return {
    previewScenarios: useMutation({
      mutationFn: (envelope: PlanningScenarioPreviewEnvelope) =>
        previewPlanningScenarioProposals(projectId, envelope)
    }),
    applyScenario: useMutation({
      mutationFn: (input: { proposalId: string; envelope: PlanningScenarioApplyEnvelope }) =>
        applyPlanningScenarioProposal(projectId, input.proposalId, input.envelope),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: planningQueryKeys.readModel(projectId)
        });
      }
    })
  };
}
