"use client";

import { ExternalLink, Send, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { TaskActivity, TaskStatus, TaskStatusCategory, WorkspaceUser } from "@/lib/api-types";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { mockTaskProjectRef } from "@/views/catalog";

export type TaskDetailTask = {
  id: string;
  title: string;
  description?: string | null | undefined;
  ownerUserId?: string | undefined;
  plannedFinish?: string | undefined;
  statusCategory?: TaskStatusCategory | undefined;
  statusId?: string | undefined;
  statusName?: string | undefined;
  stage?: { label: string; tone?: "info" | "violet" | "success" | "warning" };
  project?: string | undefined;
};

export type TaskDetailFieldsUpdateInput = {
  dueDate?: string | undefined;
  ownerUserId?: string | undefined;
};

export type TaskDetailDrawerProps = {
  task: TaskDetailTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities?: TaskActivity[] | undefined;
  activityError?: unknown;
  activityPending?: boolean | undefined;
  commentError?: unknown;
  commentPending?: boolean | undefined;
  canEditTaskFields?: boolean | undefined;
  fieldActionError?: unknown;
  fieldActionPending?: boolean | undefined;
  canEditTaskStatus?: boolean | undefined;
  statusActionError?: unknown;
  statusActionPending?: boolean | undefined;
  onAddComment?: ((body: string) => Promise<unknown> | void) | undefined;
  onUpdateTaskStatus?: ((statusId: string) => Promise<unknown> | void) | undefined;
  onUpdateTaskFields?: ((fields: TaskDetailFieldsUpdateInput) => Promise<unknown> | void) | undefined;
  taskStatuses?: TaskStatus[] | undefined;
  workspaceUsers?: WorkspaceUser[] | undefined;
  /**
   * Маршрут на полноценную страницу карточки задачи. В Storybook ведёт на
   * историю `screens-задачи--task-card`; в продукте подставляется реальный
   * URL задачи (например, `/tasks/MDS-39`).
   */
  taskHref?: string | null;
};

const DEFAULT_STORYBOOK_TASK_HREF =
  "?path=/story/screens-задачи--task-card&viewMode=story";

export function TaskDetailDrawer({
  activities,
  activityError,
  activityPending = false,
  commentError,
  commentPending = false,
  canEditTaskFields = false,
  canEditTaskStatus = false,
  fieldActionError,
  fieldActionPending = false,
  statusActionError,
  statusActionPending = false,
  onAddComment,
  onUpdateTaskStatus,
  onUpdateTaskFields,
  taskStatuses = [],
  task,
  open,
  onOpenChange,
  taskHref = DEFAULT_STORYBOOK_TASK_HREF,
  workspaceUsers = []
}: TaskDetailDrawerProps) {
  const subtitle = task ? (task.project ? `${task.id} · ${task.project}` : mockTaskProjectRef(task.id)) : "";
  const hasRuntimeActivity = activities != null || Boolean(onAddComment);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="xl" className="task-drawer">
        {task ? (
          <>
            <SheetHeader className="task-drawer__head">
              <SheetTitle className="sr-only">{task.title}</SheetTitle>
              <SheetDescription className="sr-only">
                {subtitle
                  ? `Карточка задачи ${task.title}: ${subtitle}.`
                  : `Карточка задачи ${task.title}.`}
              </SheetDescription>
              {taskHref ? (
                <Button
                  asChild
                  variant="secondary"
                  size="icon"
                  className="task-drawer__open-full"
                >
                  <a
                    target="_top"
                    rel="noreferrer"
                    href={taskHref}
                    aria-label="Открыть карточку задачи как страницу"
                    title="Открыть как страницу"
                  >
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              ) : null}
            </SheetHeader>
            <SheetBody className="task-drawer__body">
              <EntityDetailBlock
                title={task.title}
                subtitle={subtitle}
                variant="task"
                primary={
                  hasRuntimeActivity ? (
                    <>
                      <CardPanel title="Описание" subtitle="Контекст задачи">
                        <p className="u-text-body">{task.description?.trim() || "Описание не заполнено."}</p>
                      </CardPanel>
                      <RuntimeTaskFieldsPanel
                        canEdit={canEditTaskFields && Boolean(onUpdateTaskFields)}
                        error={fieldActionError}
                        isPending={fieldActionPending}
                        statusActionError={statusActionError}
                        statusActionPending={statusActionPending}
                        canEditStatus={canEditTaskStatus && Boolean(onUpdateTaskStatus)}
                        onUpdateStatus={onUpdateTaskStatus}
                        onUpdate={onUpdateTaskFields}
                        task={task}
                        taskStatuses={taskStatuses}
                        workspaceUsers={workspaceUsers}
                      />
                    </>
                  ) : undefined
                }
                headerActions={hasRuntimeActivity ? null : undefined}
                hideDefaultAside={hasRuntimeActivity}
                hideDefaultStageMeta={hasRuntimeActivity}
                feed={hasRuntimeActivity ? renderTaskActivityFeed(activities ?? [], activityPending, activityError, commentError) : undefined}
                feedComposer={
                  onAddComment ? (
                    <TaskCommentComposer
                      disabled={commentPending}
                      onSubmit={onAddComment}
                    />
                  ) : undefined
                }
                {...(task.stage ? { stage: task.stage } : {})}
              />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RuntimeTaskFieldsPanel({
  canEdit,
  error,
  isPending,
  statusActionError,
  statusActionPending,
  canEditStatus,
  onUpdateStatus,
  onUpdate,
  task,
  taskStatuses,
  workspaceUsers
}: {
  canEdit: boolean;
  error: unknown;
  isPending: boolean;
  statusActionError: unknown;
  statusActionPending: boolean;
  canEditStatus: boolean;
  onUpdateStatus?: ((statusId: string) => Promise<unknown> | void) | undefined;
  onUpdate?: ((fields: TaskDetailFieldsUpdateInput) => Promise<unknown> | void) | undefined;
  task: TaskDetailTask;
  taskStatuses: TaskStatus[];
  workspaceUsers: WorkspaceUser[];
}) {
  const activeUsers = workspaceUsers.filter((user) => user.status !== "inactive");
  const activeStatuses = taskStatuses
    .filter((status) => status.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const usersById = new Map(workspaceUsers.map((user) => [user.id, user.name]));
  const dueDate = getDateInputValue(task.plannedFinish);
  const ownerName = task.ownerUserId ? usersById.get(task.ownerUserId) ?? task.ownerUserId : "Не назначен";
  const canEditOwner = canEdit && activeUsers.length > 0 && Boolean(task.ownerUserId);
  const canEditDue = canEdit && Boolean(dueDate);
  const canEditCurrentStatus = canEditStatus && activeStatuses.length > 0 && Boolean(task.statusId);

  return (
    <CardPanel title="Параметры" subtitle="Статус, ответственный, срок и блокер" className="u-mt-3">
      <FormGrid columns={2}>
        <Field label="Статус">
          {canEditCurrentStatus ? (
            <Select
              value={task.statusId ?? ""}
              disabled={statusActionPending}
              onValueChange={(statusId) => {
                if (statusId === task.statusId) return;
                void onUpdateStatus?.(statusId);
              }}
            >
              <SelectTrigger aria-label={`Статус задачи ${task.title}`} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="u-text-body">{task.statusName ?? "Не задан"}</p>
          )}
          {statusActionError ? (
            <p className="u-text-xs u-text-danger">Не удалось изменить статус задачи.</p>
          ) : null}
        </Field>
        <Field label="Ответственный">
          {canEditOwner ? (
            <Select
              value={task.ownerUserId ?? ""}
              disabled={isPending}
              onValueChange={(ownerUserId) => {
                if (ownerUserId === task.ownerUserId) return;
                void onUpdate?.({ ownerUserId });
              }}
            >
              <SelectTrigger aria-label={`Ответственный задачи ${task.title}`} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="u-text-body">{ownerName}</p>
          )}
          {canEdit && activeUsers.length === 0 ? (
            <p className="u-text-xs u-text-muted">Список пользователей недоступен.</p>
          ) : null}
        </Field>
        <Field label="Срок">
          {canEditDue ? (
            <Input
              aria-label={`Срок задачи ${task.title}`}
              className="input--sm"
              defaultValue={dueDate}
              disabled={isPending}
              type="date"
              onBlur={(event) => {
                const nextDueDate = event.currentTarget.value;
                if (!nextDueDate || nextDueDate === dueDate) return;
                void onUpdate?.({ dueDate: nextDueDate });
              }}
            />
          ) : (
            <p className="u-text-body">{dueDate || "Не задан"}</p>
          )}
        </Field>
      </FormGrid>
      <div className="u-mt-3">
        <Field label="Блокер">
          <div className="u-flex u-items-center u-gap-2 u-flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled
              aria-label={`Блокер задачи ${task.title}`}
            >
              <ShieldAlert className="size-4" aria-hidden />
              {task.statusCategory === "waiting" ? "Блокер в статусе" : "Отметить блокер"}
            </Button>
            <span className="u-text-body">
              {task.statusCategory === "waiting"
                ? `${task.statusName ?? "Ожидает"}: задача уже попадает во внимание.`
                : "Причина блокера не хранится в текущих данных; для внимания используйте статус «Ожидает»."}
            </span>
          </div>
        </Field>
      </div>
      {!canEdit ? (
        <p className="u-text-xs u-text-muted u-mt-2">
          Ответственного и срок меняет руководитель проекта.
        </p>
      ) : null}
      {error ? (
        <p className="field__error u-mt-2" role="alert">
          Не удалось обновить задачу. Проверьте права, срок, ответственного или актуальность данных.
        </p>
      ) : null}
    </CardPanel>
  );
}

function renderTaskActivityFeed(
  activities: TaskActivity[],
  activityPending: boolean,
  activityError: unknown,
  commentError: unknown
): ReactNode {
  if (activityPending) {
    return <li className="feed__item u-text-body u-text-muted">Загружаем активность…</li>;
  }

  if (activityError) {
    return <li className="feed__item u-text-body u-text-danger">Не удалось загрузить активность.</li>;
  }

  const commentErrorItem = commentError ? (
    <li key="comment-error" className="feed__item u-text-body u-text-danger">
      Не удалось добавить комментарий. Проверьте права или доступность API.
    </li>
  ) : null;

  if (activities.length === 0) {
    return [
      commentErrorItem,
      <li key="empty" className="feed__item u-text-body u-text-muted">
        Комментариев пока нет.
      </li>
    ];
  }

  return [
    commentErrorItem,
    ...activities.map((activity) => (
      <li key={activity.id} className="feed__item">
        <BemAvatar initials={initialsFromUserId(activity.authorUserId)} color="c1" size="sm" />
        <div>
          <div className="feed__head">
            <strong className="u-text-body u-text-strong">
              {activity.type === "comment" ? "Комментарий" : activity.title ?? "Активность"}
            </strong>
            <span className="u-text-xs u-text-muted">{formatActivityDate(activity.createdAt)}</span>
          </div>
          <p className="u-text-body">{activity.body ?? activity.title ?? activity.id}</p>
          <p className="u-text-xs u-text-muted">{activity.authorUserId}</p>
        </div>
      </li>
    ))
  ];
}

function initialsFromUserId(userId: string): string {
  return userId
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "??";
}

function getDateInputValue(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function TaskCommentComposer({
  disabled,
  onSubmit
}: {
  disabled: boolean;
  onSubmit: (body: string) => Promise<unknown> | void;
}) {
  const [body, setBody] = useState("");
  const trimmed = body.trim();

  const handleSubmit = async () => {
    if (!trimmed || disabled) return;
    await onSubmit(trimmed);
    setBody("");
  };

  return (
    <div className="feed__compose">
      <Textarea
        aria-label="Комментарий к задаче"
        rows={2}
        placeholder="Написать комментарий…"
        value={body}
        disabled={disabled}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="feed__compose-actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={!trimmed || disabled}
          onClick={() => {
            void handleSubmit();
          }}
        >
          <Send className="size-4" aria-hidden />
          Отправить
        </Button>
      </div>
    </div>
  );
}

function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
