"use client";

import { useState } from "react";

import { FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useTaskDetail } from "@/workspace/lib/use-workspace";

import { TaskPeekDetails, taskPeekRecordFromWorkspace } from "./task-peek";

type TaskDetailSurfaceProps = {
  taskId: string;
};

const taskDetailError = (code?: string) => {
  if (code === "invalid_task_id") return "Некорректный идентификатор задачи";
  if (code === "persistence_not_configured") return "Хранилище задач сейчас недоступно";
  return "Не удалось загрузить задачу";
};

const mutationError = (code?: string) => {
  if (code === "task_version_conflict") return "Задачу уже изменил другой участник. Обновите страницу и повторите попытку.";
  if (code === "invalid_task_title") return "Название должно содержать от 3 до 160 символов.";
  if (code === "invalid_task_work") return "Укажите корректные трудозатраты.";
  if (code === "invalid_task_comment") return "Комментарий не может быть пустым.";
  if (code === "task_not_found") return "Задача больше недоступна.";
  if (code === "same_tenant_permission_required") return "У вас нет прав на это действие.";
  return "Не удалось сохранить изменения. Повторите попытку.";
};

const activityLabel = (type: "comment" | "file" | "system") => {
  if (type === "comment") return "Комментарий";
  if (type === "file") return "Файл";
  return "Изменение задачи";
};

export function TaskDetailSurface({ taskId }: TaskDetailSurfaceProps) {
  const { data, status, error, reload, notFound, updateTask, createComment } = useTaskDetail(taskId);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [plannedWork, setPlannedWork] = useState("");
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const surfaceStatus = notFound
    ? "empty"
    : status === "forbidden"
      ? "forbidden"
      : data
        ? "ready"
        : status === "loading"
          ? "loading"
          : "error";

  const beginEdit = () => {
    if (!data) return;
    setTitle(data.task.title);
    setPlannedWork(String(data.task.plannedWork));
    setEditOpen(true);
  };

  const saveTask = async () => {
    if (!data) return "Задача больше недоступна.";
    const work = Number(plannedWork);
    if (!Number.isInteger(work) || work < 1) return "Укажите трудозатраты целым числом от 1.";
    const result = await updateTask({
      title: title.trim(),
      description: data.task.description,
      priority: data.task.priority,
      statusId: data.task.statusId,
      plannedStart: data.task.plannedStart.slice(0, 10),
      plannedFinish: data.task.plannedFinish.slice(0, 10),
      durationWorkingDays: data.task.durationWorkingDays,
      plannedWork: work,
      requiresAcceptance: data.task.requiresAcceptance,
      participants: data.task.participants,
      clientUpdatedAt: data.task.updatedAt
    });
    return result.ok ? null : mutationError(result.code ?? result.message);
  };

  const sendComment = async () => {
    const body = comment.trim();
    if (!body) return;
    setCommentBusy(true);
    setCommentError(null);
    const result = await createComment(body);
    setCommentBusy(false);
    if (!result.ok) {
      setCommentError(mutationError(result.code ?? result.message));
      return;
    }
    setComment("");
  };

  return (
    <WorkspaceShell activeNav="Мои задачи">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <div className="mb-3">
          <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Задача</h1>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          errorFormat={taskDetailError}
          onRetry={() => void reload()}
          loadingLabel="Загрузка задачи…"
          empty={{
            title: "Задача не найдена",
            description: "Она отсутствует или больше недоступна."
          }}
          forbidden={{
            title: "Доступ к задаче ограничен",
            description: "У вас нет прав на просмотр этой задачи."
          }}
        >
          {data ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
              <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)]">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <h2 className="min-w-0 text-[length:var(--text-h3)] leading-[var(--lh-h3)] font-semibold text-[var(--text-strong)]">{data.task.title}</h2>
                  <FormDialog
                    title="Редактировать задачу"
                    trigger={<Button variant="outline" size="sm" onClick={beginEdit}>Редактировать</Button>}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    submitLabel="Сохранить задачу"
                    submitDisabled={title.trim().length < 3 || plannedWork.trim() === ""}
                    onSubmit={saveTask}
                    successToast="Задача обновлена."
                  >
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">
                        Название
                        <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
                      </label>
                      <label className="grid gap-1 text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">
                        Трудозатраты
                        <Input type="number" min="1" step="1" value={plannedWork} onChange={(event) => setPlannedWork(event.target.value)} />
                      </label>
                    </div>
                  </FormDialog>
                </header>
                <div className="p-4">
                  <TaskPeekDetails task={taskPeekRecordFromWorkspace(data.task)} />
                </div>
              </article>

              <section aria-labelledby="task-activity-heading" className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4">
                <h2 id="task-activity-heading" className="text-[length:var(--text-h3)] leading-[var(--lh-h3)] font-semibold text-[var(--text-strong)]">Активность задачи</h2>
                <div className="mt-3 grid gap-2">
                  <label htmlFor="task-comment" className="sr-only">Комментарий</label>
                  <Textarea
                    id="task-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Написать комментарий…"
                    rows={3}
                  />
                  {commentError ? <p role="alert" className="text-[length:var(--text-sm)] text-[var(--danger)]">{commentError}</p> : null}
                  <div className="flex justify-end">
                    <Button disabled={commentBusy || comment.trim() === ""} onClick={() => void sendComment()}>
                      {commentBusy ? "Отправка…" : "Отправить комментарий"}
                    </Button>
                  </div>
                </div>
                {data.activities.length > 0 ? (
                  <ol className="mt-4 grid gap-2">
                    {data.activities.map((activity) => (
                      <li key={activity.id} className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--canvas)] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-xs)] text-[var(--muted)]">
                          <span>{activityLabel(activity.type)}</span>
                          <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString("ru-RU")}</time>
                        </div>
                        {activity.title ? <p className="mt-1 font-medium text-[var(--text-strong)]">{activity.title}</p> : null}
                        {activity.body ? <p className="mt-1 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{activity.body}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-[length:var(--text-sm)] text-[var(--muted)]">Активности пока нет.</p>
                )}
              </section>
            </div>
          ) : (
            <span />
          )}
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}
