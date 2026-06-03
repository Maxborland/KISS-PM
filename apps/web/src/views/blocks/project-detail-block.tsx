"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Field, FormActions, FormGrid, FormSection } from "@/components/domain/form-layout";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { Project, Task, TaskActivity, TaskStatus, WorkspaceUser } from "@/lib/api-types";
import { formatDate, formatDateRange, formatHours, formatRub } from "@/lib/mock-data/format";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export type ProjectTaskCreateInput = {
  title: string;
  ownerUserId: string;
  dueDate: string;
  statusId: string;
};

export type ProjectTaskFieldsUpdateInput = {
  ownerUserId?: string | undefined;
  dueDate?: string | undefined;
};

export type ProjectTaskCommentInput = {
  body: string;
  taskId: string;
};

export type ProjectDetailBlockProps = {
  activityTaskId?: string | undefined;
  commentActionError?: unknown;
  commentActionPending?: boolean;
  createTaskError?: unknown;
  createTaskPending?: boolean;
  currentUserId?: string | undefined;
  onCreateTask?: ((input: ProjectTaskCreateInput) => Promise<unknown> | void) | undefined;
  onAddTaskComment?: ((input: ProjectTaskCommentInput) => Promise<unknown> | void) | undefined;
  onSelectActivityTask?: ((taskId: string) => void) | undefined;
  project: Project;
  taskActivities?: TaskActivity[];
  taskActivityError?: unknown;
  taskActivityPending?: boolean;
  taskActionError?: unknown;
  taskActionPending?: boolean;
  taskStatuses?: TaskStatus[];
  tasks: Task[];
  onChangeTaskStatus?: (task: Task, statusId: string) => Promise<unknown> | void;
  onUpdateTaskFields?: (task: Task, fields: ProjectTaskFieldsUpdateInput) => Promise<unknown> | void;
  readOnly?: boolean;
  workspaceUsers?: WorkspaceUser[];
};

export function ProjectDetailBlock({
  activityTaskId,
  commentActionError,
  commentActionPending = false,
  createTaskError,
  createTaskPending = false,
  currentUserId,
  onAddTaskComment,
  onCreateTask,
  onChangeTaskStatus,
  onSelectActivityTask,
  onUpdateTaskFields,
  project,
  taskActivities = [],
  taskActivityError,
  taskActivityPending = false,
  taskActionError,
  taskActionPending = false,
  taskStatuses = [],
  tasks,
  readOnly = false,
  workspaceUsers = []
}: ProjectDetailBlockProps) {
  const activeTasks = tasks.filter((task) => task.archivedAt == null);
  const overdueTasks = activeTasks.filter((task) => isOverdueTask(task));
  const blockedTasks = activeTasks.filter((task) => task.status === "waiting");
  const completion = resolveCompletion(activeTasks);
  const activeTaskStatuses = taskStatuses
    .filter((status) => status.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const canChangeTaskStatus = Boolean(onChangeTaskStatus && activeTaskStatuses.length > 0);
  const activeWorkspaceUsers = workspaceUsers.filter((user) => user.status !== "inactive");
  const canChangeTaskOwner = Boolean(onUpdateTaskFields && activeWorkspaceUsers.length > 0);
  const canChangeTaskDueDate = Boolean(onUpdateTaskFields);
  const defaultStatusId = resolveDefaultStatusId(activeTaskStatuses);
  const canCreateTask = Boolean(onCreateTask && currentUserId && defaultStatusId);
  const createDisabledReason = resolveCreateDisabledReason({
    canCreateTask,
    currentUserId,
    hasCreateHandler: Boolean(onCreateTask),
    hasStatuses: Boolean(defaultStatusId)
  });
  const userNameById = useMemo(
    () => new Map(workspaceUsers.map((user) => [user.id, user.name])),
    [workspaceUsers]
  );
  const resolvedActivityTaskId = activityTaskId ?? activeTasks[0]?.id ?? "";
  const editDisabledReason = readOnly
    ? "Изменение проекта будет подключено в следующем API-срезе"
    : "Сохранение проекта пока не подключено к API";

  return (
    <>
      <RoutePageIntro
        title={project.title}
        lead={`${project.id} · ${project.clientName} · ${formatDateRange(project.plannedStart, project.plannedFinish)}`}
        actions={
          <>
            {!readOnly ? (
              <Button
                variant="primary"
                disabled
                title={editDisabledReason}
              >
                Обновить проект
              </Button>
            ) : null}
            <Button
              variant="secondary"
              disabled={!canCreateTask}
              title={createDisabledReason}
              form="project-task-create-form"
              type="submit"
            >
              <Plus aria-hidden />
              Добавить задачу
            </Button>
          </>
        }
      />

      <div className="bento project-detail">
        <div className="bento__cell bento__cell--4">
          <CardPanel title="Сводка" subtitle="Ключевые параметры проекта">
            <div className="fact-list">
              <div><span>Клиент</span><strong>{project.clientName}</strong></div>
              <div><span>Статус</span><strong>{projectStatusLabel(project.status)}</strong></div>
              <div><span>Период</span><strong>{formatDateRange(project.plannedStart, project.plannedFinish)}</strong></div>
              <div><span>Бюджет</span><strong>{formatRub(project.contractValue)}</strong></div>
              <div><span>План часов</span><strong>{formatHours(project.plannedHours)}</strong></div>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel title="Что требует внимания" subtitle="Задачи и сроки проекта">
            <div className="fact-list">
              <div><span>Задач</span><strong>{activeTasks.length}</strong></div>
              <div><span>Готовность</span><strong>{completion}%</strong></div>
              <div><span>Ожидают</span><strong>{blockedTasks.length}</strong></div>
              <div><span>Просрочены</span><strong>{overdueTasks.length}</strong></div>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--12">
          <CardPanel title="Задачи проекта" subtitle="Текущий контур работ" flush>
            <ProjectTaskCreateForm
              currentUserId={currentUserId}
              disabledReason={createDisabledReason}
              isPending={createTaskPending}
              onCreateTask={canCreateTask ? onCreateTask : undefined}
              statusId={defaultStatusId}
              taskStatuses={activeTaskStatuses}
              workspaceUsers={workspaceUsers}
            />
            {createTaskError ? (
              <p className="field__error" role="alert">
                Не удалось создать задачу. Проверьте права, ответственного и допустимый статус.
              </p>
            ) : null}
            {activeTasks.length === 0 ? (
              <EmptyState
                title="Задач пока нет"
                description="Когда команда создаст задачи проекта, они появятся здесь без демо-данных."
              />
            ) : (
              <>
                <DataTable className="project-detail__tasks-table" compact>
                  <thead>
                    <tr>
                      <th>Задача</th>
                      <th>Ответственный</th>
                      <th>Статус</th>
                      <th>Срок</th>
                      <th>План</th>
                      <th>Прогресс</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTasks.map((task) => (
                      <tr key={task.id}>
                        <td data-label="Задача">
                          <CellStack title={task.title} subtitle={task.id} />
                        </td>
                        <td data-label="Ответственный">
                          {canChangeTaskOwner ? (
                            <Select
                              value={task.ownerUserId}
                              disabled={taskActionPending}
                              onValueChange={(ownerUserId) => {
                                if (ownerUserId === task.ownerUserId) return;
                                void onUpdateTaskFields?.(task, { ownerUserId });
                              }}
                            >
                              <SelectTrigger
                                aria-label={`Ответственный задачи ${task.title}`}
                                size="sm"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeWorkspaceUsers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            userNameById.get(task.ownerUserId) ?? task.ownerUserId
                          )}
                        </td>
                        <td data-label="Статус">
                          {canChangeTaskStatus ? (
                            <Select
                              value={task.statusId}
                              disabled={taskActionPending}
                              onValueChange={(statusId) => {
                                if (statusId === task.statusId) return;
                                void onChangeTaskStatus?.(task, statusId);
                              }}
                            >
                              <SelectTrigger
                                aria-label={`Статус задачи ${task.title}`}
                                size="sm"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeTaskStatuses.map((status) => (
                                  <SelectItem key={status.id} value={status.id}>
                                    {status.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Chip variant={taskStatusVariant(task.status)}>{task.statusName}</Chip>
                          )}
                          <ProjectTaskBlockerHint
                            canChangeTaskStatus={canChangeTaskStatus}
                            task={task}
                          />
                        </td>
                        <td data-label="Срок">
                          {canChangeTaskDueDate ? (
                            <Input
                              aria-label={`Срок задачи ${task.title}`}
                              className="input--sm"
                              defaultValue={getDateInputValue(new Date(task.plannedFinish))}
                              disabled={taskActionPending}
                              type="date"
                              onBlur={(event) => {
                                const dueDate = event.currentTarget.value;
                                if (!dueDate || dueDate === getDateInputValue(new Date(task.plannedFinish))) return;
                                void onUpdateTaskFields?.(task, { dueDate });
                              }}
                            />
                          ) : (
                            formatDateRange(task.plannedStart, task.plannedFinish)
                          )}
                        </td>
                        <td className="mono" data-label="План">{formatHours(task.plannedWork)}</td>
                        <td className="mono" data-label="Прогресс">{task.progress}%</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                {taskActionError ? (
                  <p className="field__error" role="alert">
                    Не удалось обновить задачу. Проверьте права, срок, ответственного или допустимый переход статуса.
                  </p>
                ) : null}
              </>
            )}
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--12">
          <ProjectTaskActivityPanel
            activities={taskActivities}
            currentTaskId={resolvedActivityTaskId}
            error={taskActivityError ?? commentActionError}
            isCommentPending={commentActionPending}
            isPending={taskActivityPending}
            onAddTaskComment={onAddTaskComment}
            onSelectTask={onSelectActivityTask}
            tasks={activeTasks}
            userNameById={userNameById}
          />
        </div>
      </div>
    </>
  );
}

function ProjectTaskBlockerHint({
  canChangeTaskStatus,
  task
}: {
  canChangeTaskStatus: boolean;
  task: Task;
}) {
  if (task.statusCategory === "waiting") {
    return <p className="field__hint">Блокер: задача уже во внимании.</p>;
  }

  if (canChangeTaskStatus) {
    return <p className="field__hint">Блокер: используйте статус «Ожидает».</p>;
  }

  return <p className="field__hint">Блокер: отдельное поле причины не хранится в текущих данных.</p>;
}

function ProjectTaskActivityPanel({
  activities,
  currentTaskId,
  error,
  isCommentPending,
  isPending,
  onAddTaskComment,
  onSelectTask,
  tasks,
  userNameById
}: {
  activities: TaskActivity[];
  currentTaskId: string;
  error: unknown;
  isCommentPending: boolean;
  isPending: boolean;
  onAddTaskComment?: ((input: ProjectTaskCommentInput) => Promise<unknown> | void) | undefined;
  onSelectTask?: ((taskId: string) => void) | undefined;
  tasks: Task[];
  userNameById: Map<string, string>;
}) {
  const [commentBody, setCommentBody] = useState("");
  const canComment = Boolean(onAddTaskComment && currentTaskId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body || !canComment) return;

    try {
      await onAddTaskComment?.({ body, taskId: currentTaskId });
    } catch {
      return;
    }
    setCommentBody("");
  }

  return (
    <CardPanel title="Активность задачи" subtitle="Комментарии и системные события по выбранной задаче">
      {tasks.length === 0 ? (
        <EmptyState
          title="Нет задачи для активности"
          description="Создайте первую задачу проекта, чтобы фиксировать комментарии и события."
        />
      ) : (
        <>
          <FormSection title="Комментарий" lead="Добавьте рабочий контекст к выбранной задаче.">
            <form onSubmit={(event) => void handleSubmit(event)}>
              <FormGrid columns={2}>
                <Field label="Задача" required>
                  <Select
                    value={currentTaskId}
                    disabled={!onSelectTask || isPending || isCommentPending}
                    onValueChange={(taskId) => onSelectTask?.(taskId)}
                  >
                    <SelectTrigger aria-label="Задача для активности">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Текст" required>
                  <Textarea
                    value={commentBody}
                    disabled={!canComment || isCommentPending}
                    placeholder="Например, согласовали с ГИПом перенос срока."
                    aria-label="Комментарий к задаче"
                    onChange={(event) => setCommentBody(event.target.value)}
                  />
                </Field>
              </FormGrid>
              <FormActions align="start">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canComment || isCommentPending || !commentBody.trim()}
                >
                  {isCommentPending ? "Сохраняем…" : "Добавить комментарий"}
                </Button>
              </FormActions>
            </form>
          </FormSection>

          {error ? (
            <p className="field__error" role="alert">
              Не удалось загрузить или сохранить активность задачи. Проверьте права и доступность API.
            </p>
          ) : null}

          {isPending ? (
            <p className="field__hint">Загружаем активность задачи…</p>
          ) : activities.length === 0 ? (
            <EmptyState
              title="Активности пока нет"
              description="Комментарии и системные события по выбранной задаче появятся здесь."
            />
          ) : (
            <DataTable className="project-detail__activity-table" compact>
              <thead>
                <tr>
                  <th>Событие</th>
                  <th>Автор</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td data-label="Событие">
                      <CellStack
                        title={activity.title ?? activity.body ?? activity.type}
                        subtitle={activity.body && activity.title ? activity.body : activity.id}
                      />
                    </td>
                    <td data-label="Автор">{userNameById.get(activity.authorUserId) ?? activity.authorUserId}</td>
                    <td className="mono" data-label="Дата">{formatDate(activity.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </>
      )}
    </CardPanel>
  );
}

function ProjectTaskCreateForm({
  currentUserId,
  disabledReason,
  isPending,
  onCreateTask,
  statusId,
  taskStatuses,
  workspaceUsers
}: {
  currentUserId?: string | undefined;
  disabledReason: string;
  isPending: boolean;
  onCreateTask?: ((input: ProjectTaskCreateInput) => Promise<unknown> | void) | undefined;
  statusId: string;
  taskStatuses: TaskStatus[];
  workspaceUsers: WorkspaceUser[];
}) {
  const ownerOptions = workspaceUsers.filter((user) => user.status !== "inactive");
  const [title, setTitle] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(currentUserId ?? "");
  const [dueDate, setDueDate] = useState(() => getDateInputValue(new Date()));
  const [selectedStatusId, setSelectedStatusId] = useState(statusId);
  const [localError, setLocalError] = useState("");
  const canSelectOwner = ownerOptions.length > 0;

  useEffect(() => {
    if (!ownerUserId && currentUserId) setOwnerUserId(currentUserId);
  }, [currentUserId, ownerUserId]);

  useEffect(() => {
    if (statusId && !selectedStatusId) setSelectedStatusId(statusId);
  }, [selectedStatusId, statusId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    const trimmedTitle = title.trim();
    const nextOwnerUserId = ownerUserId || currentUserId;
    if (!onCreateTask) {
      setLocalError(disabledReason);
      return;
    }
    if (!trimmedTitle) {
      setLocalError("Укажите название задачи.");
      return;
    }
    if (!nextOwnerUserId) {
      setLocalError("Не удалось определить ответственного.");
      return;
    }
    if (!dueDate) {
      setLocalError("Укажите срок задачи.");
      return;
    }
    if (!selectedStatusId) {
      setLocalError("Не удалось определить стартовый статус задачи.");
      return;
    }

    try {
      await onCreateTask({
        dueDate,
        ownerUserId: nextOwnerUserId,
        statusId: selectedStatusId,
        title: trimmedTitle
      });
    } catch {
      return;
    }
    setTitle("");
    setDueDate(getDateInputValue(new Date()));
    setOwnerUserId(currentUserId ?? "");
    setSelectedStatusId(statusId);
  }

  return (
    <FormSection
      title="Новая задача"
      lead="Создайте рабочую задачу с ответственным, сроком и стартовым статусом."
    >
      <form id="project-task-create-form" onSubmit={(event) => void handleSubmit(event)}>
        <FormGrid columns={3}>
          <Field
            label="Название"
            htmlFor="project-task-create-title"
            required
          >
            <Input
              id="project-task-create-title"
              value={title}
              placeholder="Например, проверить раздел АР"
              disabled={!onCreateTask || isPending}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field
            label="Ответственный"
            {...(canSelectOwner
              ? {}
              : {
                  hint: "Каталог пользователей недоступен: задача будет назначена текущему пользователю."
                })}
            required
          >
            {canSelectOwner ? (
              <Select
                value={ownerUserId}
                disabled={!onCreateTask || isPending}
                onValueChange={setOwnerUserId}
              >
                <SelectTrigger aria-label="Ответственный за новую задачу">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ownerOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={currentUserId ?? ""}
                disabled
                aria-label="Ответственный за новую задачу"
              />
            )}
          </Field>
          <Field
            label="Срок"
            htmlFor="project-task-create-due"
            required
          >
            <Input
              id="project-task-create-due"
              type="date"
              value={dueDate}
              disabled={!onCreateTask || isPending}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
          <Field label="Стартовый статус" required>
            <Select
              value={selectedStatusId}
              disabled={!onCreateTask || isPending || taskStatuses.length === 0}
              onValueChange={setSelectedStatusId}
            >
              <SelectTrigger aria-label="Стартовый статус новой задачи">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taskStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormGrid>
        {localError ? (
          <p className="field__error" role="alert">
            {localError}
          </p>
        ) : null}
        <FormActions align="start">
          <Button
            type="submit"
            variant="primary"
            disabled={!onCreateTask || isPending}
            title={disabledReason}
          >
            <Plus aria-hidden />
            {isPending ? "Создаём…" : "Создать задачу"}
          </Button>
        </FormActions>
      </form>
    </FormSection>
  );
}

function resolveDefaultStatusId(statuses: TaskStatus[]): string {
  return (
    statuses.find((status) => status.category === "new")?.id ??
    statuses[0]?.id ??
    ""
  );
}

function resolveCreateDisabledReason({
  canCreateTask,
  currentUserId,
  hasCreateHandler,
  hasStatuses
}: {
  canCreateTask: boolean;
  currentUserId?: string | undefined;
  hasCreateHandler: boolean;
  hasStatuses: boolean;
}): string {
  if (canCreateTask) return "Создать задачу в проекте";
  if (!hasCreateHandler) return "Создание задач не подключено для этого runtime-экрана";
  if (!currentUserId) return "Сессия не вернула текущего пользователя";
  if (!hasStatuses) return "Нет активного стартового статуса задачи";
  return "Создание задачи временно недоступно";
}

function getDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function projectStatusLabel(status: string): string {
  if (status === "active") return "Активен";
  if (status === "draft") return "Черновик";
  if (status === "closed") return "Закрыт";
  if (status === "paused") return "Пауза";
  return status;
}

function taskStatusVariant(status: Task["status"]): "info" | "success" | "warning" {
  if (status === "done") return "success";
  if (status === "waiting") return "warning";
  return "info";
}

function isOverdueTask(task: Task): boolean {
  return task.status !== "done" && new Date(task.plannedFinish).getTime() < Date.now();
}

function resolveCompletion(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
}
