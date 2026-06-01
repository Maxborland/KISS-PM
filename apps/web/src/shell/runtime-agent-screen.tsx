"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import {
  confirmWorkspaceAgentProposal,
  postWorkspaceAgentMessage,
  useAgentCockpitReadModelQuery
} from "@/lib/api/read-models";
import { AgentCockpitBlock } from "@/views/blocks/agent-cockpit-block";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function RuntimeAgentScreen({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const readModel = useAgentCockpitReadModelQuery();
  const sendWorkspaceAgentMessage = useMutation({
    mutationFn: postWorkspaceAgentMessage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.workspaceAgentThread });
    }
  });
  const confirmWorkspaceAgentAction = useMutation({
    mutationFn: confirmWorkspaceAgentProposal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.workspaceAgentThread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.myWork(currentUserId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
    }
  });

  if (readModel.isPending || readModel.isFetching) {
    return <LoadingState layout="bento" level="L1" label="Загружаем управленческий агент…" />;
  }

  if (readModel.error) {
    if (readModel.error instanceof ApiError && readModel.error.code === "forbidden") {
      return (
        <ForbiddenState
          level="L1"
          title="Нет доступа к агенту"
          description="Агент рабочей области видит только доступный пользователю управленческий контекст."
        />
      );
    }

    return (
      <ErrorState
        level="L1"
        title="Не удалось загрузить агент"
        description="Повторите попытку или проверьте доступность API."
        onRetry={() => void readModel.refetch()}
      />
    );
  }

  return readModel.data ? (
    <div className="agent-cockpit-screen">
      <RoutePageIntro lead="Единый управленческий cockpit рабочей области: вопросы по портфелю, сверка предложений и подтверждение действий через аудит." />
      <AgentCockpitBlock
        variant="surface"
        thread={readModel.data.workspaceAgentThread}
        currentUserId={currentUserId}
        isSending={sendWorkspaceAgentMessage.isPending}
        isConfirming={confirmWorkspaceAgentAction.isPending}
        messageError={sendWorkspaceAgentMessage.error}
        actionError={confirmWorkspaceAgentAction.error}
        onSendMessage={(body) => sendWorkspaceAgentMessage.mutateAsync(body)}
        onConfirmProposal={(proposalId, decision) =>
          confirmWorkspaceAgentAction.mutateAsync({ proposalId, decision })
        }
      />
    </div>
  ) : null;
}
