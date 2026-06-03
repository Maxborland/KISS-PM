"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import {
  confirmWorkspaceAgentProposal,
  createWorkspaceProjectTask,
  postWorkspaceAgentMessage,
  postWorkspaceTaskComment,
  updateWorkspaceTaskFields,
  updateWorkspaceProjectTaskStatus,
  useAdminUsersReadModelQuery,
  useAuditEventsReadModelQuery,
  useClientsReadModelQuery,
  useDashboardReadModelQueries,
  useDealsBoardReadModelQueries,
  useMyWorkReadModelQueries,
  useProjectDetailReadModelQuery,
  useProjectsListReadModelQuery,
  useTaskActivityReadModelQuery
} from "@/lib/api/read-models";
import {
  buildFunnelDeals,
  buildFunnelStagesFromDealStages
} from "@/lib/mock-data/scenario-presenters";
import { buildProjectTimelineGanttData } from "@/lib/runtime/project-timeline";
import { buildProjectResourceMatrixData } from "@/lib/runtime/project-resources";
import { DealsBlock } from "@/views/blocks/deals-block";
import { RuntimeMyWorkBlock } from "@/views/blocks/my-work-block";
import {
  ProjectDetailBlock,
  type ProjectTaskCommentInput,
  type ProjectTaskCreateInput
} from "@/views/blocks/project-detail-block";
import { ProjectTimelineBlock } from "@/views/blocks/project-timeline-block";
import { ProjectResourcesRuntimeBlock } from "@/views/blocks/project-resources-runtime-block";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import type { ScreenId } from "@/views/catalog";
import {
  canOpenScreenRoute,
  getScreenRoute,
  isCurrentBetaRuntimeScreen
} from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import { RuntimeAgentScreen } from "@/shell/runtime-agent-screen";
import { RuntimeDashboardScreen } from "@/shell/runtime-dashboard-screen";
import { AuditEventsRuntimeBlock } from "@/views/blocks/audit-events-runtime-block";
import { AdminUsersRuntimeBlock } from "@/views/blocks/admin-users-runtime-block";
import { ClientsRuntimeBlock } from "@/views/blocks/clients-runtime-block";

export function canOpenStaticRuntimeScreen(
  screenId: ScreenId,
  permissions: readonly string[]
): boolean {
  return canOpenScreenRoute(getScreenRoute(screenId), permissions);
}

export function RuntimeDataScreen({
  screenId,
  permissions = [],
  projectId,
  currentUserId,
  initialTaskId
}: {
  screenId: ScreenId;
  permissions?: readonly string[];
  projectId?: string | undefined;
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

  if (!isCurrentBetaRuntimeScreen(screenId)) {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeDisabledBetaRouteState />
      </RuntimeWorkspaceFrame>
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

  if (screenId === "07b-project-detail") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeProjectDetailScreen projectId={projectId} currentUserId={currentUserId} />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "12-project-gantt") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeProjectTimelineScreen projectId={projectId} />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "13-project-resources") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeProjectResourcesScreen projectId={projectId} />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "17-project-audit") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeAuditEventsScreen />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "09-admin") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeAdminUsersScreen />
      </RuntimeWorkspaceFrame>
    );
  }

  if (screenId === "08-entities-clients") {
    return (
      <RuntimeWorkspaceFrame screenId={screenId} permissions={permissions}>
        <RuntimeClientsScreen />
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

  return <RuntimeDisabledBetaRouteState />;
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

function RuntimeDisabledBetaRouteState() {
  return (
    <ErrorState
      level="L1"
      title="Раздел не включён в beta"
      description="Этот экран скрыт из runtime-навигации, пока не подключён к реальным данным и проверкам beta gate."
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
  const readModel = useMyWorkReadModelQueries({ assigneeUserId: currentUserId });

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
      initialOpenTaskId={initialTaskId}
      readOnly
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
      getProjectHref={(project) => `/projects/${encodeURIComponent(project.id)}`}
      readOnly
    />
  ) : null;
}

function RuntimeProjectDetailScreen({
  projectId,
  currentUserId
}: {
  projectId?: string | undefined;
  currentUserId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const query = useProjectDetailReadModelQuery(projectId);
  const [activityTaskId, setActivityTaskId] = useState<string | undefined>(undefined);
  const projectTasks = query.data?.tasks.filter((task) => task.archivedAt == null) ?? [];
  const projectTaskIds = projectTasks.map((task) => task.id).join("|");
  const defaultActivityTaskId = projectTasks[0]?.id;
  const resolvedActivityTaskId = activityTaskId ?? defaultActivityTaskId;
  const taskActivity = useTaskActivityReadModelQuery(resolvedActivityTaskId);

  useEffect(() => {
    if (!defaultActivityTaskId) {
      if (activityTaskId) setActivityTaskId(undefined);
      return;
    }
    if (!activityTaskId || !projectTaskIds.split("|").includes(activityTaskId)) {
      setActivityTaskId(defaultActivityTaskId);
    }
  }, [activityTaskId, defaultActivityTaskId, projectTaskIds]);

  const createTask = useMutation({
    mutationFn: createWorkspaceProjectTask,
    onSuccess: (_task, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.project(input.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
      if (currentUserId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.myWork(currentUserId) });
      }
    }
  });
  const postTaskComment = useMutation({
    mutationFn: postWorkspaceTaskComment,
    onSuccess: (_activity, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.taskActivity(input.taskId) });
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.project(projectId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
    }
  });
  const updateTaskStatus = useMutation({
    mutationFn: updateWorkspaceProjectTaskStatus,
    onSuccess: (_task, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.project(input.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
      if (currentUserId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.myWork(currentUserId) });
      }
    }
  });
  const updateTaskFields = useMutation({
    mutationFn: updateWorkspaceTaskFields,
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.project(task.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.operationsCockpit });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
      if (currentUserId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.myWork(currentUserId) });
      }
    }
  });

  if (!projectId) {
    return (
      <ErrorState
        level="L1"
        title="Проект не выбран"
        description="Откройте проект из списка или проверьте адрес страницы."
      />
    );
  }

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем проект…" />;
  }

  if (query.error) {
    if (
      query.error instanceof ApiError &&
      query.error.body.error === "project_not_found"
    ) {
      return (
        <ErrorState
          level="L1"
          title="Проект не найден"
          description="Проверьте ссылку или вернитесь к списку проектов."
          onRetry={() => void query.refetch()}
        />
      );
    }

    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить проект"
        forbiddenTitle="Нет доступа к проекту"
        onRetry={() => void query.refetch()}
      />
    );
  }

  const projectDetail = query.data;
  if (!projectDetail) return null;

  return (
    <ProjectDetailBlock
      activityTaskId={resolvedActivityTaskId}
      commentActionError={postTaskComment.error}
      commentActionPending={postTaskComment.isPending}
      createTaskError={createTask.error}
      createTaskPending={createTask.isPending}
      currentUserId={currentUserId}
      project={projectDetail.project}
      taskActivities={taskActivity.data?.activities ?? []}
      taskActivityError={taskActivity.error}
      taskActivityPending={taskActivity.isPending || taskActivity.isFetching}
      taskActionError={updateTaskStatus.error ?? updateTaskFields.error}
      taskActionPending={updateTaskStatus.isPending || updateTaskFields.isPending}
      taskStatuses={projectDetail.taskStatuses}
      tasks={projectDetail.tasks}
      workspaceUsers={projectDetail.workspaceUsers}
      onCreateTask={(input: ProjectTaskCreateInput) =>
        createTask.mutateAsync({
          ...input,
          projectId: projectDetail.project.id
        })
      }
      onAddTaskComment={(input: ProjectTaskCommentInput) => postTaskComment.mutateAsync(input)}
      onSelectActivityTask={setActivityTaskId}
      onChangeTaskStatus={(task, statusId) =>
        updateTaskStatus.mutateAsync({
          projectId: projectDetail.project.id,
          statusId,
          taskId: task.id
        })
      }
      onUpdateTaskFields={(task, fields) =>
        updateTaskFields.mutateAsync({
          ...fields,
          task
        })
      }
      readOnly
    />
  );
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

function RuntimeProjectTimelineScreen({ projectId }: { projectId?: string | undefined }) {
  const query = useProjectDetailReadModelQuery(projectId);

  if (!projectId) {
    return (
      <ErrorState
        level="L1"
        title="Проект не выбран"
        description="Откройте план-график из карточки проекта или проверьте адрес страницы."
      />
    );
  }

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем план-график проекта…" />;
  }

  if (query.error) {
    if (
      query.error instanceof ApiError &&
      query.error.body.error === "project_not_found"
    ) {
      return (
        <ErrorState
          level="L1"
          title="Проект не найден"
          description="Проверьте ссылку или вернитесь к списку проектов."
          onRetry={() => void query.refetch()}
        />
      );
    }

    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить план-график проекта"
        forbiddenTitle="Нет доступа к план-графику проекта"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!query.data) return null;

  return (
    <ProjectTimelineBlock
      project={query.data.project}
      data={buildProjectTimelineGanttData(query.data)}
    />
  );
}

function RuntimeProjectResourcesScreen({ projectId }: { projectId?: string | undefined }) {
  const query = useProjectDetailReadModelQuery(projectId);

  if (!projectId) {
    return (
      <ErrorState
        level="L1"
        title="Проект не выбран"
        description="Откройте ресурсы из карточки проекта или проверьте адрес страницы."
      />
    );
  }

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем ресурсы проекта…" />;
  }

  if (query.error) {
    if (
      query.error instanceof ApiError &&
      query.error.body.error === "project_not_found"
    ) {
      return (
        <ErrorState
          level="L1"
          title="Проект не найден"
          description="Проверьте ссылку или вернитесь к списку проектов."
          onRetry={() => void query.refetch()}
        />
      );
    }

    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить ресурсы проекта"
        forbiddenTitle="Нет доступа к ресурсам проекта"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!query.data) return null;

  return (
    <ProjectResourcesRuntimeBlock
      project={query.data.project}
      matrix={buildProjectResourceMatrixData(query.data)}
    />
  );
}

function RuntimeAuditEventsScreen() {
  const query = useAuditEventsReadModelQuery();

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем аудит действий…" />;
  }

  if (query.error) {
    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить аудит действий"
        forbiddenTitle="Нет доступа к аудиту"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return query.data ? <AuditEventsRuntimeBlock auditEvents={query.data.auditEvents} /> : null;
}

function RuntimeAdminUsersScreen() {
  const query = useAdminUsersReadModelQuery();

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем пользователей…" />;
  }

  if (query.error) {
    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить пользователей"
        forbiddenTitle="Нет доступа к пользователям"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return query.data ? <AdminUsersRuntimeBlock users={query.data.users} /> : null;
}

function RuntimeClientsScreen() {
  const query = useClientsReadModelQuery();

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем клиентов…" />;
  }

  if (query.error) {
    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить клиентов"
        forbiddenTitle="Нет доступа к клиентам"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return query.data ? <ClientsRuntimeBlock clients={query.data.clients} /> : null;
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
