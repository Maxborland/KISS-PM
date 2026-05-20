"use client";

import {
  CalendarDays,
  ListPlus,
  Loader2,
  Paperclip,
  SendHorizonal,
  SquareCheckBig
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";

import { OpportunityFeedView } from "./OpportunityActivityFeed";
import {
  OpportunityTaskView,
  type OpportunityTaskFormState
} from "./OpportunityActivityForms";
import {
  composeOpportunityFeedItems,
  getOpportunityActivitySummary,
  getOpportunityActivityTabs,
  type ActivityRailTabId,
  type ActivityTab,
  formatActivityCountLabel
} from "./opportunityActivity";
import type { WorkspaceData } from "./workspaceData";
import {
  useOpportunityActivityMutations,
  useOpportunityActivityQuery
} from "./workspaceQueries";
import { getErrorMessage } from "./workspaceShellState";

const tabIcons = {
  feed: ListPlus,
  tasks: SquareCheckBig,
  events: CalendarDays,
  files: Paperclip
} satisfies Record<ActivityRailTabId, typeof ListPlus>;

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
  const activityTabs = getOpportunityActivityTabs({
    feedCount: feedItems.length,
    taskCount: tasks.length
  });
  const activitySummary = getOpportunityActivitySummary({
    activities,
    feedItems
  });
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
      setActiveTab("tasks");
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

  function selectTab(tabId: ActivityRailTabId) {
    const tab = activityTabs.find((item) => item.id === tabId);
    if (!tab?.isEnabled) return;
    setActiveTab(tab.id as ActivityTab);
    window.requestAnimationFrame(() => {
      document.getElementById(getTabId(tab.id))?.focus();
    });
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: ActivityRailTabId
  ) {
    const enabledTabs = activityTabs.filter((tab) => tab.isEnabled);
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;
    const lastIndex = enabledTabs.length - 1;
    const keyToIndex: Record<string, number> = {
      ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
      ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
      Home: 0,
      End: lastIndex
    };
    const nextIndex = keyToIndex[event.key];
    const nextTab = nextIndex === undefined ? null : enabledTabs[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    selectTab(nextTab.id);
  }

  return (
    <aside className="deal-activity-panel" aria-label="Активность по сделке">
      <header className="deal-activity-header">
        <div>
          <h2>Активность по сделке</h2>
          <p>
            {activitySummary.openTaskCount} открытых задач ·{" "}
            {activitySummary.commentCount} сообщений
          </p>
        </div>
        {activityQuery.isFetching ? <Loader2 aria-hidden="true" size={16} /> : null}
      </header>

      <div className="activity-tabs" role="tablist" aria-label="Разделы активности сделки">
        {activityTabs.map((tab) => {
          const Icon = tabIcons[tab.id];
          const isSelected = activeTab === tab.id;

          return (
            <button
              aria-controls={isSelected ? getPanelId(tab.id) : undefined}
              aria-disabled={!tab.isEnabled}
              aria-selected={isSelected}
              id={getTabId(tab.id)}
              key={tab.id}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              title={tab.disabledReason ?? undefined}
              type="button"
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            >
              <Icon aria-hidden="true" size={14} />
              <span>{tab.label}</span>
              {tab.isEnabled ? (
                <span
                  aria-label={formatActivityCountLabel(tab.count)}
                  className="activity-tab-count"
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          aria-label="Добавить активность"
          className="activity-add-button"
          disabled={!props.canManageOpportunities}
          title={
            props.canManageOpportunities
              ? "Напишите сообщение в ленте ниже"
              : "Нужно право tenant.opportunities.manage"
          }
          type="button"
          onClick={() => document.getElementById("deal-feed-message")?.focus()}
        >
          +
        </button>
      </div>

      {activityQuery.isLoading ? <p className="loading-state">Загружаем ленту...</p> : null}
      {activityQuery.isError ? (
        <p className="error">{getErrorMessage(activityQuery.error)}</p>
      ) : null}
      {!activityQuery.isLoading && !activityQuery.isError ? (
        <div
          aria-labelledby={getTabId(activeTab)}
          className="activity-tab-panel"
          id={getPanelId(activeTab)}
          role="tabpanel"
        >
          {activeTab === "feed" ? (
            <div className="activity-feed-workspace">
              <form className="activity-inline-composer" onSubmit={submitComment}>
                <label className="sr-only" htmlFor="deal-feed-message">
                  Написать сообщение или добавить активность
                </label>
                <textarea
                  id="deal-feed-message"
                  disabled={!props.canManageOpportunities || isSaving}
                  placeholder="Написать сообщение или добавить активность..."
                  rows={1}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
                <button
                  aria-label="Отправить сообщение"
                  className="activity-send-button"
                  disabled={!props.canManageOpportunities || isSaving}
                  title={
                    props.canManageOpportunities
                      ? undefined
                      : "Нужно право tenant.opportunities.manage"
                  }
                  type="submit"
                >
                  <SendHorizonal aria-hidden="true" size={16} />
                </button>
                {commentError ? <p className="error">{commentError}</p> : null}
                {!props.canManageOpportunities ? (
                  <p className="empty-state compact">
                    Только чтение: нужно право tenant.opportunities.manage.
                  </p>
                ) : null}
              </form>
              <OpportunityFeedView data={props.data} items={feedItems} />
            </div>
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
        </div>
      ) : null}
    </aside>
  );
}

function getTabId(tabId: ActivityRailTabId): string {
  return `opportunity-activity-tab-${tabId}`;
}

function getPanelId(tabId: ActivityRailTabId): string {
  return `opportunity-activity-panel-${tabId}`;
}
