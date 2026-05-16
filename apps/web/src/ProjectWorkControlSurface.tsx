import { useEffect, useMemo, useState } from "react";
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ApprovalRequestDto,
  KanbanProjectDto,
  ManagedProjectDto,
  MyTaskDto,
  Phase4ProjectWorkApiClient,
  ProjectStageStatus,
  StageGateBlockerDto,
  StageTemplateSnapshotDto,
  TaskDto,
  TaskParticipantRole,
  TaskStatus
} from "./phase4ProjectWorkApiClient";
import { projectDraftIdForSeedOpportunity } from "./phase4ProjectWorkApiClient";

type ProjectWorkControlSurfaceProps = {
  apiClient: Phase4ProjectWorkApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
  projectId?: string;
  seedOpportunityId?: string;
  defaultExecutorUserId?: string;
  onOpenGanttProject?: (projectId: string) => void;
};

type WorkQueuesState = {
  projectTasks: TaskDto[];
  myTasks: MyTaskDto[];
  controlledTasks: MyTaskDto[];
  kanban: KanbanProjectDto | null;
  taskAuditEvents: Awaited<ReturnType<Phase4ProjectWorkApiClient["listAuditEventsForTarget"]>>;
};

const defaultProjectId = "project-phase4-main";
const defaultTenantAOpportunityId = "opportunity-seed-ready";
const defaultTenantBOpportunityId = "opportunity-b-private";
const defaultTaskId = "task-phase4-kickoff";

const emptyWorkQueues: WorkQueuesState = {
  projectTasks: [],
  myTasks: [],
  controlledTasks: [],
  kanban: null,
  taskAuditEvents: []
};

const projectWorkQueryKeys = {
  project: (testUser: string, projectId: string) => ["project-work", testUser, "project", projectId] as const,
  workQueuesBase: (testUser: string, projectId: string) =>
    ["project-work", testUser, "project", projectId, "work-queues"] as const,
  workQueues: (testUser: string, projectId: string, auditTargetTaskId: string | null, canReadAudit: boolean) =>
    [...projectWorkQueryKeys.workQueuesBase(testUser, projectId), { auditTargetTaskId, canReadAudit }] as const
};

function getDefaultSeedOpportunityId(tenantId: string): string {
  return tenantId === "tenant-b" ? defaultTenantBOpportunityId : defaultTenantAOpportunityId;
}

function getDefaultExecutorUserId(tenantId: string, actorId: string): string {
  if (tenantId === "tenant-a" && actorId !== "executor-a") {
    return "executor-a";
  }

  return actorId;
}

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  blocked: "Заблокировано",
  done: "Готово",
  cancelled: "Отменено"
};

const stageStatusLabels: Record<ProjectStageStatus, string> = {
  pending: "Ожидает",
  active: "Активна",
  completed: "Завершена",
  cancelled: "Отменена"
};

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

function getGateBlockers(error: unknown): StageGateBlockerDto[] {
  if (
    typeof error === "object" &&
    error !== null &&
    "transitionError" in error &&
    typeof error.transitionError === "object" &&
    error.transitionError !== null &&
    "blockers" in error.transitionError &&
    Array.isArray(error.transitionError.blockers)
  ) {
    return error.transitionError.blockers as StageGateBlockerDto[];
  }

  return [];
}

function getActiveStage(project: ManagedProjectDto | null) {
  return project?.stages.find((stage) => stage.id === project.currentStageId) ?? null;
}

function getStageTemplate(project: ManagedProjectDto | null, stageTemplateId: string | undefined): StageTemplateSnapshotDto | null {
  if (!project || !stageTemplateId) {
    return null;
  }

  return project.processTemplateSnapshot.stageTemplates.find((stageTemplate) => stageTemplate.id === stageTemplateId) ?? null;
}

function getTaskIdSet(tasks: TaskDto[]): Set<string> {
  return new Set(tasks.map((task) => task.id));
}

function roleLabels(roles: TaskParticipantRole[]): string {
  const labels: Record<TaskParticipantRole, string> = {
    executor: "исполнитель",
    co_executor: "соисполнитель",
    requester: "постановщик",
    controller: "контролер",
    approver: "согласующий",
    observer: "наблюдатель"
  };

  return roles.map((role) => labels[role]).join(", ");
}

function TaskList({ emptyLabel, tasks, testId }: { emptyLabel: string; tasks: TaskDto[] | MyTaskDto[]; testId: string }) {
  return (
    <div className="compact-list" data-testid={testId}>
      {tasks.length > 0
        ? tasks.map((task) => (
            <span key={task.id}>
              {task.id}: {task.title} / {taskStatusLabels[task.status]}
              {"relationRoles" in task ? ` / ${roleLabels(task.relationRoles)}` : ""}
            </span>
          ))
        : emptyLabel}
    </div>
  );
}

export function ProjectWorkControlSurface({
  apiClient,
  currentTenant,
  testUser,
  projectId = defaultProjectId,
  seedOpportunityId,
  defaultExecutorUserId,
  onOpenGanttProject
}: ProjectWorkControlSurfaceProps) {
  const queryClient = useQueryClient();
  const [auditTargetTaskId, setAuditTargetTaskId] = useState<string | null>(null);
  const [gateBlockers, setGateBlockers] = useState<StageGateBlockerDto[]>([]);
  const [status, setStatus] = useState("Готово к управлению проектом");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const canCreateProject = hasPermission(currentTenant, "project.create_from_template");
  const canTransitionStage = hasPermission(currentTenant, "project.lifecycle.transition");
  const canWriteArtifacts = hasPermission(currentTenant, "project.artifact.write");
  const canWriteApprovals = hasPermission(currentTenant, "project.approval.write");
  const canWriteTasks = hasPermission(currentTenant, "task.write");
  const canWriteTaskStatus = hasPermission(currentTenant, "task.status.write");
  const canWriteTaskComments = hasPermission(currentTenant, "task.comment.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const activeSeedOpportunityId = seedOpportunityId ?? getDefaultSeedOpportunityId(currentTenant.tenant.id);
  const taskExecutorUserId =
    defaultExecutorUserId ?? getDefaultExecutorUserId(currentTenant.tenant.id, currentTenant.actor.id);
  const projectQueryKey = projectWorkQueryKeys.project(testUser, projectId);
  const projectQuery = useQuery<ManagedProjectDto | null>({
    queryKey: projectQueryKey,
    queryFn: async () => {
      try {
        return await apiClient.getProject(testUser, projectId);
      } catch (error) {
        if (getErrorMessage(error) === "Объект не найден") {
          return null;
        }

        throw error;
      }
    },
    retry: false
  });
  const project = projectQuery.data ?? null;
  const workQueuesQuery = useQuery<WorkQueuesState>({
    queryKey: projectWorkQueryKeys.workQueues(testUser, project?.id ?? projectId, auditTargetTaskId, canReadAudit),
    queryFn: async () => {
      if (!project) {
        return emptyWorkQueues;
      }

      const [tasks, executorTasks, controllerTasks, nextKanban] = await Promise.all([
        apiClient.listProjectTasks(testUser, project.id),
        apiClient.listMyTasks(testUser, ["executor", "co_executor"]),
        apiClient.listMyTasks(testUser, ["controller", "requester", "approver", "observer"]),
        apiClient.getKanbanProject(testUser, project.id)
      ]);

      const projectedTasks = [
        ...tasks,
        ...executorTasks,
        ...controllerTasks,
        ...nextKanban.columns.flatMap((column) => column.tasks)
      ];
      const auditTask = projectedTasks.find((task) => task.id === auditTargetTaskId) ?? projectedTasks[0];
      let taskAuditEvents: WorkQueuesState["taskAuditEvents"] = [];
      if (auditTask && canReadAudit) {
        try {
          taskAuditEvents = await apiClient.listAuditEventsForTarget(testUser, "task", auditTask.id);
        } catch {
          taskAuditEvents = [];
        }
      }

      return {
        projectTasks: tasks,
        myTasks: executorTasks,
        controlledTasks: controllerTasks,
        kanban: nextKanban,
        taskAuditEvents
      };
    },
    enabled: project !== null
  });
  const workQueues = workQueuesQuery.data ?? emptyWorkQueues;
  const { projectTasks, myTasks, controlledTasks, kanban, taskAuditEvents } = workQueues;
  const activeStage = getActiveStage(project);
  const activeStageTemplate = getStageTemplate(project, activeStage?.templateId);
  const firstRequiredArtifact = activeStageTemplate?.requiredArtifactTemplates[0];
  const firstRequiredApproval = activeStageTemplate?.approvalTemplates[0];
  const firstTaskTemplate = activeStageTemplate?.taskTemplates[0];
  const projectTaskIds = useMemo(() => getTaskIdSet(projectTasks), [projectTasks]);

  async function invalidateActiveQuery(queryKey: QueryKey) {
    await queryClient.invalidateQueries({ queryKey }, { throwOnError: true });
  }

  async function updateProjectCache(nextProject: ManagedProjectDto, nextAuditTargetTaskId: string | null = auditTargetTaskId) {
    queryClient.setQueryData(projectQueryKey, nextProject);
    setAuditTargetTaskId(nextAuditTargetTaskId);
    await invalidateActiveQuery(projectWorkQueryKeys.workQueuesBase(testUser, nextProject.id));
  }

  useEffect(() => {
    if (projectQuery.isFetching && projectQuery.data === undefined) {
      setStatus("Загрузка проекта");
      return;
    }
    if (projectQuery.isError) {
      setStatus(getErrorMessage(projectQuery.error));
      return;
    }
    if (projectQuery.isSuccess) {
      setStatus((current) => {
        if (!projectQuery.data) {
          return current === "Готово к управлению проектом" || current === "Загрузка проекта" ? "Проект еще не создан" : current;
        }

        return current === "Готово к управлению проектом" || current === "Загрузка проекта" ? "Проект загружен из API" : current;
      });
    }
  }, [projectQuery.data, projectQuery.error, projectQuery.isError, projectQuery.isFetching, projectQuery.isSuccess]);

  const createManagedProjectMutation = useMutation({
    mutationFn: async () => {
      const projectDraftId = canCreateProject
        ? (await apiClient.ensureProjectDraft(testUser, activeSeedOpportunityId)).id
        : projectDraftIdForSeedOpportunity(activeSeedOpportunityId);

      return apiClient.createProjectFromTemplate(testUser, {
        projectDraftId,
        projectId
      });
    },
    onSuccess: async (nextProject) => {
      await updateProjectCache(nextProject, null);
    }
  });
  const transitionStageMutation = useMutation({
    mutationFn: ({ nextProject, stageId }: { nextProject: ManagedProjectDto; stageId: string }) =>
      apiClient.transitionProjectStage(testUser, nextProject.id, stageId, "advance_stage"),
    onSuccess: async (nextProject) => {
      await updateProjectCache(nextProject);
    }
  });
  const recordArtifactMutation = useMutation({
    mutationFn: ({ nextProject, stageId }: { nextProject: ManagedProjectDto; stageId: string }) => {
      if (!firstRequiredArtifact) {
        throw new Error("Артефакт стадии не найден");
      }

      return apiClient.recordArtifact(testUser, nextProject.id, stageId, {
        id: "artifact-phase4-charter",
        templateId: firstRequiredArtifact.id,
        templateKey: firstRequiredArtifact.key,
        status: "accepted",
        evidenceRef: "artifact://phase4/charter"
      });
    },
    onSuccess: async (nextProject) => {
      queryClient.setQueryData(projectQueryKey, nextProject);
      await invalidateActiveQuery(projectWorkQueryKeys.workQueuesBase(testUser, nextProject.id));
    }
  });
  const recordApprovalMutation = useMutation({
    mutationFn: ({ nextProject, stageId }: { nextProject: ManagedProjectDto; stageId: string }) => {
      if (!firstRequiredApproval) {
        throw new Error("Согласование стадии не найдено");
      }

      return apiClient.recordApproval(testUser, nextProject.id, stageId, {
        id: "approval-phase4-charter",
        templateId: firstRequiredApproval.id,
        templateKey: firstRequiredApproval.key,
        decision: "approved"
      });
    },
    onSuccess: async (nextProject) => {
      queryClient.setQueryData(projectQueryKey, nextProject);
      await invalidateActiveQuery(projectWorkQueryKeys.workQueuesBase(testUser, nextProject.id));
    }
  });

  async function createManagedProject() {
    if (pendingAction !== null) return;
    setPendingAction("project");
    setStatus("Создание управляемого проекта");
    setGateBlockers([]);
    try {
      await createManagedProjectMutation.mutateAsync();
      setStatus("Управляемый проект создан");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function advanceStage() {
    if (!project || !activeStage || pendingAction !== null) return;
    setPendingAction("transition");
    setStatus("Проверка stage gate");
    setGateBlockers([]);
    try {
      await transitionStageMutation.mutateAsync({ nextProject: project, stageId: activeStage.id });
      setStatus("Стадия переведена");
    } catch (error) {
      const blockers = getGateBlockers(error);
      setGateBlockers(blockers);
      setStatus(blockers.length > 0 ? "Есть блокеры перехода" : getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function recordArtifact() {
    if (!project || !activeStage || !firstRequiredArtifact || pendingAction !== null) return;
    setPendingAction("artifact");
    setStatus("Фиксация артефакта");
    try {
      await recordArtifactMutation.mutateAsync({ nextProject: project, stageId: activeStage.id });
      setGateBlockers([]);
      setStatus("Артефакт принят");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function recordApproval() {
    if (!project || !activeStage || !firstRequiredApproval || pendingAction !== null) return;
    setPendingAction("approval");
    setStatus("Фиксация согласования");
    try {
      await recordApprovalMutation.mutateAsync({ nextProject: project, stageId: activeStage.id });
      setGateBlockers([]);
      setStatus("Согласование принято");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function createTask() {
    if (!project || !activeStage || !firstTaskTemplate || pendingAction !== null || projectTaskIds.has(defaultTaskId)) return;
    setPendingAction("task");
    setStatus("Создание задачи");
    try {
      const result = await apiClient.createProjectTask(testUser, project.id, {
        id: defaultTaskId,
        stageId: activeStage.id,
        taskTemplateId: firstTaskTemplate.id,
        taskTemplateKey: firstTaskTemplate.key,
        dueDate: "2026-06-05",
        plannedWorkHours: 12,
        participants: [
          { id: "participant-kickoff-executor", userId: taskExecutorUserId, role: "executor" },
          { id: "participant-kickoff-controller", userId: testUser, role: "controller" }
        ]
      });
      await updateProjectCache(result.project, result.task.id);
      setStatus("Задача создана");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function moveTask(task: TaskDto, toStatus: TaskStatus) {
    if (!project || pendingAction !== null) return;
    setPendingAction(`task-status-${task.id}`);
    setStatus("Изменение статуса задачи");
    try {
      await apiClient.changeTaskStatus(testUser, task.id, toStatus);
      const nextProject = await apiClient.getProject(testUser, project.id);
      await updateProjectCache(nextProject, task.id);
      setStatus("Статус задачи изменен");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function addTaskComment(task: TaskDto) {
    if (pendingAction !== null) return;
    setPendingAction(`task-comment-${task.id}`);
    setStatus("Добавление комментария");
    try {
      const comment = await apiClient.addTaskComment(testUser, task.id, "Начал работу");
      if (!comment) {
        throw new Error("Комментарий не подтвержден API");
      }
      if (project) {
        const nextProject = await apiClient.getProject(testUser, project.id);
        await updateProjectCache(nextProject, task.id);
      }
      setStatus("Комментарий добавлен");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  const artifacts = project?.artifacts ?? [];
  const approvals: ApprovalRequestDto[] = project?.approvalRequests ?? [];

  return (
    <section className="project-work-surface" data-testid="project-work-surface">
      <div className="surface-heading">
        <div>
          <h2>Проектное управление</h2>
          <p>Один путь: стадия, обязательные проверки, задачи, рабочие очереди и Kanban по тем же task id.</p>
        </div>
        <p className="status-pill" data-testid="project-work-status">
          {status}
        </p>
      </div>

      <div className="project-work-layout">
        <section className="phase2-panel project-lifecycle-panel">
          <h3>Жизненный цикл проекта</h3>
          {projectQuery.isFetching && projectQuery.data === undefined ? (
            <p>Загрузка проекта</p>
          ) : project ? (
            <>
              <p className="selected-title" data-testid="managed-project-title">
                {project.title}
              </p>
              <div className="stage-progress" data-testid="stage-progress">
                {project.stages.map((stage) => (
                  <span className={`stage-step ${stage.status}`} key={stage.id}>
                    {stage.label}: {stageStatusLabels[stage.status]}
                  </span>
                ))}
              </div>
              {canTransitionStage ? (
                <div className="button-row">
                  <button disabled={!activeStage || pendingAction !== null} type="button" onClick={() => void advanceStage()}>
                    Перейти к следующей стадии
                  </button>
                  {onOpenGanttProject ? (
                    <button type="button" onClick={() => onOpenGanttProject(project.id)}>
                      Открыть Гантт проекта
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <p className="readonly-notice">Переход стадии недоступен по правам.</p>
                  {onOpenGanttProject ? (
                    <button type="button" onClick={() => onOpenGanttProject(project.id)}>
                      Открыть Гантт проекта
                    </button>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              <p>Проект будет создан из готового черновика Phase 3 и активного шаблона процесса.</p>
              <button disabled={pendingAction !== null} type="button" onClick={() => void createManagedProject()}>
                {canCreateProject ? "Создать управляемый проект" : "Проверить запрет создания проекта"}
              </button>
            </>
          )}
        </section>

        <section className="phase2-panel">
          <h3>Stage gate</h3>
          <div className="compact-list" data-testid="stage-gate-blockers">
            {gateBlockers.length > 0
              ? gateBlockers.map((blocker) => (
                  <span key={`${blocker.code}-${blocker.templateId ?? blocker.stageId}`}>
                    {blocker.code}: {blocker.message}
                  </span>
                ))
              : "Блокеры не обнаружены"}
          </div>
          <div className="button-row">
            {canWriteArtifacts && firstRequiredArtifact ? (
              <button disabled={pendingAction !== null} type="button" onClick={() => void recordArtifact()}>
                Принять паспорт проекта
              </button>
            ) : null}
            {canWriteApprovals && firstRequiredApproval ? (
              <button disabled={pendingAction !== null} type="button" onClick={() => void recordApproval()}>
                Согласовать паспорт
              </button>
            ) : null}
          </div>
          <div className="compact-list" data-testid="artifact-evidence">
            {artifacts.length > 0
              ? artifacts.map((artifact) => (
                  <span key={artifact.id}>
                    {artifact.id}: {artifact.status}
                  </span>
                ))
              : "Артефактов пока нет"}
          </div>
          <div className="compact-list" data-testid="approval-evidence">
            {approvals.length > 0
              ? approvals.map((approval) => (
                  <span key={approval.id}>
                    {approval.id}: {approval.status}
                  </span>
                ))
              : "Согласований пока нет"}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Задачи проекта</h3>
          {canWriteTasks && project && firstTaskTemplate && !projectTaskIds.has(defaultTaskId) ? (
            <button disabled={pendingAction !== null} type="button" onClick={() => void createTask()}>
              Создать стартовую задачу
            </button>
          ) : null}
          <TaskList emptyLabel="Задач пока нет" tasks={projectTasks} testId="project-task-list" />
        </section>

        <section className="phase2-panel">
          <h3>Мои задачи исполнителя</h3>
          <TaskList emptyLabel="У исполнителя пока нет задач" tasks={myTasks} testId="my-tasks-list" />
        </section>

        <section className="phase2-panel">
          <h3>Контролируемые задачи</h3>
          <TaskList emptyLabel="Контрольных задач пока нет" tasks={controlledTasks} testId="controlled-tasks-list" />
        </section>

        <section className="phase2-panel kanban-panel">
          <h3>Kanban</h3>
          <div className="kanban-board">
            {(kanban?.columns ?? []).map((column) => (
              <div className="kanban-column" data-testid={`kanban-column-${column.status}`} key={column.status}>
                <h4>{taskStatusLabels[column.status]}</h4>
                {column.tasks.length > 0
                  ? column.tasks.map((task) => (
                      <div className="kanban-task" key={task.id}>
                        <span>{task.id}</span>
                        <small>{task.title}</small>
                        <div className="button-row">
                          {canWriteTaskStatus && task.status !== "in_progress" ? (
                            <button
                              className="secondary-button"
                              disabled={pendingAction !== null}
                              type="button"
                              onClick={() => void moveTask(task, "in_progress")}
                            >
                              В работу
                            </button>
                          ) : null}
                          {canWriteTaskComments ? (
                            <button
                              className="secondary-button"
                              disabled={pendingAction !== null}
                              type="button"
                              onClick={() => void addTaskComment(task)}
                            >
                              Комментарий
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  : <span className="empty-column">Пусто</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="phase2-panel">
          <h3>Аудит задачи</h3>
          <div className="compact-list" data-testid="task-audit-events">
            {taskAuditEvents.length > 0
              ? taskAuditEvents.map((event) => (
                  <span key={event.id}>
                    {event.actionKey}: {event.actorId} - {event.target.entityId}
                  </span>
                ))
              : "Аудит задачи пока пуст"}
          </div>
        </section>
      </div>
    </section>
  );
}
