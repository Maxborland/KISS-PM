import { CheckSquare, MessageSquare, PlusCircle } from "lucide-react";
import type { FormEvent } from "react";

import type { ActivityComposerMode } from "./opportunityActivity";
import type { OpportunityTaskFormState } from "./OpportunityActivityForms";
import type { WorkspaceData } from "./workspaceData";

export function OpportunityActivityComposer(props: {
  activeUsers: WorkspaceData["users"];
  canManageOpportunities: boolean;
  commentBody: string;
  commentError: string;
  isSaving: boolean;
  mode: ActivityComposerMode;
  taskError: string;
  taskForm: OpportunityTaskFormState;
  onCommentBodyChange: (value: string) => void;
  onModeChange: (mode: ActivityComposerMode) => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitTask: (event: FormEvent<HTMLFormElement>) => void;
  onTaskFormChange: (form: OpportunityTaskFormState) => void;
}) {
  const isCommentMode = props.mode === "comment";
  const disabledReason = "Только чтение: нужно право tenant.opportunities.manage.";

  return (
    <section className="activity-composer" aria-label="Быстрое действие">
      <div className="activity-composer-header">
        <div>
          <strong>Быстрое действие</strong>
          <span>Зафиксируйте контакт или следующий шаг прямо из ленты.</span>
        </div>
        <div className="activity-composer-mode" aria-label="Тип быстрого действия">
          <button
            aria-pressed={isCommentMode}
            type="button"
            onClick={() => props.onModeChange("comment")}
          >
            <MessageSquare aria-hidden="true" size={14} />
            Комментарий
          </button>
          <button
            aria-pressed={!isCommentMode}
            type="button"
            onClick={() => props.onModeChange("task")}
          >
            <CheckSquare aria-hidden="true" size={14} />
            Задача
          </button>
        </div>
      </div>

      {!props.canManageOpportunities ? (
        <p className="empty-state compact">{disabledReason}</p>
      ) : null}

      {isCommentMode ? (
        <form
          aria-label="Быстрое действие по сделке"
          className="activity-composer-form"
          onSubmit={props.onSubmitComment}
        >
          <label htmlFor="deal-quick-comment-body">
            Текст комментария
            <textarea
              id="deal-quick-comment-body"
              disabled={!props.canManageOpportunities || props.isSaving}
              rows={3}
              value={props.commentBody}
              onChange={(event) => props.onCommentBodyChange(event.target.value)}
            />
          </label>
          {props.commentError ? <p className="error">{props.commentError}</p> : null}
          <button
            className="primary-button"
            disabled={!props.canManageOpportunities || props.isSaving}
            title={props.canManageOpportunities ? undefined : disabledReason}
            type="submit"
          >
            <MessageSquare aria-hidden="true" size={14} />
            {props.isSaving ? "Добавляем..." : "Добавить комментарий"}
          </button>
        </form>
      ) : (
        <form
          aria-label="Быстрое действие по сделке"
          className="activity-composer-form"
          onSubmit={props.onSubmitTask}
        >
          <label htmlFor="deal-quick-task-title">
            Название задачи
            <input
              id="deal-quick-task-title"
              disabled={!props.canManageOpportunities || props.isSaving}
              value={props.taskForm.title}
              onChange={(event) =>
                props.onTaskFormChange({
                  ...props.taskForm,
                  title: event.target.value
                })
              }
            />
          </label>
          <label htmlFor="deal-quick-task-body">
            Описание задачи
            <textarea
              id="deal-quick-task-body"
              disabled={!props.canManageOpportunities || props.isSaving}
              rows={2}
              value={props.taskForm.body}
              onChange={(event) =>
                props.onTaskFormChange({
                  ...props.taskForm,
                  body: event.target.value
                })
              }
            />
          </label>
          <div className="activity-form-grid">
            <label htmlFor="deal-quick-task-due-date">
              Срок задачи
              <input
                id="deal-quick-task-due-date"
                disabled={!props.canManageOpportunities || props.isSaving}
                type="date"
                value={props.taskForm.dueDate}
                onChange={(event) =>
                  props.onTaskFormChange({
                    ...props.taskForm,
                    dueDate: event.target.value
                  })
                }
              />
            </label>
            <label htmlFor="deal-quick-task-assignee">
              Ответственный за задачу
              <select
                id="deal-quick-task-assignee"
                disabled={!props.canManageOpportunities || props.isSaving}
                value={props.taskForm.assigneeUserId}
                onChange={(event) =>
                  props.onTaskFormChange({
                    ...props.taskForm,
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
          {props.taskError ? <p className="error">{props.taskError}</p> : null}
          <button
            className="primary-button"
            disabled={!props.canManageOpportunities || props.isSaving}
            title={props.canManageOpportunities ? undefined : disabledReason}
            type="submit"
          >
            <PlusCircle aria-hidden="true" size={14} />
            {props.isSaving ? "Создаем..." : "Создать follow-up задачу"}
          </button>
        </form>
      )}
    </section>
  );
}
