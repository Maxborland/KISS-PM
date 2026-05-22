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
  CheckCircle2,
  BriefcaseBusiness,
  Clock3,
  GripVertical,
  LayoutGrid,
  ListChecks,
  Plus,
  RefreshCw,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Task, TaskParticipant, TaskStatusDefinition, TaskUpdateInput } from "./api";
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
  const [createStatusId, setCreateStatusId] = useState<string | undefined>(undefined);
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
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = props.data.myWorkTasks.filter(
    (task) => task.statusCategory !== "done" && task.plannedFinish === today
  ).length;
  const reviewCount = props.data.myWorkTasks.filter(
    (task) => task.statusCategory === "review"
  ).length;
  const activeStatuses = sortTaskStatuses(props.data.taskStatuses);
  const groupedTasks = groupTasksByStatus(filteredTasks, props.data.taskStatuses);
  const selectedTasks = filteredTasks.filter((task) => selectedIds.has(task.id));
  const activeUsers = props.data.users.filter((user) => user.status !== "inactive");
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
    if (!window.confirm(`Удалить выбранные задачи (${selectedTasks.length})? Действие будет записано в аудит.`)) return;
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

  async function assignBulkUser(userId: string, role: "executor" | "co_executor") {
    setActionError("");
    try {
      for (const task of selectedTasks) {
        await projectWorkMutations.updateTask.mutateAsync({
          taskId: task.id,
          input: buildBulkTaskUpdateInput(task, userId, role)
        });
      }
      setSelectedIds(new Set());
      props.onChanged(`Назначение обновлено в задачах: ${selectedTasks.length}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось назначить пользователя.");
    }
  }

  return (
    <section className="task-workspace-page">
      <header className="task-page-header">
        <div>
          <h1>
            Мои задачи
            <span>{props.data.myWorkTasks.length}</span>
          </h1>
          <p>Рабочая очередь задач по проектам, ролям участия, срокам и статусам.</p>
        </div>
        <div className="task-page-actions">
          <button
            className={isBulkEnabled ? "secondary-button" : "secondary-button"}
            type="button"
            onClick={() => {
              setIsBulkEnabled((value) => !value);
              setSelectedIds(new Set());
            }}
          >
            {isBulkEnabled ? "Выключить массовый режим" : "Включить массовый режим"}
          </button>
          <button
            className="primary-button"
            disabled={!canCreate}
            title={canCreate ? undefined : "Нужно право tenant.tasks.create"}
            type="button"
            onClick={() => {
              setCreateStatusId(undefined);
              setIsCreateOpen(true);
            }}
          >
            <Plus aria-hidden="true" size={16} />
            Создать задачу
          </button>
          <button className="icon-button" aria-label="Сбросить фильтры" type="button" onClick={() => setFilters(defaultFilters)}>
            <RefreshCw aria-hidden="true" size={16} />
          </button>
        </div>
      </header>

      <SectionFeedback state={props.sectionState} emptyLabel="Моя работа недоступна." />

      <div className="task-workspace-toolbar">
        <div className="task-toolbar-row">
          <DueFilter value={filters.due} onChange={(due) => setFilters((state) => ({ ...state, due }))} />
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
        <div className="task-toolbar-row secondary">
          <label className="task-select-filter">
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
          </label>
          <label className="task-select-filter">
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
          </label>
          <label className="task-select-filter wide">
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
          </label>
        </div>

        <div className="task-counter-row">
          <span>Всего: {props.data.myWorkTasks.length}</span>
          <span><i className="dot danger" /> Просрочено: {taskCounters.overdue}</span>
          <span><i className="dot warning" /> Сегодня: {todayCount}</span>
          <span><i className="dot warning" /> В работе: {taskCounters.inProgress}</span>
          <span><i className="dot accent" /> На контроле: {reviewCount}</span>
          <span><i className="dot success" /> Выполнено: {taskCounters.done}</span>
          <span>Всего часов: {taskCounters.plannedWork}</span>
        </div>

        {isBulkEnabled ? (
          <div className="task-bulk-strip">
            <span>
              <CheckCircle2 aria-hidden="true" size={16} />
              Выбрано задач: {selectedIds.size}
            </span>
            <div className="task-bulk-actions">
              <select
                aria-label="Массовая смена статуса"
                disabled={selectedTasks.length === 0 || projectWorkMutations.updateTaskStatus.isPending}
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
              <select
                aria-label="Массовое назначение ответственного"
                disabled={selectedTasks.length === 0 || projectWorkMutations.updateTask.isPending}
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  void assignBulkUser(event.target.value, "executor");
                  event.currentTarget.value = "";
                }}
              >
                <option value="">Назначить ответственного</option>
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <select
                aria-label="Массовое назначение соисполнителя"
                disabled={selectedTasks.length === 0 || projectWorkMutations.updateTask.isPending}
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  void assignBulkUser(event.target.value, "co_executor");
                  event.currentTarget.value = "";
                }}
              >
                <option value="">Назначить соисполнителя</option>
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
              <button
                className="danger-button compact"
                disabled={selectedTasks.length === 0 || !canDelete || projectWorkMutations.archiveTask.isPending}
                title={canDelete ? undefined : "Нужно право tenant.tasks.delete"}
                type="button"
                onClick={() => void archiveSelectedTasks()}
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {actionError ? <p className="error">{actionError}</p> : null}

      {viewMode === "table" ? (
        <>
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
          <div className="task-list-footer">
            <span>
              Показано {filteredTasks.length === 0 ? "0" : `1-${filteredTasks.length}`} из {props.data.myWorkTasks.length} задач
            </span>
          </div>
        </>
      ) : (
        <DndContext sensors={sensors} onDragEnd={(event) => void handleDragEnd(event)}>
          <div className="task-kanban" aria-label="Канбан задач">
            {groupedTasks.map((group) => (
              <TaskKanbanColumn
                canCreate={canCreate}
                data={props.data}
                group={group}
                isBulkEnabled={isBulkEnabled}
                key={group.status.id}
                selectedIds={selectedIds}
                onCreateTask={() => {
                  setCreateStatusId(group.status.id);
                  setIsCreateOpen(true);
                }}
                onOpenTask={props.onOpenTask}
                onSelect={(taskId, selected) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (selected) next.add(taskId);
                    else next.delete(taskId);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </DndContext>
      )}

      {isCreateOpen ? (
        <TaskFormDialog
          data={props.data}
          initialStatusId={createStatusId}
          isPending={projectWorkMutations.createTask.isPending}
          taskStatuses={props.data.taskStatuses}
          onClose={() => {
            setCreateStatusId(undefined);
            setIsCreateOpen(false);
          }}
          onSubmit={async (input, projectId, intent) => {
            const result = await projectWorkMutations.createTask.mutateAsync({
              projectId,
              input: { ...input, id: "id" in input ? input.id : undefined }
            });
            setCreateStatusId(undefined);
            setIsCreateOpen(false);
            props.onChanged("Задача создана.");
            if (intent === "open") props.onOpenTask(result.task.id);
          }}
        />
      ) : null}
    </section>
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
                <tr className={`task-row status-${task.statusCategory}`} key={task.id}>
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
                      <small>{task.description || "Описание не заполнено"}</small>
                    </button>
                  </td>
                  <td>
                    <button className="task-project-link" type="button" onClick={() => props.onProjectOpen(task.projectId)}>
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
                    <span className="task-plan-cell">
                      <Clock3 aria-hidden="true" size={14} />
                      <span>{task.durationWorkingDays} раб. дн</span>
                      <span>{task.plannedWork} ч</span>
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
  canCreate: boolean;
  data: WorkspaceData;
  group: { status: TaskStatusDefinition; tasks: Task[] };
  isBulkEnabled: boolean;
  selectedIds: Set<string>;
  onCreateTask: () => void;
  onOpenTask: (taskId: string) => void;
  onSelect: (taskId: string, selected: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.group.status.id });
  return (
    <section
      className={`task-kanban-column status-${props.group.status.category} ${isOver ? "is-over" : ""}`}
      ref={setNodeRef}
    >
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
              isBulkEnabled={props.isBulkEnabled}
              key={task.id}
              selected={props.selectedIds.has(task.id)}
              task={task}
              onOpenTask={props.onOpenTask}
              onSelect={props.onSelect}
            />
          ))
        )}
      </div>
      <button
        className="task-kanban-add"
        disabled={!props.canCreate}
        title={props.canCreate ? undefined : "Нужно право tenant.tasks.create"}
        type="button"
        onClick={props.onCreateTask}
      >
        + Добавить задачу
      </button>
    </section>
  );
}

function TaskKanbanCard(props: {
  data: WorkspaceData;
  isBulkEnabled: boolean;
  selected: boolean;
  task: Task;
  onOpenTask: (taskId: string) => void;
  onSelect: (taskId: string, selected: boolean) => void;
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
    >
      <div className="task-kanban-card-topline">
        <button
          className="task-card-drag-handle"
          aria-label={`Переместить задачу ${props.task.title}`}
          type="button"
          {...listeners}
          {...attributes}
        >
          <GripVertical aria-hidden="true" size={15} />
        </button>
        <span>{getProjectName(props.data.projects, props.task.projectId)}</span>
        <em>{formatDateOnly(props.task.plannedFinish)}</em>
      </div>
      {props.isBulkEnabled ? (
        <label className="task-card-select" onPointerDown={(event) => event.stopPropagation()}>
          <input
            aria-label={`Выбрать задачу ${props.task.title}`}
            checked={props.selected}
            type="checkbox"
            onChange={(event) => props.onSelect(props.task.id, event.target.checked)}
          />
          Выбрать
        </label>
      ) : null}
      <button className="task-kanban-title-button" type="button" onClick={() => props.onOpenTask(props.task.id)}>
        <strong>{props.task.title}</strong>
      </button>
      <div className="task-kanban-card-meta">
        <span className="task-kanban-role">{formatCurrentUserRoles(props.task, props.data.me.id)}</span>
        <small>{getUserName(props.data.users, props.data.me, props.task.ownerUserId)}</small>
      </div>
      <span className="task-kanban-card-footer">
        <span>{props.task.durationWorkingDays} раб. дн · {props.task.plannedWork} ч</span>
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

function buildBulkTaskUpdateInput(
  task: Task,
  userId: string,
  role: "executor" | "co_executor"
): TaskUpdateInput {
  const participants = task.participants.filter((participant) => {
    if (role === "executor") return participant.role !== "executor";
    return !(participant.role === "co_executor" && participant.userId === userId);
  });
  participants.push({ userId, role } satisfies TaskParticipant);

  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    statusId: task.statusId,
    plannedStart: task.plannedStart,
    plannedFinish: task.plannedFinish,
    durationWorkingDays: task.durationWorkingDays,
    plannedWork: task.plannedWork,
    requiresAcceptance: task.requiresAcceptance,
    clientUpdatedAt: task.updatedAt,
    participants
  };
}
