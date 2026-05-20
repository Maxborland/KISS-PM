"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  BriefcaseBusiness,
  Clock3,
  LayoutGrid,
  ListChecks,
  Plus,
  RefreshCw,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Task, TaskStatusDefinition } from "./api";
import { TaskFormDialog } from "./TaskFormDialog";
import type { WorkspaceData } from "./workspaceData";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
import {
  canArchiveTask,
  filterTasks,
  getNextTaskStatusAction,
  getProjectName,
  getRoleLabel,
  getStatusTone,
  getTaskCounters,
  getUserName,
  groupTasksByStatus,
  sortTaskStatuses,
  type TaskDueFilter,
  type TaskFilters,
  type TaskRoleFilter,
  type TaskViewMode
} from "./taskWorkspace";
import { useProjectWorkMutations } from "./workspaceQueries";
import {
  Panel,
  SectionFeedback,
  StatusPill,
  TableEmpty
} from "./components/workspace-ui";

const defaultFilters: TaskFilters = {
  due: "all",
  role: "all",
  statusId: "all",
  projectId: "all",
  query: ""
};

export function MyWorkView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
  onChanged: (message: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const projectWorkMutations = useProjectWorkMutations();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<TaskViewMode>("table");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkEnabled, setIsBulkEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");
  const filteredTasks = useMemo(
    () =>
      filterTasks(props.data.myWorkTasks, filters, {
        currentUserId: props.data.me.id,
        projects: props.data.projects,
        users: props.data.users
      }),
    [filters, props.data.me.id, props.data.myWorkTasks, props.data.projects, props.data.users]
  );
  const taskCounters = getTaskCounters(props.data.myWorkTasks);
  const activeStatuses = sortTaskStatuses(props.data.taskStatuses);
  const groupedTasks = groupTasksByStatus(filteredTasks, props.data.taskStatuses);
  const selectedTasks = filteredTasks.filter((task) => selectedIds.has(task.id));
  const canDelete = canArchiveTask(props.data.permissions);
  const canCreate =
    props.data.permissions.includes("tenant.tasks.create") ||
    props.data.permissions.includes("tenant.projects.manage");

  async function transitionTask(task: Task, statusId: string) {
    setActionError("");
    try {
      await projectWorkMutations.updateTaskStatus.mutateAsync({
        projectId: task.projectId,
        taskId: task.id,
        input: { statusId }
      });
      props.onChanged("Статус задачи обновлен.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить статус задачи.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const targetStatusId = event.over ? String(event.over.id) : "";
    if (!targetStatusId) return;
    const task = filteredTasks.find((candidate) => candidate.id === taskId);
    if (!task || task.statusId === targetStatusId) return;
    await transitionTask(task, targetStatusId);
  }

  async function applyBulkStatus(statusId: string) {
    setActionError("");
    try {
      for (const task of selectedTasks) {
        await projectWorkMutations.updateTaskStatus.mutateAsync({
          projectId: task.projectId,
          taskId: task.id,
          input: { statusId }
        });
      }
      setSelectedIds(new Set());
      props.onChanged(`Обновлено задач: ${selectedTasks.length}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось выполнить bulk-действие.");
    }
  }

  async function archiveSelectedTasks() {
    setActionError("");
    try {
      for (const task of selectedTasks) {
        await projectWorkMutations.archiveTask.mutateAsync(task.id);
      }
      setSelectedIds(new Set());
      props.onChanged(`Архивировано задач: ${selectedTasks.length}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось архивировать задачи.");
    }
  }

  return (
    <Panel
      title={`Моя работа ${props.data.myWorkTasks.length}`}
      subtitle="Рабочая очередь задач по проектам, ролям участия, срокам и статусам."
      actions={
        <div className="panel-actions">
          <button
            className="primary-button"
            disabled={!canCreate}
            title={canCreate ? undefined : "Нужно право tenant.tasks.create"}
            type="button"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus aria-hidden="true" size={16} />
            Создать задачу
          </button>
          <button className="secondary-button" type="button" onClick={() => setFilters(defaultFilters)}>
            <RefreshCw aria-hidden="true" size={16} />
            Сбросить
          </button>
        </div>
      }
    >
      <SectionFeedback state={props.sectionState} emptyLabel="Моя работа недоступна." />
      <div className="task-workspace-toolbar">
        <DueFilter value={filters.due} onChange={(due) => setFilters((state) => ({ ...state, due }))} />
        <select
          aria-label="Фильтр по роли участия"
          value={filters.role}
          onChange={(event) => setFilters((state) => ({ ...state, role: event.target.value as TaskRoleFilter }))}
        >
          <option value="all">Все роли</option>
          {(["requester", "executor", "co_executor", "observer"] as const).map((role) => (
            <option key={role} value={role}>{getRoleLabel(role)}</option>
          ))}
        </select>
        <select
          aria-label="Фильтр по статусу"
          value={filters.statusId}
          onChange={(event) => setFilters((state) => ({ ...state, statusId: event.target.value }))}
        >
          <option value="all">Все статусы</option>
          {activeStatuses.map((status) => (
            <option key={status.id} value={status.id}>{status.name}</option>
          ))}
        </select>
        <select
          aria-label="Фильтр по проекту"
          value={filters.projectId}
          onChange={(event) => setFilters((state) => ({ ...state, projectId: event.target.value }))}
        >
          <option value="all">Все проекты</option>
          {props.data.projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
        <label className="task-search-field">
          <Search aria-hidden="true" size={16} />
          <input
            placeholder="Поиск задачи..."
            value={filters.query}
            onChange={(event) => setFilters((state) => ({ ...state, query: event.target.value }))}
          />
        </label>
        <div className="task-view-toggle" aria-label="Режим отображения">
          <button
            className={viewMode === "table" ? "active" : ""}
            type="button"
            onClick={() => setViewMode("table")}
          >
            <ListChecks aria-hidden="true" size={16} />
            Таблица
          </button>
          <button
            className={viewMode === "kanban" ? "active" : ""}
            type="button"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid aria-hidden="true" size={16} />
            Канбан
          </button>
        </div>
      </div>

      <div className="task-counter-row">
        <span><i className="dot danger" /> Просрочено: {taskCounters.overdue}</span>
        <span><i className="dot warning" /> В работе: {taskCounters.inProgress}</span>
        <span><i className="dot success" /> Выполнено: {taskCounters.done}</span>
        <span>Всего часов: {taskCounters.plannedWork}</span>
      </div>
      {actionError ? <p className="error">{actionError}</p> : null}

      {viewMode === "table" ? (
        <TaskTable
          data={props.data}
          isBulkEnabled={isBulkEnabled}
          pendingTaskId={projectWorkMutations.updateTaskStatus.variables ? String(projectWorkMutations.updateTaskStatus.variables.taskId) : null}
          selectedIds={selectedIds}
          tasks={filteredTasks}
          onOpenTask={props.onOpenTask}
          onProjectOpen={props.onOpenProject}
          onSelect={(taskId, selected) => {
            setSelectedIds((current) => {
              const next = new Set(current);
              if (selected) next.add(taskId);
              else next.delete(taskId);
              return next;
            });
          }}
          onTransition={transitionTask}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={(event) => void handleDragEnd(event)}>
          <div className="task-kanban" aria-label="Канбан задач">
            {groupedTasks.map((group) => (
              <TaskKanbanColumn
                data={props.data}
                group={group}
                key={group.status.id}
                onOpenTask={props.onOpenTask}
              />
            ))}
          </div>
        </DndContext>
      )}

      <div className="task-bulk-panel">
        <span>
          Bulk режим {isBulkEnabled ? "включен" : "выключен"}
          {isBulkEnabled ? ` · выбрано ${selectedIds.size}` : " · включите режим и выберите карточки"}
        </span>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setIsBulkEnabled((value) => !value);
            setSelectedIds(new Set());
          }}
        >
          {isBulkEnabled ? "Выключить bulk" : "Включить bulk"}
        </button>
        <select
          aria-label="Bulk смена статуса"
          disabled={!isBulkEnabled || selectedTasks.length === 0 || projectWorkMutations.updateTaskStatus.isPending}
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            void applyBulkStatus(event.target.value);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Сменить статус</option>
          {activeStatuses.map((status) => (
            <option key={status.id} value={status.id}>{status.name}</option>
          ))}
        </select>
        <button
          className="danger-button"
          disabled={!isBulkEnabled || selectedTasks.length === 0 || !canDelete || projectWorkMutations.archiveTask.isPending}
          title={canDelete ? undefined : "Нужно право tenant.tasks.delete"}
          type="button"
          onClick={() => void archiveSelectedTasks()}
        >
          Удалить
        </button>
      </div>

      {isCreateOpen ? (
        <TaskFormDialog
          data={props.data}
          isPending={projectWorkMutations.createTask.isPending}
          taskStatuses={props.data.taskStatuses}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (input, projectId) => {
            await projectWorkMutations.createTask.mutateAsync({
              projectId,
              input: { ...input, id: "id" in input ? input.id : undefined }
            });
            setIsCreateOpen(false);
            props.onChanged("Задача создана.");
          }}
        />
      ) : null}
    </Panel>
  );
}

function DueFilter(props: {
  value: TaskDueFilter;
  onChange: (value: TaskDueFilter) => void;
}) {
  const options: { value: TaskDueFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "overdue", label: "Просрочено" },
    { value: "today", label: "Сегодня" },
    { value: "tomorrow", label: "Завтра" },
    { value: "two_weeks", label: "2 недели" }
  ];
  return (
    <div className="segmented-control" aria-label="Фильтр по сроку">
      {options.map((option) => (
        <button
          className={props.value === option.value ? "active" : ""}
          key={option.value}
          type="button"
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TaskTable(props: {
  data: WorkspaceData;
  isBulkEnabled: boolean;
  pendingTaskId: string | null;
  selectedIds: Set<string>;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onProjectOpen: (projectId: string) => void;
  onSelect: (taskId: string, selected: boolean) => void;
  onTransition: (task: Task, statusId: string) => void;
}) {
  return (
    <div className="table-wrap task-table-wrap">
      <table className="data-table task-table" aria-label="Мои задачи">
        <thead>
          <tr>
            {props.isBulkEnabled ? <th aria-label="Выбор задач" /> : null}
            <th>Задача</th>
            <th>Проект</th>
            <th>Статус</th>
            <th>Участие</th>
            <th>Ответственный / Соисполнители</th>
            <th>Сроки</th>
            <th>План</th>
            <th>Проверка</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {props.tasks.length === 0 ? (
            <TableEmpty colSpan={props.isBulkEnabled ? 10 : 9} label="Задач по фильтру нет." />
          ) : (
            props.tasks.map((task) => {
              const action = getNextTaskStatusAction(
                task,
                props.data.taskStatuses,
                props.data.me.id,
                props.data.permissions
              );
              return (
                <tr key={task.id}>
                  {props.isBulkEnabled ? (
                    <td>
                      <input
                        aria-label={`Выбрать задачу ${task.title}`}
                        checked={props.selectedIds.has(task.id)}
                        type="checkbox"
                        onChange={(event) => props.onSelect(task.id, event.target.checked)}
                      />
                    </td>
                  ) : null}
                  <td>
                    <button className="link-cell" type="button" onClick={() => props.onOpenTask(task.id)}>
                      <strong>{task.title}</strong>
                      <small>{task.description || task.id}</small>
                    </button>
                  </td>
                  <td>
                    <button className="toolbar-chip" type="button" onClick={() => props.onProjectOpen(task.projectId)}>
                      <BriefcaseBusiness aria-hidden="true" size={14} />
                      {getProjectName(props.data.projects, task.projectId)}
                    </button>
                  </td>
                  <td><StatusPill label={task.statusName} tone={getStatusTone(task.statusCategory)} /></td>
                  <td>{formatCurrentUserRoles(task, props.data.me.id)}</td>
                  <td>{formatTaskPeople(task, props.data)}</td>
                  <td>
                    <strong>
                      {formatDateOnly(task.plannedStart)}
                      {" -> "}
                      {formatDateOnly(task.plannedFinish)}
                    </strong>
                  </td>
                  <td>
                    <span className="toolbar-chip">
                      <Clock3 aria-hidden="true" size={14} />
                      {task.durationWorkingDays} раб. дн · {task.plannedWork} ч
                    </span>
                  </td>
                  <td>
                    <StatusPill
                      label={task.requiresAcceptance ? "Нужна проверка" : "Без проверки"}
                      tone={task.requiresAcceptance ? "warning" : "muted"}
                    />
                  </td>
                  <td>
                    <span className="table-actions">
                      <button className="secondary-button compact" type="button" onClick={() => props.onOpenTask(task.id)}>
                        Открыть
                      </button>
                      {action ? (
                        <button
                          className="primary-button compact"
                          disabled={Boolean(action.disabledReason) || props.pendingTaskId === task.id}
                          title={action.disabledReason}
                          type="button"
                          onClick={() => props.onTransition(task, action.statusId)}
                        >
                          {props.pendingTaskId === task.id ? "Сохраняем..." : action.label}
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function TaskKanbanColumn(props: {
  data: WorkspaceData;
  group: { status: TaskStatusDefinition; tasks: Task[] };
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.group.status.id });
  return (
    <section className={`task-kanban-column ${isOver ? "is-over" : ""}`} ref={setNodeRef}>
      <header>
        <span>{props.group.status.name}</span>
        <strong>{props.group.tasks.length}</strong>
      </header>
      <div className="task-kanban-cards">
        {props.group.tasks.length === 0 ? (
          <p className="task-kanban-empty">Нет задач по фильтру</p>
        ) : (
          props.group.tasks.map((task) => (
            <TaskKanbanCard
              data={props.data}
              key={task.id}
              task={task}
              onOpenTask={props.onOpenTask}
            />
          ))
        )}
      </div>
      <button className="task-kanban-add" disabled title="Создание идет через основную модалку сверху" type="button">
        + Добавить задачу
      </button>
    </section>
  );
}

function TaskKanbanCard(props: {
  data: WorkspaceData;
  task: Task;
  onOpenTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.task.id
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <article
      className={`task-kanban-card ${isDragging ? "dragging" : ""}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <button type="button" onClick={() => props.onOpenTask(props.task.id)}>
        <span>{getProjectName(props.data.projects, props.task.projectId)}</span>
        <strong>{props.task.title}</strong>
      </button>
      <StatusPill label={formatCurrentUserRoles(props.task, props.data.me.id)} tone="muted" />
      <small>
        {getUserName(props.data.users, props.data.me, props.task.ownerUserId)} · {props.task.durationWorkingDays} раб. дн · {props.task.plannedWork} ч
      </small>
      <span className="task-kanban-card-footer">
        {formatDateOnly(props.task.plannedFinish)}
        <span>{props.task.requiresAcceptance ? "Нужна проверка" : "Без проверки"}</span>
      </span>
    </article>
  );
}

function formatCurrentUserRoles(task: Task, currentUserId: string): string {
  const roles = task.participants
    .filter((participant) => participant.userId === currentUserId)
    .map((participant) => getRoleLabel(participant.role));
  return roles.length > 0 ? roles.join(", ") : "Участник";
}

function formatTaskPeople(task: Task, data: WorkspaceData): string {
  const coExecutors = task.participants
    .filter((participant) => participant.role === "co_executor")
    .map((participant) => getUserName(data.users, data.me, participant.userId));
  return [
    getUserName(data.users, data.me, task.ownerUserId),
    ...coExecutors
  ].join(", ");
}
