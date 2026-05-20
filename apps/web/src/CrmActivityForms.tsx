import { CheckCircle2, Paperclip, PlusCircle, SquareCheckBig } from "lucide-react";
import type { FormEvent } from "react";

import type { CrmActivity } from "./api";
import { DatePickerField } from "./components/DatePickerField";
import { StatusPill } from "./components/workspace-ui";
import { sortCrmTasks } from "./crmActivity";
import { getWorkspaceUserName } from "./CrmActivityFeed";
import type { WorkspaceData } from "./workspaceData";
import { formatDate, formatDateOnly } from "./workspaceViewHelpers";

export type CrmTaskFormState = {
  title: string;
  body: string;
  dueDate: string;
  assigneeUserId: string;
};

export type CrmFileFormState = {
  body: string;
  fileSizeBytes: string;
  fileUrl: string;
  mimeType: string;
  title: string;
};

export function CrmTaskView(props: {
  activeUsers: WorkspaceData["users"];
  canManage: boolean;
  data: WorkspaceData;
  error: string;
  form: CrmTaskFormState;
  isSaving: boolean;
  managePermission: string;
  tasks: CrmActivity[];
  onComplete: (activityId: string) => void;
  onFormChange: (form: CrmTaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="activity-tab-body">
      <div className="activity-list compact-list">
        {props.tasks.length === 0 ? (
          <p className="empty-state compact">Контрольных задач пока нет.</p>
        ) : (
          sortCrmTasks(props.tasks).map((task) => (
            <CrmTaskRow
              canManage={props.canManage}
              data={props.data}
              isSaving={props.isSaving}
              managePermission={props.managePermission}
              key={task.id}
              task={task}
              onComplete={props.onComplete}
            />
          ))
        )}
      </div>
      <form className="activity-form" onSubmit={props.onSubmit}>
        {!props.canManage ? (
          <p className="empty-state compact">
            Только чтение: нужно право {props.managePermission}.
          </p>
        ) : null}
        <label htmlFor="deal-task-title">
          Новая задача
          <input
            id="deal-task-title"
            disabled={!props.canManage || props.isSaving}
            value={props.form.title}
            onChange={(event) =>
              props.onFormChange({ ...props.form, title: event.target.value })
            }
          />
        </label>
        <label htmlFor="deal-task-body">
          Описание
          <textarea
            id="deal-task-body"
            disabled={!props.canManage || props.isSaving}
            rows={2}
            value={props.form.body}
            onChange={(event) =>
              props.onFormChange({ ...props.form, body: event.target.value })
            }
          />
        </label>
        <div className="activity-form-grid">
          <DatePickerField
            disabled={!props.canManage || props.isSaving}
            id="deal-task-due-date"
            label="Срок"
            value={props.form.dueDate}
            onChange={(value) => props.onFormChange({ ...props.form, dueDate: value })}
          />
          <label htmlFor="deal-task-assignee">
            Ответственный
            <select
              id="deal-task-assignee"
              disabled={!props.canManage || props.isSaving}
              value={props.form.assigneeUserId}
              onChange={(event) =>
                props.onFormChange({
                  ...props.form,
                  assigneeUserId: event.target.value
                })
              }
            >
              <option value="">Без ответственного</option>
              {props.activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {props.error ? <p className="error">{props.error}</p> : null}
        <button
          className="primary-button"
          disabled={!props.canManage || props.isSaving}
          title={
            props.canManage
              ? undefined
              : `Нужно право ${props.managePermission}`
          }
          type="submit"
        >
          <PlusCircle aria-hidden="true" size={14} />
          {props.isSaving ? "Создаем..." : "Создать задачу"}
        </button>
      </form>
    </div>
  );
}

function CrmTaskRow(props: {
  canManage: boolean;
  data: WorkspaceData;
  isSaving: boolean;
  managePermission: string;
  task: CrmActivity;
  onComplete: (activityId: string) => void;
}) {
  return (
    <article className="activity-row task-row">
      <time dateTime={props.task.createdAt}>{formatActivityTime(props.task.createdAt)}</time>
      <span className="activity-row-marker">
        <SquareCheckBig aria-hidden="true" size={15} />
      </span>
      <div className="activity-row-content">
        <strong>{props.task.title}</strong>
        <p>{props.task.body || "Без описания"}</p>
        <small>
          {getWorkspaceUserName(props.data, props.task.authorUserId)} ·{" "}
          {formatDate(props.task.createdAt)}
          {props.task.dueDate ? ` · срок ${formatDateOnly(props.task.dueDate)}` : ""}
          {props.task.assigneeUserId
            ? ` · ответственный ${getWorkspaceUserName(props.data, props.task.assigneeUserId)}`
            : ""}
        </small>
      </div>
      <span className="activity-row-actions">
        <StatusPill
          label={props.task.status === "done" ? "Выполнена" : "К выполнению"}
          tone={props.task.status === "done" ? "success" : "muted"}
        />
        {props.task.status !== "done" ? (
          <button
            className="secondary-button"
            disabled={!props.canManage || props.isSaving}
            title={
              props.canManage
                ? undefined
                : `Нужно право ${props.managePermission}`
            }
            type="button"
            onClick={() => props.onComplete(props.task.id)}
          >
            <CheckCircle2 aria-hidden="true" size={14} />
            Выполнить
          </button>
        ) : null}
      </span>
    </article>
  );
}

export function CrmFileView(props: {
  canManage: boolean;
  data: WorkspaceData;
  error: string;
  files: CrmActivity[];
  form: CrmFileFormState;
  isSaving: boolean;
  managePermission: string;
  onFormChange: (form: CrmFileFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="activity-tab-body">
      <div className="activity-list compact-list">
        {props.files.length === 0 ? (
          <p className="empty-state compact">Файлы пока не прикреплены.</p>
        ) : (
          props.files.map((file) => <CrmFileRow data={props.data} file={file} key={file.id} />)
        )}
      </div>
      <form className="activity-form" onSubmit={props.onSubmit}>
        {!props.canManage ? (
          <p className="empty-state compact">
            Только чтение: нужно право {props.managePermission}.
          </p>
        ) : null}
        <label htmlFor="crm-file-title">
          Название файла
          <input
            id="crm-file-title"
            disabled={!props.canManage || props.isSaving}
            value={props.form.title}
            onChange={(event) =>
              props.onFormChange({ ...props.form, title: event.target.value })
            }
          />
        </label>
        <label htmlFor="crm-file-url">
          Ссылка на файл
          <input
            id="crm-file-url"
            disabled={!props.canManage || props.isSaving}
            value={props.form.fileUrl}
            onChange={(event) =>
              props.onFormChange({ ...props.form, fileUrl: event.target.value })
            }
          />
        </label>
        <label htmlFor="crm-file-body">
          Описание
          <textarea
            id="crm-file-body"
            disabled={!props.canManage || props.isSaving}
            rows={2}
            value={props.form.body}
            onChange={(event) =>
              props.onFormChange({ ...props.form, body: event.target.value })
            }
          />
        </label>
        <div className="activity-form-grid">
          <label htmlFor="crm-file-size">
            Размер, байт
            <input
              id="crm-file-size"
              disabled={!props.canManage || props.isSaving}
              inputMode="numeric"
              value={props.form.fileSizeBytes}
              onChange={(event) =>
                props.onFormChange({
                  ...props.form,
                  fileSizeBytes: event.target.value
                })
              }
            />
          </label>
          <label htmlFor="crm-file-mime">
            MIME-тип
            <input
              id="crm-file-mime"
              disabled={!props.canManage || props.isSaving}
              value={props.form.mimeType}
              onChange={(event) =>
                props.onFormChange({ ...props.form, mimeType: event.target.value })
              }
            />
          </label>
        </div>
        {props.error ? <p className="error">{props.error}</p> : null}
        <button
          className="primary-button"
          disabled={!props.canManage || props.isSaving}
          title={props.canManage ? undefined : `Нужно право ${props.managePermission}`}
          type="submit"
        >
          <PlusCircle aria-hidden="true" size={14} />
          {props.isSaving ? "Добавляем..." : "Добавить файл"}
        </button>
      </form>
    </div>
  );
}

function CrmFileRow(props: { data: WorkspaceData; file: CrmActivity }) {
  return (
    <article className="activity-row file-row">
      <time dateTime={props.file.createdAt}>{formatActivityTime(props.file.createdAt)}</time>
      <span className="activity-row-marker">
        <Paperclip aria-hidden="true" size={15} />
      </span>
      <div className="activity-row-content">
        <strong>{props.file.title}</strong>
        <p>{props.file.body || props.file.fileUrl}</p>
        <small>
          {getWorkspaceUserName(props.data, props.file.authorUserId)} ·{" "}
          {formatDate(props.file.createdAt)}
          {props.file.mimeType ? ` · ${props.file.mimeType}` : ""}
          {props.file.fileSizeBytes !== null
            ? ` · ${formatFileSize(props.file.fileSizeBytes)}`
            : ""}
        </small>
      </div>
      {props.file.fileUrl ? (
        <a
          className="secondary-button"
          href={props.file.fileUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Открыть
        </a>
      ) : null}
    </article>
  );
}

function formatFileSize(value: number): string {
  if (value < 1024) return `${value} Б`;
  const kiloBytes = value / 1024;
  if (kiloBytes < 1024) return `${Math.round(kiloBytes)} КБ`;
  return `${(kiloBytes / 1024).toFixed(1)} МБ`;
}

function formatActivityTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}
