"use client";

import { ExternalLink, Send } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { TaskActivity } from "@/lib/api-types";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { mockTaskProjectRef } from "@/views/catalog";

export type TaskDetailTask = {
  id: string;
  title: string;
  description?: string | null | undefined;
  stage?: { label: string; tone?: "info" | "violet" | "success" | "warning" };
  project?: string | undefined;
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
  onAddComment?: ((body: string) => Promise<unknown> | void) | undefined;
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
  onAddComment,
  task,
  open,
  onOpenChange,
  taskHref = DEFAULT_STORYBOOK_TASK_HREF
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
                    <CardPanel title="Описание" subtitle="Контекст задачи">
                      <p className="u-text-body">{task.description?.trim() || "Описание не заполнено."}</p>
                    </CardPanel>
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
