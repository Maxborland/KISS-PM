"use client";

import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { OpportunityAuditTab } from "./OpportunityActivityAudit";
import { OpportunityFeedView } from "./OpportunityActivityFeed";
import {
  OpportunityChatView,
  OpportunityTaskView,
  type OpportunityTaskFormState
} from "./OpportunityActivityForms";
import {
  composeOpportunityFeedItems,
  type ActivityTab
} from "./opportunityActivity";
import type { WorkspaceData } from "./workspaceData";
import {
  useOpportunityActivityMutations,
  useOpportunityActivityQuery
} from "./workspaceQueries";
import { getErrorMessage } from "./workspaceShellState";

const tabs: Array<{ id: ActivityTab; label: string }> = [
  { id: "feed", label: "Лента" },
  { id: "chat", label: "Чат" },
  { id: "tasks", label: "Задачи" },
  { id: "audit", label: "Аудит" }
];

const emptyTaskForm: OpportunityTaskFormState = {
  title: "",
  body: "",
  dueDate: "",
  assigneeUserId: ""
};

export function OpportunityActivityPanel(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  opportunityId: string;
  onChanged: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("feed");
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [taskForm, setTaskForm] = useState<OpportunityTaskFormState>(emptyTaskForm);
  const [taskError, setTaskError] = useState("");
  const activityQuery = useOpportunityActivityQuery(props.opportunityId, true);
  const mutations = useOpportunityActivityMutations(props.opportunityId);
  const activities = activityQuery.data?.activities ?? [];
  const comments = activities.filter((activity) => activity.type === "comment");
  const tasks = activities.filter((activity) => activity.type === "task");
  const systemEvents = activityQuery.data?.systemEvents ?? [];
  const feedItems = useMemo(
    () => composeOpportunityFeedItems(activities, systemEvents),
    [activities, systemEvents]
  );
  const activeUsers = props.data.users.filter((user) => user.status !== "inactive");
  const isSaving =
    mutations.createComment.isPending ||
    mutations.createTask.isPending ||
    mutations.updateTask.isPending;

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = commentBody.trim();
    setCommentError("");
    if (!body) {
      setCommentError("Напишите сообщение.");
      return;
    }

    try {
      await mutations.createComment.mutateAsync({ body });
      setCommentBody("");
      props.onChanged("Комментарий добавлен в сделку");
    } catch (error) {
      setCommentError(getErrorMessage(error));
    }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskForm.title.trim();
    setTaskError("");
    if (!title) {
      setTaskError("Укажите название задачи.");
      return;
    }

    try {
      await mutations.createTask.mutateAsync({
        title,
        body: taskForm.body.trim() || null,
        dueDate: taskForm.dueDate || null,
        assigneeUserId: taskForm.assigneeUserId || null
      });
      setTaskForm(emptyTaskForm);
      props.onChanged("Задача по сделке создана");
    } catch (error) {
      setTaskError(getErrorMessage(error));
    }
  }

  async function completeTask(activityId: string) {
    try {
      await mutations.updateTask.mutateAsync({ activityId, status: "done" });
      props.onChanged("Задача по сделке выполнена");
    } catch (error) {
      setTaskError(getErrorMessage(error));
    }
  }

  return (
    <aside className="deal-activity-panel" aria-label="Рабочая лента сделки">
      <header className="deal-activity-header">
        <div>
          <h2>Рабочее окно сделки</h2>
          <p>Лента, чат, контрольные задачи и аудит по этой сделке.</p>
        </div>
        {activityQuery.isFetching ? <Loader2 aria-hidden="true" size={16} /> : null}
      </header>

      <div className="activity-tabs" role="tablist" aria-label="Разделы активности сделки">
        {tabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab.id}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activityQuery.isLoading ? <p className="loading-state">Загружаем ленту...</p> : null}
      {activityQuery.isError ? (
        <p className="error">{getErrorMessage(activityQuery.error)}</p>
      ) : null}
      {!activityQuery.isLoading && !activityQuery.isError ? (
        <>
          {activeTab === "feed" ? (
            <OpportunityFeedView data={props.data} items={feedItems} />
          ) : null}
          {activeTab === "chat" ? (
            <OpportunityChatView
              canManageOpportunities={props.canManageOpportunities}
              comments={comments}
              commentBody={commentBody}
              data={props.data}
              error={commentError}
              isSaving={isSaving}
              onCommentBodyChange={setCommentBody}
              onSubmit={submitComment}
            />
          ) : null}
          {activeTab === "tasks" ? (
            <OpportunityTaskView
              activeUsers={activeUsers}
              canManageOpportunities={props.canManageOpportunities}
              data={props.data}
              error={taskError}
              form={taskForm}
              isSaving={isSaving}
              tasks={tasks}
              onComplete={completeTask}
              onFormChange={setTaskForm}
              onSubmit={submitTask}
            />
          ) : null}
          {activeTab === "audit" ? (
            <OpportunityAuditTab
              auditEvents={activityQuery.data?.auditEvents ?? null}
              canReadRawAudit={Boolean(activityQuery.data?.canReadRawAudit)}
              data={props.data}
            />
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
