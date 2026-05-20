import { BriefcaseBusiness, Clock3 } from "lucide-react";
import { useState } from "react";

import type { Task, TaskStatus } from "./api";
import {
  canUserTransitionTask,
  formatTaskStatus,
  getNextTaskAction
} from "./taskStatusView";
import type { WorkspaceData } from "./workspaceData";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
import { useProjectWorkMutations } from "./workspaceQueries";
import {
  Panel,
  SectionFeedback,
  StatusPill,
  SummaryCard,
  TableEmpty
} from "./components/workspace-ui";

export function MyWorkView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const projectWorkMutations = useProjectWorkMutations();
  const [transitionError, setTransitionError] = useState("");
  const activeTasks = props.data.myWorkTasks.filter((task) => task.status !== "done");
  const plannedWork = props.data.myWorkTasks.reduce(
    (sum, task) => sum + task.plannedWork,
    0
  );
  const pendingTaskId = projectWorkMutations.updateTaskStatus.variables
    ? String(projectWorkMutations.updateTaskStatus.variables.taskId)
    : null;

  async function transitionTask(task: Task, status: TaskStatus) {
    setTransitionError("");
    try {
      await projectWorkMutations.updateTaskStatus.mutateAsync({
        projectId: task.projectId,
        taskId: task.id,
        input: { status }
      });
      props.onChanged("Статус задачи обновлен и записан в аудит.");
    } catch (error) {
      setTransitionError(
        error instanceof Error ? error.message : "Не удалось обновить статус задачи."
      );
    }
  }

  return (
    <Panel
      title="Моя работа"
      subtitle="Задачи, где вы назначены участником. Это рабочий вход исполнителя без лишних глобальных действий."
    >
      <div className="surface-summary-grid">
        <SummaryCard label="Назначено задач" value={props.data.myWorkTasks.length} />
        <SummaryCard label="В работе" value={activeTasks.length} tone="success" />
        <SummaryCard label="Плановые часы" value={plannedWork} tone="muted" />
      </div>
      <SectionFeedback state={props.sectionState} emptyLabel="Моя работа недоступна." />
      {transitionError ? <p className="error">{transitionError}</p> : null}
      {props.sectionState.canRead && !props.sectionState.error ? (
        <div className="table-wrap">
          <table className="data-table" aria-label="Моя работа">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Проект</th>
                <th>Период</th>
                <th>План</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {props.data.myWorkTasks.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  label="Назначенных задач пока нет."
                />
              ) : (
                props.data.myWorkTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span className="entity-name-cell">
                        <span className="row-avatar">T</span>
                        <span>
                          <strong>{task.title}</strong>
                          <small>{formatTaskParticipantRoles(task)}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="toolbar-chip">
                        <BriefcaseBusiness aria-hidden="true" size={14} />
                        {getProjectTitle(task.projectId, props.data)}
                      </span>
                    </td>
                    <td>
                      <strong>{formatDateOnly(task.plannedStart)}</strong>
                      <small className="muted">
                        {" -> "}
                        {formatDateOnly(task.plannedFinish)}
                      </small>
                    </td>
                    <td>
                      <span className="toolbar-chip">
                        <Clock3 aria-hidden="true" size={14} />
                        {task.plannedWork} ч
                      </span>
                    </td>
                    <td>
                      <StatusPill
                        label={formatTaskStatus(task.status)}
                        tone={task.status === "done" ? "muted" : "success"}
                      />
                    </td>
                    <td>
                      <span className="table-actions">
                        {canUserTransitionTask(task, props.data.me.id) &&
                        getNextTaskAction(task.status) ? (
                          <button
                            className="primary-button compact"
                            disabled={
                              projectWorkMutations.updateTaskStatus.isPending &&
                              pendingTaskId === task.id
                            }
                            type="button"
                            onClick={() => {
                              const action = getNextTaskAction(task.status);
                              if (action) void transitionTask(task, action.status);
                            }}
                          >
                            {projectWorkMutations.updateTaskStatus.isPending &&
                            pendingTaskId === task.id
                              ? "Сохраняем..."
                              : getNextTaskAction(task.status)?.label}
                          </button>
                        ) : null}
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => props.onOpenProject(task.projectId)}
                        >
                          Открыть проект
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

function getProjectTitle(projectId: string, data: WorkspaceData): string {
  return data.projects.find((project) => project.id === projectId)?.title ?? projectId;
}

function formatTaskParticipantRoles(task: Task): string {
  return task.participants
    .map((participant) => formatParticipantRole(participant.role))
    .join(", ");
}

function formatParticipantRole(role: Task["participants"][number]["role"]): string {
  const labels: Record<Task["participants"][number]["role"], string> = {
    executor: "Исполнитель",
    co_executor: "Соисполнитель",
    requester: "Постановщик",
    controller: "Контролер",
    approver: "Принимающий",
    observer: "Наблюдатель"
  };
  return labels[role];
}
