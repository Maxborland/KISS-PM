"use client";

import { Loader2 } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
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
  formatActivityCountLabel,
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
  const tabCounts: Record<ActivityTab, number> = {
    feed: feedItems.length,
    chat: comments.length,
    tasks: tasks.length,
    audit: activityQuery.data?.auditEvents?.length ?? 0
  };
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

  function selectTab(tabId: ActivityTab) {
    setActiveTab(tabId);
    window.requestAnimationFrame(() => {
      document.getElementById(getTabId(tabId))?.focus();
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: ActivityTab) {
    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;
    const lastIndex = tabs.length - 1;
    const keyToIndex: Record<string, number> = {
      ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
      ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
      Home: 0,
      End: lastIndex
    };
    const nextIndex = keyToIndex[event.key];
    if (nextIndex === undefined) return;
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    selectTab(nextTab.id);
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
            aria-controls={activeTab === tab.id ? getPanelId(tab.id) : undefined}
            aria-selected={activeTab === tab.id}
            id={getTabId(tab.id)}
            key={tab.id}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
          >
            <span>{tab.label}</span>
            <span
              aria-label={formatActivityCountLabel(tabCounts[tab.id])}
              className="activity-tab-count"
            >
              {tabCounts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {activityQuery.isLoading ? <p className="loading-state">Загружаем ленту...</p> : null}
      {activityQuery.isError ? (
        <p className="error">{getErrorMessage(activityQuery.error)}</p>
      ) : null}
      {!activityQuery.isLoading && !activityQuery.isError ? (
        <>
          <div
            aria-labelledby={getTabId(activeTab)}
            className="activity-tab-panel"
            id={getPanelId(activeTab)}
            role="tabpanel"
          >
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
          </div>
        </>
      ) : null}
    </aside>
  );
}

function getTabId(tabId: ActivityTab): string {
  return `opportunity-activity-tab-${tabId}`;
}

function getPanelId(tabId: ActivityTab): string {
  return `opportunity-activity-panel-${tabId}`;
}
