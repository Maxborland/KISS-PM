"use client";

import Link from "next/link";
import { type ChangeEvent, useRef, useState } from "react";

import { FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useTaskDetail } from "@/workspace/lib/use-workspace";
import type { TaskAttachment } from "@/workspace/lib/workspace-client";

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

// Честный текст ошибок операций с вложениями (коды attachmentRoutes / attachmentWorkspace).
const attachmentError = (code?: string) => {
  if (code === "file_too_large") return "Файл превышает допустимый размер (25 МБ).";
  if (code === "upload_rate_limited") return "Слишком много загрузок подряд. Повторите через минуту.";
  if (code === "file_required") return "Выберите файл для загрузки.";
  if (code === "attachment_not_found") return "Вложение больше недоступно. Обновите страницу.";
  if (code === "storage_not_configured" || code === "persistence_not_configured") return "Хранилище файлов сейчас недоступно.";
  if (code === "same_tenant_permission_required") return "У вас нет прав на это действие.";
  if (code === "download_failed") return "Не удалось скачать файл. Повторите попытку.";
  return "Не удалось выполнить операцию с вложением. Повторите попытку.";
};

// Человекочитаемый размер файла (Б/КБ/МБ).
const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const attachmentName = (attachment: TaskAttachment) =>
  attachment.fileAsset?.safeDisplayName ??
  attachment.fileAsset?.originalName ??
  attachment.externalReference?.title ??
  "Вложение";

export function TaskDetailSurface({ taskId }: TaskDetailSurfaceProps) {
  const { data, status, error, reload, notFound, updateTask, createComment, uploadAttachment, downloadAttachment, deleteAttachment } = useTaskDetail(taskId);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [plannedWork, setPlannedWork] = useState("");
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attachmentBusyId, setAttachmentBusyId] = useState<string | null>(null);
  const [attachmentMessage, setAttachmentMessage] = useState<string | null>(null);
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

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // сброс — повторный выбор того же файла снова триггерит change
    if (!file) return;
    setUploadBusy(true);
    setAttachmentMessage(null);
    const result = await uploadAttachment(file);
    setUploadBusy(false);
    if (!result.ok) setAttachmentMessage(attachmentError(result.code ?? result.message));
  };

  const onDownload = async (attachment: TaskAttachment) => {
    setAttachmentBusyId(attachment.id);
    setAttachmentMessage(null);
    const result = await downloadAttachment(attachment.id);
    setAttachmentBusyId(null);
    if (!result.ok) {
      setAttachmentMessage(attachmentError(result.code ?? result.message));
      return;
    }
    const href = URL.createObjectURL(result.data.blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = result.data.filename ?? attachmentName(attachment);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  const onDelete = async (attachment: TaskAttachment) => {
    setAttachmentBusyId(attachment.id);
    setAttachmentMessage(null);
    const result = await deleteAttachment(attachment.id);
    setAttachmentBusyId(null);
    if (!result.ok) setAttachmentMessage(attachmentError(result.code ?? result.message));
  };

  // Только активные вложения-файлы: скачивание отдаёт бинарь именно по file-asset.
  const attachments = (data?.attachmentItems ?? []).filter((item) => item.archivedAt === null);

  return (
    <WorkspaceShell activeNav="Мои задачи">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <div className="mb-3">
          <Link
            href="/my-work"
            className="text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            ← Мои задачи
          </Link>
          <h1 className="mt-1 text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Задача</h1>
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
                  <div className="min-w-0">
                    <h2 className="text-[length:var(--text-h3)] leading-[var(--lh-h3)] font-semibold text-[var(--text-strong)]">{data.task.title}</h2>
                    <p className="mt-1 text-[length:var(--text-sm)] text-[var(--muted)]">
                      Проект:{" "}
                      <Link
                        href={`/projects/${encodeURIComponent(data.projectId)}`}
                        className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        {data.projectName ?? "Открыть проект"}
                      </Link>
                    </p>
                  </div>
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

                <section aria-labelledby="task-attachments-heading" className="border-t border-[var(--border)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="task-attachments-heading" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Вложения</h3>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        aria-label="Выбрать файл для загрузки"
                        onChange={(event) => void onFileSelected(event)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadBusy}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadBusy ? "Загрузка…" : "Прикрепить файл"}
                      </Button>
                    </div>
                  </div>
                  {attachmentMessage ? (
                    <p role="alert" className="mt-2 text-[length:var(--text-sm)] text-[var(--danger)]">{attachmentMessage}</p>
                  ) : null}
                  {attachments.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {attachments.map((attachment) => {
                        const busy = attachmentBusyId === attachment.id;
                        return (
                          <li
                            key={attachment.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--canvas)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{attachmentName(attachment)}</p>
                              {attachment.fileAsset ? (
                                <p className="text-[length:var(--text-xs)] text-[var(--muted)]">{formatBytes(attachment.fileAsset.sizeBytes)}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {attachment.kind === "file" ? (
                                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void onDownload(attachment)}>
                                  {busy ? "…" : "Скачать"}
                                </Button>
                              ) : attachment.externalReference ? (
                                <a
                                  href={attachment.externalReference.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                                >
                                  Открыть
                                </a>
                              ) : null}
                              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void onDelete(attachment)}>
                                {busy ? "…" : "Удалить"}
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[length:var(--text-sm)] text-[var(--muted)]">Файлы к задаче ещё не прикреплены.</p>
                  )}
                </section>
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
                        {activity.type === "file" && activity.fileUrl ? (
                          <a
                            href={activity.fileUrl}
                            download
                            className="mt-1 inline-block text-[length:var(--text-sm)] font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                          >
                            Скачать файл{activity.fileSizeBytes != null ? ` (${formatBytes(activity.fileSizeBytes)})` : ""}
                          </a>
                        ) : null}
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
