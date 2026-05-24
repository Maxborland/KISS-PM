import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import { useState } from "react";

import type { Task } from "./api";
import { TaskFormDialog } from "./TaskFormDialog";
import { PlanningWorkspaceRoute } from "./planning/PlanningWorkspaceRoute";
import type { WorkspaceData } from "./workspaceData";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
import { hasPermission } from "./workspaceShellState";
import {
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";
import {
  getNextTaskStatusAction,
  getStatusTone
} from "./taskWorkspace";
import {
  useProjectDetailQuery,
  useProjectWorkMutations
} from "./workspaceQueries";

export function ProjectDetailView(props: {
  data: WorkspaceData;
  projectId: string;
  onBack: () => void;
  onOpenSchedule: (projectId: string) => void;
  onChanged: (message: string) => void;
  sectionState: SectionState;
}) {
  const canManageProjects = hasPermission(props.data.permissions, "tenant.projects.manage");
  const canReadPlan = hasPermission(props.data.permissions, "tenant.project_plan.read");
  const projectDetailQuery = useProjectDetailQuery(
    props.projectId,
    props.sectionState.canRead
  );
  const projectWorkMutations = useProjectWorkMutations();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [transitionError, setTransitionError] = useState("");
  const project = projectDetailQuery.data?.project ??
    props.data.projects.find((candidate) => candidate.id === props.projectId);
  const tasks = projectDetailQuery.data?.tasks ?? [];
  const plannedTaskWork = tasks.reduce((sum, task) => sum + task.plannedWork, 0);
  const pendingTaskId = projectWorkMutations.updateTaskStatus.variables
    ? String(projectWorkMutations.updateTaskStatus.variables.taskId)
    : null;

  async function transitionTask(task: Task, statusId: string) {
    setTransitionError("");
    try {
      await projectWorkMutations.updateTaskStatus.mutateAsync({
        projectId: task.projectId,
        taskId: task.id,
        input: { statusId }
      });
      props.onChanged("Статус задачи обновлен и записан в аудит.");
    } catch (error) {
      setTransitionError(
        error instanceof Error ? error.message : "Не удалось обновить статус задачи."
      );
    }
  }

  if (!props.sectionState.canRead) {
    return (
      <Panel title="Проект" subtitle="Доступ к проектному контуру ограничен.">
        <SectionFeedback state={props.sectionState} emptyLabel="Проект недоступен." />
      </Panel>
    );
  }

  return (
    <Panel
      title={project?.title ?? "Проект"}
      subtitle="Детали активного проекта, стартовая таблица задач и единая точка создания Task."
      actions={
        <div className="panel-actions">
          <button className="secondary-button" type="button" onClick={props.onBack}>
            <ArrowLeft aria-hidden="true" size={16} />
            К проектам
          </button>
          {canReadPlan ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.onOpenSchedule(props.projectId)}
            >
              <CalendarDays aria-hidden="true" size={16} />
              График
            </button>
          ) : (
            <button
              className="secondary-button"
              disabled
              title="Нужно право tenant.project_plan.read"
              type="button"
            >
              График
            </button>
          )}
          {canManageProjects ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus aria-hidden="true" size={16} />
              Создать задачу
            </button>
          ) : (
            <button
              className="secondary-button"
              disabled
              title="Нужно право tenant.projects.manage"
              type="button"
            >
              Создать задачу
            </button>
          )}
        </div>
      }
    >
      <SectionFeedback
        state={{
          ...props.sectionState,
          isLoading: projectDetailQuery.isFetching,
          error: projectDetailQuery.error
            ? "Не удалось загрузить проект."
            : props.sectionState.error
        }}
        emptyLabel="Проект недоступен."
      />
      {project ? (
        <>
          <div className="surface-summary-grid">
            <SummaryCard label="Плановые часы проекта" value={project.plannedHours} />
            <SummaryCard label="Часы задач" value={plannedTaskWork} tone="success" />
            <SummaryCard label="Задачи" value={tasks.length} tone="muted" />
          </div>
          <div className="detail-grid">
            <section className="detail-card">
              <span className="detail-label">Клиент</span>
              <strong>{project.clientName}</strong>
            </section>
            <section className="detail-card">
              <span className="detail-label">Период</span>
              <strong>
                {formatDateOnly(project.plannedStart)}
                {" -> "}
                {formatDateOnly(project.plannedFinish)}
              </strong>
            </section>
            <section className="detail-card">
              <span className="detail-label">Статус</span>
              <StatusPill label="Активен" tone="success" />
            </section>
          </div>
          <PlanningWorkspaceRoute
            projectId={project.id}
            permissions={props.data.permissions}
            taskStatuses={props.data.taskStatuses}
            sectionState={props.sectionState}
            onChanged={props.onChanged}
          />
          <div className="table-wrap">
            {transitionError ? <p className="error">{transitionError}</p> : null}
            <table className="data-table" aria-label="Задачи проекта">
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Период</th>
                  <th>План</th>
                  <th>Участники</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <TableEmpty colSpan={6} label="В проекте пока нет задач." />
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.description ? (
                          <small className="muted">{task.description}</small>
                        ) : null}
                      </td>
                      <td>
                        <span className="toolbar-chip">
                          <CalendarDays aria-hidden="true" size={14} />
                          {formatDateOnly(task.plannedStart)}
                          {" -> "}
                          {formatDateOnly(task.plannedFinish)}
                        </span>
                      </td>
                      <td>{task.plannedWork} ч</td>
                      <td>
                        <span className="chip-list">
                          {task.participants.map((participant) => (
                            <span
                              className="permission-chip"
                              key={`${participant.userId}:${participant.role}`}
                            >
                              {getUserName(participant.userId, props.data)}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <StatusPill
                          label={task.statusName}
                          tone={getStatusTone(task.statusCategory)}
                        />
                      </td>
                      <td>
                        <span className="table-actions">
                          {getNextTaskStatusAction(
                            task,
                            props.data.taskStatuses,
                            props.data.me.id,
                            props.data.permissions
                          ) ? (
                            <button
                              className="primary-button compact"
                              disabled={
                                Boolean(getNextTaskStatusAction(
                                  task,
                                  props.data.taskStatuses,
                                  props.data.me.id,
                                  props.data.permissions
                                )?.disabledReason) ||
                                (projectWorkMutations.updateTaskStatus.isPending &&
                                  pendingTaskId === task.id)
                              }
                              title={
                                getNextTaskStatusAction(
                                  task,
                                  props.data.taskStatuses,
                                  props.data.me.id,
                                  props.data.permissions
                                )?.disabledReason
                              }
                              type="button"
                              onClick={() => {
                                const action = getNextTaskStatusAction(
                                  task,
                                  props.data.taskStatuses,
                                  props.data.me.id,
                                  props.data.permissions
                                );
                                if (action && !action.disabledReason) void transitionTask(task, action.statusId);
                              }}
                            >
                              {projectWorkMutations.updateTaskStatus.isPending &&
                              pendingTaskId === task.id
                                ? "Сохраняем..."
                                : getNextTaskStatusAction(
                                    task,
                                    props.data.taskStatuses,
                                    props.data.me.id,
                                    props.data.permissions
                                  )?.label}
                            </button>
                          ) : (
                            <button
                              className="secondary-button compact"
                              disabled
                              title="Задача уже завершена."
                              type="button"
                            >
                              Готово
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : projectDetailQuery.isFetching ? null : (
        <p className="empty-state">Проект не найден или уже не активен.</p>
      )}
      {isCreateOpen && project ? (
        <TaskFormDialog
          data={props.data}
          isPending={projectWorkMutations.createTask.isPending}
          projectId={project.id}
          taskStatuses={props.data.taskStatuses}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (input) => {
            await projectWorkMutations.createTask.mutateAsync({
              projectId: project.id,
              input: {
                ...input,
                id: "id" in input ? input.id : undefined
              }
            });
            setIsCreateOpen(false);
            props.onChanged("Задача создана и записана в аудит.");
          }}
        />
      ) : null}
    </Panel>
  );
}

function getUserName(userId: string, data: WorkspaceData): string {
  if (data.me.id === userId) return data.me.name;
  return data.users.find((user) => user.id === userId)?.name ?? userId;
}
