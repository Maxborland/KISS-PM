import { BriefcaseBusiness, Clock3 } from "lucide-react";

import type { Task } from "./api";
import type { WorkspaceData } from "./workspaceData";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
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
  onOpenProject: (projectId: string) => void;
}) {
  const activeTasks = props.data.myWorkTasks.filter((task) => task.status !== "done");
  const plannedWork = props.data.myWorkTasks.reduce(
    (sum, task) => sum + task.plannedWork,
    0
  );

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
                      <button
                        className="secondary-button compact"
                        type="button"
                        onClick={() => props.onOpenProject(task.projectId)}
                      >
                        Открыть проект
                      </button>
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

export function formatTaskStatus(status: Task["status"]): string {
  const labels: Record<Task["status"], string> = {
    todo: "К выполнению",
    in_progress: "В работе",
    blocked: "Блокер",
    done: "Готово"
  };
  return labels[status];
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
