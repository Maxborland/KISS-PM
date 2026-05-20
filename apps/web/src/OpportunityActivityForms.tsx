import { CheckCircle2, MessageSquare, PlusCircle } from "lucide-react";
import type { FormEvent } from "react";

import type { OpportunityActivity } from "./api";
import { StatusPill } from "./components/workspace-ui";
import { sortOpportunityTasks } from "./opportunityActivity";
import { getWorkspaceUserName, OpportunityActivityRow } from "./OpportunityActivityFeed";
import type { WorkspaceData } from "./workspaceData";
import { formatDate, formatDateOnly } from "./workspaceViewHelpers";

export type OpportunityTaskFormState = {
  title: string;
  body: string;
  dueDate: string;
  assigneeUserId: string;
};

export function OpportunityChatView(props: {
  canManageOpportunities: boolean;
  comments: OpportunityActivity[];
  commentBody: string;
  data: WorkspaceData;
  error: string;
  isSaving: boolean;
  onCommentBodyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="activity-tab-body">
      <div className="activity-list compact-list">
        {props.comments.length === 0 ? (
          <p className="empty-state compact">Сообщений по сделке пока нет.</p>
        ) : (
          props.comments.map((comment) => (
            <OpportunityActivityRow
              activity={comment}
              data={props.data}
              key={comment.id}
            />
          ))
        )}
      </div>
      <form className="activity-form" onSubmit={props.onSubmit}>
        {!props.canManageOpportunities ? (
          <p className="empty-state compact">
            Только чтение: нужно право tenant.opportunities.manage.
          </p>
        ) : null}
        <label htmlFor="deal-comment-body">
          Сообщение
          <textarea
            id="deal-comment-body"
            disabled={!props.canManageOpportunities || props.isSaving}
            rows={3}
            value={props.commentBody}
            onChange={(event) => props.onCommentBodyChange(event.target.value)}
          />
        </label>
        {props.error ? <p className="error">{props.error}</p> : null}
        <button
          className="primary-button"
          disabled={!props.canManageOpportunities || props.isSaving}
          title={
            props.canManageOpportunities
              ? undefined
              : "Нужно право tenant.opportunities.manage"
          }
          type="submit"
        >
          <MessageSquare aria-hidden="true" size={14} />
          {props.isSaving ? "Отправляем..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}

export function OpportunityTaskView(props: {
  activeUsers: WorkspaceData["users"];
  canManageOpportunities: boolean;
  data: WorkspaceData;
  error: string;
  form: OpportunityTaskFormState;
  isSaving: boolean;
  tasks: OpportunityActivity[];
  onComplete: (activityId: string) => void;
  onFormChange: (form: OpportunityTaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="activity-tab-body">
      <div className="activity-list compact-list">
        {props.tasks.length === 0 ? (
          <p className="empty-state compact">Контрольных задач пока нет.</p>
        ) : (
          sortOpportunityTasks(props.tasks).map((task) => (
            <OpportunityTaskRow
              canManageOpportunities={props.canManageOpportunities}
              data={props.data}
              isSaving={props.isSaving}
              key={task.id}
              task={task}
              onComplete={props.onComplete}
            />
          ))
        )}
      </div>
      <form className="activity-form" onSubmit={props.onSubmit}>
        {!props.canManageOpportunities ? (
          <p className="empty-state compact">
            Только чтение: нужно право tenant.opportunities.manage.
          </p>
        ) : null}
        <label htmlFor="deal-task-title">
          Новая задача
          <input
            id="deal-task-title"
            disabled={!props.canManageOpportunities || props.isSaving}
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
            disabled={!props.canManageOpportunities || props.isSaving}
            rows={2}
            value={props.form.body}
            onChange={(event) =>
              props.onFormChange({ ...props.form, body: event.target.value })
            }
          />
        </label>
        <div className="activity-form-grid">
          <label htmlFor="deal-task-due-date">
            Срок
            <input
              id="deal-task-due-date"
              disabled={!props.canManageOpportunities || props.isSaving}
              type="date"
              value={props.form.dueDate}
              onChange={(event) =>
                props.onFormChange({ ...props.form, dueDate: event.target.value })
              }
            />
          </label>
          <label htmlFor="deal-task-assignee">
            Ответственный
            <select
              id="deal-task-assignee"
              disabled={!props.canManageOpportunities || props.isSaving}
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
          disabled={!props.canManageOpportunities || props.isSaving}
          title={
            props.canManageOpportunities
              ? undefined
              : "Нужно право tenant.opportunities.manage"
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

function OpportunityTaskRow(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isSaving: boolean;
  task: OpportunityActivity;
  onComplete: (activityId: string) => void;
}) {
  return (
    <article className="activity-row">
      <div>
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
            disabled={!props.canManageOpportunities || props.isSaving}
            title={
              props.canManageOpportunities
                ? undefined
                : "Нужно право tenant.opportunities.manage"
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
