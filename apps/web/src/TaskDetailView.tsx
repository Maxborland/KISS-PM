"use client";

import {
  AtSign,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  PlayCircle,
  Search,
  Send,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import type { Task, TaskActivity, TaskStatusDefinition } from "./api";
import { TaskFormDialog } from "./TaskFormDialog";
import { Panel, SectionFeedback, StatusPill } from "./components/workspace-ui";
import {
  canArchiveTask,
  canCommentTask,
  canEditTaskFields,
  getNextTaskStatusAction,
  getPriorityLabel,
  getProjectName,
  getStatusTone,
  getUserName,
  sortTaskStatuses
} from "./taskWorkspace";
import type { WorkspaceData } from "./workspaceData";
import { formatDateOnly } from "./workspaceViewHelpers";
import type { SectionState } from "./workspaceShellState";
import {
  useProjectWorkMutations,
  useTaskDetailQuery
} from "./workspaceQueries";

type ActivityTab = "comments" | "history" | "files" | "relations" | "audit";

export function TaskDetailView(props: {
  data: WorkspaceData;
  taskId: string;
  onBackToMyWork: () => void;
  onChanged: (message: string) => void;
  onOpenProject: (projectId: string) => void;
  sectionState: SectionState;
}) {
  const taskQuery = useTaskDetailQuery(props.taskId, props.sectionState.canRead);
  const projectWorkMutations = useProjectWorkMutations();
  const task = taskQuery.data?.task;
  const activities = taskQuery.data?.activities ?? [];
  const [activeTab, setActiveTab] = useState<ActivityTab>("comments");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState("");
  const canEdit = task ? canEditTaskFields(task, props.data.me.id, props.data.permissions) : false;
  const canDelete = canArchiveTask(props.data.permissions);
  const canComment = task ? canCommentTask(task, props.data.me.id, props.data.permissions) : false;
  const nextAction = task
    ? getNextTaskStatusAction(task, props.data.taskStatuses, props.data.me.id, props.data.permissions)
    : null;

  async function runStatusAction() {
    if (!task || !nextAction || nextAction.disabledReason) return;
    setActionError("");
    try {
      await projectWorkMutations.updateTaskStatus.mutateAsync({
        projectId: task.projectId,
        taskId: task.id,
        input: { statusId: nextAction.statusId }
      });
      props.onChanged("Статус задачи обновлен.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить статус.");
    }
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task || !comment.trim()) return;
    setActionError("");
    try {
      await projectWorkMutations.createTaskComment.mutateAsync({
        taskId: task.id,
        body: comment.trim()
      });
      setComment("");
      props.onChanged("Комментарий добавлен в задачу.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось добавить комментарий.");
    }
  }

  if (!props.sectionState.canRead) {
    return (
      <Panel title="Задача" subtitle="Доступ к проектному контуру ограничен.">
        <SectionFeedback state={props.sectionState} emptyLabel="Задача недоступна." />
      </Panel>
    );
  }

  if (!task) {
    return (
      <Panel title="Задача" subtitle="Открываем карточку задачи.">
        <SectionFeedback
          state={{
            ...props.sectionState,
            isLoading: taskQuery.isFetching,
            error: taskQuery.error ? "Не удалось загрузить задачу." : props.sectionState.error
          }}
          emptyLabel="Задача недоступна."
        />
        {!taskQuery.isFetching ? <p className="empty-state">Задача не найдена.</p> : null}
      </Panel>
    );
  }

  return (
    <section className="task-detail-page">
      <header className="task-detail-header">
        <div>
          <nav className="task-breadcrumbs" aria-label="Навигация задачи">
            <button type="button" onClick={props.onBackToMyWork}>Моя работа</button>
            <span>/</span>
            <span>Задачи</span>
            <span>/</span>
            <button type="button" onClick={() => props.onOpenProject(task.projectId)}>
              {getProjectName(props.data.projects, task.projectId)}
            </button>
          </nav>
          <h1>{task.title}</h1>
          <div className="task-detail-meta">
            <span>{task.id}</span>
            <span>|</span>
            <StatusPill label={task.statusName} tone={getStatusTone(task.statusCategory)} />
            <span>|</span>
            <span>{getProjectName(props.data.projects, task.projectId)}</span>
          </div>
        </div>
        <div className="task-detail-actions">
          {nextAction ? (
            <button
              className="primary-button"
              disabled={
                Boolean(nextAction.disabledReason) ||
                projectWorkMutations.updateTaskStatus.isPending
              }
              title={nextAction.disabledReason}
              type="button"
              onClick={() => void runStatusAction()}
            >
              <PlayCircle aria-hidden="true" size={16} />
              {nextAction.label}
            </button>
          ) : null}
          <button
            className="secondary-button"
            disabled={!canEdit}
            title={canEdit ? undefined : "Редактировать может постановщик или пользователь с tenant.tasks.edit"}
            type="button"
            onClick={() => setIsEditOpen(true)}
          >
            Редактировать
          </button>
          <button
            className="secondary-button"
            disabled
            title="Storage/connector слой запланирован следующим cross-cutting slice."
            type="button"
          >
            <Paperclip aria-hidden="true" size={16} />
            Добавить вложение
          </button>
          <button
            className="icon-button"
            disabled={!canDelete}
            title={canDelete ? "Архивировать задачу" : "Нужно право tenant.tasks.delete"}
            type="button"
            onClick={() => {
              if (!canDelete) return;
              void projectWorkMutations.archiveTask.mutateAsync(task.id);
            }}
          >
            <MoreHorizontal aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <TaskStatusRail task={task} statuses={props.data.taskStatuses} />
      {actionError ? <p className="error">{actionError}</p> : null}

      <div className="task-detail-layout">
        <div className="task-detail-left">
          <TaskFactsCard data={props.data} task={task} />
          <TaskTextSection title="2. Описание" icon={FileText}>
            <p>{task.description || "Описание не заполнено."}</p>
            <span className="chip-list">
              <span className="permission-chip">сделка</span>
              <span className="permission-chip">ресурсная проверка</span>
              <span className="permission-chip">активация проекта</span>
            </span>
          </TaskTextSection>
          <TaskTextSection title="3. Проект и связи" icon={Link2}>
            <dl className="task-facts-list compact">
              <div>
                <dt>Проект</dt>
                <dd>
                  <button type="button" onClick={() => props.onOpenProject(task.projectId)}>
                    {getProjectName(props.data.projects, task.projectId)}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Предшественники</dt>
                <dd>
                  <span className="task-disabled-field">
                    Задаются в Gantt. В карточке задачи не редактируются.
                  </span>
                </dd>
              </div>
              <div>
                <dt>Подзадачи</dt>
                <dd>Нет открытых подзадач</dd>
              </div>
            </dl>
          </TaskTextSection>
          <TaskTextSection title="4. Вложения и чек-листы" icon={CheckSquare}>
            <div className="task-attachments-grid">
              <div className="task-disabled-field">Файлы появятся после storage/connector слоя.</div>
              <div>
                <strong>Чек-лист</strong>
                <ul className="task-checklist-preview">
                  <li>Проверить роли</li>
                  <li>Сверить часы</li>
                  <li>Отправить на контроль</li>
                </ul>
              </div>
            </div>
          </TaskTextSection>
          <TaskTextSection title="5. Пользовательские поля" icon={ClipboardList}>
            <dl className="task-facts-list compact">
              <div>
                <dt>Приоритет</dt>
                <dd>
                  <StatusPill
                    label={getPriorityLabel(task.priority)}
                    tone={task.priority === "critical" || task.priority === "high" ? "danger" : "muted"}
                  />
                </dd>
              </div>
              <div>
                <dt>Источник</dt>
                <dd>Задача</dd>
              </div>
            </dl>
          </TaskTextSection>
        </div>

        <aside className="task-activity-panel" aria-label="Активность задачи">
          <header>
            <div>
              <h2>Активность задачи</h2>
              <p>{task.participants.length} участника</p>
            </div>
            <div className="task-activity-tools">
              <button className="secondary-button compact" disabled title="Видеозвонки появятся через connector слой" type="button">
                Видеозвонок
              </button>
              <button className="icon-button" disabled title="Приглашения появятся позже" type="button">
                <UserRound aria-hidden="true" size={17} />
              </button>
              <button className="icon-button" disabled title="Поиск по активности появится после индексации" type="button">
                <Search aria-hidden="true" size={17} />
              </button>
            </div>
          </header>
          <TaskActivityTabs activeTab={activeTab} onChange={setActiveTab} />
          <TaskCommentComposer
            canComment={canComment}
            comment={comment}
            isPending={projectWorkMutations.createTaskComment.isPending}
            onCommentChange={setComment}
            onSubmit={submitComment}
          />
          <TaskActivityTimeline
            activeTab={activeTab}
            activities={activities}
            data={props.data}
            task={task}
          />
          <TaskCommentComposer
            canComment={canComment}
            comment={comment}
            isPending={projectWorkMutations.createTaskComment.isPending}
            onCommentChange={setComment}
            onSubmit={submitComment}
          />
        </aside>
      </div>

      {isEditOpen ? (
        <TaskFormDialog
          data={props.data}
          isPending={projectWorkMutations.updateTask.isPending}
          task={task}
          taskStatuses={props.data.taskStatuses}
          onClose={() => setIsEditOpen(false)}
          onSubmit={async (input) => {
            await projectWorkMutations.updateTask.mutateAsync({
              taskId: task.id,
              input: { ...input, statusId: "statusId" in input ? input.statusId : task.statusId }
            });
            setIsEditOpen(false);
            props.onChanged("Задача обновлена.");
          }}
        />
      ) : null}
    </section>
  );
}

function TaskStatusRail(props: {
  task: Task;
  statuses: readonly TaskStatusDefinition[];
}) {
  const statuses = sortTaskStatuses(props.statuses);
  return (
    <div className="task-status-rail" aria-label="Статусы задачи">
      {statuses.map((status) => (
        <span
          className={status.id === props.task.statusId ? "active" : ""}
          key={status.id}
        >
          {status.name}
        </span>
      ))}
    </div>
  );
}

function TaskFactsCard(props: { data: WorkspaceData; task: Task }) {
  const task = props.task;
  return (
    <section className="task-card-section">
      <h2>1. О задаче</h2>
      <dl className="task-facts-list">
        <Fact icon={UserRound} label="Постановщик" value={getUserName(props.data.users, props.data.me, task.requesterUserId)} />
        <Fact icon={UserRound} label="Ответственный" value={getUserName(props.data.users, props.data.me, task.ownerUserId)} />
        <Fact
          icon={UserRound}
          label="Соисполнители"
          value={task.participants
            .filter((participant) => participant.role === "co_executor")
            .map((participant) => getUserName(props.data.users, props.data.me, participant.userId))
            .join(", ") || "Нет"}
        />
        <Fact icon={UserRound} label="Наблюдатели" value={task.participants
          .filter((participant) => participant.role === "observer")
          .map((participant) => getUserName(props.data.users, props.data.me, participant.userId))
          .join(", ") || "Нет"} />
        <Fact icon={CalendarDays} label="Начало" value={formatDateOnly(task.plannedStart)} />
        <Fact icon={CalendarDays} label="Окончание" value={formatDateOnly(task.plannedFinish)} />
        <Fact icon={ClipboardList} label="Длительность" value={`${task.durationWorkingDays} раб. дн`} />
        <Fact icon={ClipboardList} label="Трудозатраты" value={`${task.plannedWork} ч`} />
        <div>
          <dt>Проверка результата</dt>
          <dd>
            <StatusPill
              label={task.requiresAcceptance ? "Обязательна перед закрытием" : "Без проверки"}
              tone={task.requiresAcceptance ? "success" : "muted"}
            />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Fact(props: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const Icon = props.icon;
  return (
    <div>
      <dt>
        <Icon aria-hidden="true" size={14} />
        {props.label}
      </dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function TaskTextSection(props: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <section className="task-card-section">
      <h2>
        <Icon aria-hidden="true" size={16} />
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function TaskActivityTabs(props: {
  activeTab: ActivityTab;
  onChange: (tab: ActivityTab) => void;
}) {
  const tabs: { id: ActivityTab; label: string }[] = [
    { id: "comments", label: "Комментарии" },
    { id: "history", label: "История" },
    { id: "files", label: "Файлы" },
    { id: "relations", label: "Связи" },
    { id: "audit", label: "Аудит" }
  ];
  return (
    <div className="task-activity-tabs" role="tablist" aria-label="Вкладки активности задачи">
      {tabs.map((tab) => (
        <button
          aria-selected={props.activeTab === tab.id}
          className={props.activeTab === tab.id ? "active" : ""}
          key={tab.id}
          role="tab"
          type="button"
          onClick={() => props.onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TaskCommentComposer(props: {
  canComment: boolean;
  comment: string;
  isPending: boolean;
  onCommentChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="task-comment-composer" onSubmit={props.onSubmit}>
      <input
        disabled={!props.canComment || props.isPending}
        placeholder={
          props.canComment
            ? "Написать комментарий, @упомянуть участника или добавить файл..."
            : "Комментировать могут участники задачи"
        }
        value={props.comment}
        onChange={(event) => props.onCommentChange(event.target.value)}
      />
      <button className="icon-button" disabled title="Файлы будут доступны после storage слоя" type="button">
        <Paperclip aria-hidden="true" size={17} />
      </button>
      <button className="icon-button" disabled title="Чек-листы будут отдельным slice" type="button">
        <CheckSquare aria-hidden="true" size={17} />
      </button>
      <button className="icon-button" disabled title="@упоминания будут после коммуникационного слоя" type="button">
        <AtSign aria-hidden="true" size={17} />
      </button>
      <button
        className="primary-button compact"
        aria-label="Отправить комментарий"
        disabled={!props.canComment || props.isPending || !props.comment.trim()}
        type="submit"
      >
        <Send aria-hidden="true" size={15} />
      </button>
    </form>
  );
}

function TaskActivityTimeline(props: {
  activeTab: ActivityTab;
  activities: readonly TaskActivity[];
  data: WorkspaceData;
  task: Task;
}) {
  if (props.activeTab === "files") {
    const files = props.activities.filter((activity) => activity.type === "file");
    if (files.length === 0) return <p className="empty-state">Файлов пока нет. Storage слой запланирован отдельно.</p>;
  }
  if (props.activeTab === "relations") {
    return <p className="empty-state">Связи-предшественники задаются в Gantt и здесь отображаются read-only.</p>;
  }
  if (props.activeTab === "audit") {
    return <p className="empty-state">Управленческие действия пишутся в общий аудит. Scoped audit появится после audit-фильтров.</p>;
  }

  const visibleActivities = props.activeTab === "comments"
    ? props.activities.filter((activity) => activity.type === "comment")
    : props.activities;
  if (visibleActivities.length === 0 && props.activeTab === "comments") {
    return <p className="empty-state">Комментариев пока нет.</p>;
  }

  return (
    <div className="task-activity-timeline">
      <span className="task-date-separator">20 мая</span>
      {props.activeTab === "history" ? (
        <article className="task-activity-event system">
          <span className="activity-icon"><MessageCircle aria-hidden="true" size={16} /></span>
          <div>
            <strong>{getUserName(props.data.users, props.data.me, props.task.requesterUserId)}</strong>
            <span>создал задачу</span>
            <div className="task-history-snapshot">
              <span>Статус: {props.task.statusName}</span>
              <span>Ответственный: {getUserName(props.data.users, props.data.me, props.task.ownerUserId)}</span>
              <span>
                Срок: {formatDateOnly(props.task.plannedStart)}
                {" -> "}
                {formatDateOnly(props.task.plannedFinish)}
              </span>
              <span>Проект: {getProjectName(props.data.projects, props.task.projectId)}</span>
            </div>
          </div>
        </article>
      ) : null}
      {visibleActivities.map((activity) => (
        <article className="task-activity-event" key={activity.id}>
          <span className="activity-avatar">
            {getUserName(props.data.users, props.data.me, activity.authorUserId).slice(0, 1)}
          </span>
          <div>
            <strong>{getUserName(props.data.users, props.data.me, activity.authorUserId)}</strong>
            <time>{formatDateOnly(activity.createdAt)}</time>
            <p>{activity.body || activity.title || "Активность без текста"}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
