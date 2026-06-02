"use client";

import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import {
  confirmWorkspaceAgentProposal,
  postWorkspaceAgentMessage,
  updateWorkspaceProjectTaskStatus,
  useDashboardReadModelQueries,
  useDealsBoardReadModelQueries,
  useMyWorkReadModelQueries,
  useProjectsListReadModelQuery
} from "@/lib/api/read-models";
import {
  buildFunnelDeals,
  buildFunnelStagesFromDealStages
} from "@/lib/mock-data/scenario-presenters";
import { DealsBlock } from "@/views/blocks/deals-block";
import { RuntimeMyWorkBlock } from "@/views/blocks/my-work-block";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import type { ScreenId } from "@/views/catalog";
import { canOpenScreenRoute, getScreenRoute } from "@/views/screens/screen-route";
import { ScreenView } from "@/views/screens/screen-view";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import { RuntimeAgentScreen } from "@/shell/runtime-agent-screen";
import { RuntimeDashboardScreen } from "@/shell/runtime-dashboard-screen";

export function canOpenStaticRuntimeScreen(
  screenId: ScreenId,
  permissions: readonly string[]
): boolean {
  return canOpenScreenRoute(getScreenRoute(screenId), permissions);
}

export function RuntimeDataScreen({
  screenId,
  permissions = [],
  currentUserId,
  initialTaskId
}: {
  screenId: ScreenId;
  permissions?: readonly string[];
  currentUserId?: string | undefined;
  initialTaskId?: string | undefined;
}) {
  if (!canOpenStaticRuntimeScreen(screenId, permissions)) {
    return (
      <ForbiddenState
        level="L1"
        title="Нет доступа"
        description="Недостаточно прав для просмотра этого раздела рабочей области."
      />
    );
  }

  if (screenId === "01-dashboard") {
    if (!currentUserId) return <RuntimeMissingUserState />;
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeDashboardDataScreen currentUserId={currentUserId} />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "02-my-work") {
    if (!currentUserId) return <RuntimeMissingUserState />;
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeMyWorkScreen currentUserId={currentUserId} initialTaskId={initialTaskId} />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "20-agent-cockpit") {
    if (!currentUserId) return <RuntimeMissingUserState />;
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeAgentScreen currentUserId={currentUserId} />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "07-projects-list") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeProjectsListScreen />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "05-deals") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeDealsScreen />
      </RuntimeWorkspaceFrame>
    );
  }

  return <ScreenView id={screenId} permissions={permissions} />;
}

function RuntimeMissingUserState() {
  return (
    <ErrorState
      level="L1"
      title="Не удалось загрузить пользователя"
      description="Сессия активна, но API не вернул идентификатор пользователя для runtime read model."
    />
  );
}

function RuntimeWorkspaceFrame({
  screenId,
  permissions,
  children
}: {
  screenId: ScreenId;
  permissions: readonly string[];
  children: ReactNode;
}) {
  return (
    <WorkspaceChrome meta={getScreenRoute(screenId)} permissions={permissions}>
      {children}
    </WorkspaceChrome>
  );
}

function RuntimeDashboardDataScreen({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const readModel = useDashboardReadModelQueries({ assigneeUserId: currentUserId });
  const sendWorkspaceAgentMessage = useMutation({
    mutationFn: postWorkspaceAgentMessage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.workspaceAgentThread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
      readModel.refetchAll();
    }
  });
  const confirmWorkspaceAgentAction = useMutation({
    mutationFn: confirmWorkspaceAgentProposal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.workspaceAgentThread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
      readModel.refetchAll();
    }
  });

  if (readModel.isPending || readModel.isFetching) {
    return <LoadingState layout="bento" level="L1" label="Загружаем дашборд…" />;
  }

  if (readModel.error) {
    return (
      <RuntimeReadModelError
        error={readModel.error}
        title="Не удалось загрузить дашборд"
        forbiddenTitle="Нет доступа к дашборду"
        onRetry={readModel.refetchAll}
      />
    );
  }

  return readModel.data ? (
    <RuntimeDashboardScreen
      data={readModel.data}
      currentUserId={currentUserId}
      isSendingWorkspaceAgentMessage={sendWorkspaceAgentMessage.isPending}
      workspaceAgentMessageError={sendWorkspaceAgentMessage.error}
      onSendWorkspaceAgentMessage={(body) => sendWorkspaceAgentMessage.mutateAsync(body)}
      isConfirmingWorkspaceAgentAction={confirmWorkspaceAgentAction.isPending}
      workspaceAgentActionError={confirmWorkspaceAgentAction.error}
      onConfirmWorkspaceAgentAction={(proposalId, decision) =>
        confirmWorkspaceAgentAction.mutateAsync({ proposalId, decision })
      }
    />
  ) : null;
}

function RuntimeMyWorkScreen({
  currentUserId,
  initialTaskId
}: {
  currentUserId: string;
  initialTaskId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const readModel = useMyWorkReadModelQueries({ assigneeUserId: currentUserId });
  const updateTaskStatus = useMutation({
    mutationFn: updateWorkspaceProjectTaskStatus,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.myWork(currentUserId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.workspaceAgentThread });
      readModel.refetchAll();
    }
  });

  if (readModel.isPending || readModel.isFetching) {
    return <LoadingState layout="bento" level="L1" label="Загружаем мою работу…" />;
  }

  if (readModel.error) {
    return (
      <RuntimeReadModelError
        error={readModel.error}
        title="Не удалось загрузить задачи"
        forbiddenTitle="Нет доступа к разделу «Моя работа»"
        onRetry={readModel.refetchAll}
      />
    );
  }

  return readModel.data ? (
    <RuntimeMyWorkBlock
      tasks={readModel.data.tasks}
      scheduledTasks={readModel.data.scheduledTasks}
      taskStatuses={readModel.data.taskStatuses}
      initialOpenTaskId={initialTaskId}
      readOnly
      isMovingTaskStatus={updateTaskStatus.isPending}
      onMoveTaskStatus={(input) => updateTaskStatus.mutateAsync(input)}
    />
  ) : null;
}

function RuntimeProjectsListScreen() {
  const query = useProjectsListReadModelQuery();

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем проекты…" />;
  }

  if (query.error) {
    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить проекты"
        forbiddenTitle="Нет доступа к проектам"
        onRetry={query.refetchAll}
      />
    );
  }

  return query.data ? (
    <ProjectsListBlock
      projects={query.data.projects}
      projectTemplates={query.data.projectTemplates}
      readOnly
    />
  ) : null;
}

function RuntimeDealsScreen() {
  const readModel = useDealsBoardReadModelQueries();

  if (readModel.isPending || readModel.isFetching) {
    return <LoadingState layout="bento" level="L1" label="Загружаем воронку сделок…" />;
  }

  if (readModel.error) {
    return (
      <RuntimeReadModelError
        error={readModel.error}
        title="Не удалось загрузить сделки"
        forbiddenTitle="Нет доступа к сделкам"
        onRetry={readModel.refetchAll}
      />
    );
  }

  const stages = readModel.data ? buildFunnelStagesFromDealStages(readModel.data.dealStages) : [];
  const deals = readModel.data ? buildFunnelDeals(readModel.data.opportunities) : [];

  return <DealsBlock initialDeals={deals} stages={stages} readOnly />;
}

function RuntimeReadModelError({
  error,
  title,
  forbiddenTitle,
  onRetry
}: {
  error: unknown;
  title: string;
  forbiddenTitle: string;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.code === "forbidden") {
    return (
      <ForbiddenState
        level="L1"
        title={forbiddenTitle}
        description="Недостаточно прав для просмотра данных рабочей области."
      />
    );
  }

  return (
    <ErrorState
      level="L1"
      title={title}
      description="Повторите попытку или проверьте доступность API."
      onRetry={onRetry}
    />
  );
}
