"use client";

import {
  ListPlus,
  Loader2,
  Paperclip,
  SendHorizonal,
  SquareCheckBig
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";

import { CrmFeedView } from "./CrmActivityFeed";
import {
  CrmTaskView,
  CrmFileView,
  type CrmFileFormState,
  type CrmTaskFormState
} from "./CrmActivityForms";
import {
  composeCrmFeedItems,
  getCrmActivitySummary,
  getCrmActivityTabs,
  type ActivityRailTabId,
  type ActivityTab,
  formatActivityCountLabel
} from "./crmActivity";
import type { CrmActivityEntityType } from "./api";
import type { WorkspaceData } from "./workspaceData";
import {
  useCrmActivityMutations,
  useCrmActivityQuery
} from "./workspaceQueries";
import { getErrorMessage } from "./workspaceShellState";

const tabIcons = {
  feed: ListPlus,
  tasks: SquareCheckBig,
  files: Paperclip
} satisfies Record<ActivityRailTabId, typeof ListPlus>;

const emptyTaskForm: CrmTaskFormState = {
  title: "",
  body: "",
  dueDate: "",
  assigneeUserId: ""
};

const emptyFileForm: CrmFileFormState = {
  body: "",
  fileSizeBytes: "",
  fileUrl: "",
  mimeType: "",
  title: ""
};

export function CrmActivityPanel(props: {
  canManage: boolean;
  data: WorkspaceData;
  entityId: string;
  entityLabel: string;
  entityType: CrmActivityEntityType;
  managePermission: string;
  onChanged: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("feed");
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [taskForm, setTaskForm] = useState<CrmTaskFormState>(emptyTaskForm);
  const [taskError, setTaskError] = useState("");
  const [fileForm, setFileForm] = useState<CrmFileFormState>(emptyFileForm);
  const [fileError, setFileError] = useState("");
  const activityQuery = useCrmActivityQuery(props.entityType, props.entityId, true);
  const mutations = useCrmActivityMutations(props.entityType, props.entityId);
  const activities = activityQuery.data?.activities ?? [];
  const tasks = activities.filter((activity) => activity.type === "task");
  const files = activities.filter((activity) => activity.type === "file");
  const systemEvents = activityQuery.data?.systemEvents ?? [];
  const feedItems = useMemo(
    () => composeCrmFeedItems(activities, systemEvents),
    [activities, systemEvents]
  );
  const activityTabs = getCrmActivityTabs({
    feedCount: feedItems.length,
    fileCount: files.length,
    taskCount: tasks.length
  });
  const activitySummary = getCrmActivitySummary({
    activities,
    feedItems
  });
  const activeUsers = props.data.users.filter((user) => user.status !== "inactive");
  const isSaving =
    mutations.createComment.isPending ||
    mutations.createTask.isPending ||
    mutations.createFile.isPending ||
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
      props.onChanged("Комментарий добавлен");
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
      props.onChanged("Задача создана");
    } catch (error) {
      setTaskError(getErrorMessage(error));
    }
  }

  async function completeTask(activityId: string) {
    try {
      await mutations.updateTask.mutateAsync({ activityId, status: "done" });
      props.onChanged("Задача выполнена");
    } catch (error) {
      setTaskError(getErrorMessage(error));
    }
  }

  async function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = fileForm.title.trim();
    const fileUrl = fileForm.fileUrl.trim();
    setFileError("");
    if (!title) {
      setFileError("Укажите название файла.");
      return;
    }
    if (!fileUrl) {
      setFileError("Укажите ссылку на файл.");
      return;
    }
    if (!isSafeExternalFileUrl(fileUrl)) {
      setFileError("Ссылка должна начинаться с http:// или https://.");
      return;
    }

    const fileSizeBytes = fileForm.fileSizeBytes.trim()
      ? Number(fileForm.fileSizeBytes)
      : null;
    if (fileSizeBytes !== null && (!Number.isInteger(fileSizeBytes) || fileSizeBytes < 0)) {
      setFileError("Размер файла должен быть целым числом байт.");
      return;
    }

    try {
      await mutations.createFile.mutateAsync({
        body: fileForm.body.trim() || null,
        fileSizeBytes,
        fileUrl,
        mimeType: fileForm.mimeType.trim() || null,
        title
      });
      setFileForm(emptyFileForm);
      setActiveTab("files");
      props.onChanged("Файл добавлен");
    } catch (error) {
      setFileError(getErrorMessage(error));
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
    <aside className="deal-activity-panel" aria-label={`Активность: ${props.entityLabel}`}>
      <header className="deal-activity-header">
        <div>
          <h2>Активность</h2>
          <p>
            {activitySummary.openTaskCount} открытых задач ·{" "}
            {activitySummary.commentCount} сообщений · {files.length} файлов
          </p>
        </div>
        {activityQuery.isFetching ? <Loader2 aria-hidden="true" size={16} /> : null}
      </header>

      <div className="activity-tabs" role="tablist" aria-label={`Разделы активности: ${props.entityLabel}`}>
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
          disabled={!props.canManage}
          title={
            props.canManage
              ? "Напишите сообщение в ленте ниже"
              : `Нужно право ${props.managePermission}`
          }
          type="button"
          onClick={() => document.getElementById(getComposerId(props.entityType, props.entityId))?.focus()}
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
                <label
                  className="sr-only"
                  htmlFor={getComposerId(props.entityType, props.entityId)}
                >
                  Написать сообщение или добавить активность
                </label>
                <textarea
                  id={getComposerId(props.entityType, props.entityId)}
                  disabled={!props.canManage || isSaving}
                  placeholder="Написать сообщение или добавить активность..."
                  rows={1}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
                <button
                  aria-label="Отправить сообщение"
                  className="activity-send-button"
                  disabled={!props.canManage || isSaving}
                  title={
                    props.canManage
                      ? undefined
                      : `Нужно право ${props.managePermission}`
                  }
                  type="submit"
                >
                  <SendHorizonal aria-hidden="true" size={16} />
                </button>
                {commentError ? <p className="error">{commentError}</p> : null}
                {!props.canManage ? (
                  <p className="empty-state compact">
                    Только чтение: нужно право {props.managePermission}.
                  </p>
                ) : null}
              </form>
              <CrmFeedView data={props.data} items={feedItems} />
            </div>
          ) : null}
          {activeTab === "tasks" ? (
            <CrmTaskView
              activeUsers={activeUsers}
              canManage={props.canManage}
              data={props.data}
              error={taskError}
              form={taskForm}
              isSaving={isSaving}
              managePermission={props.managePermission}
              tasks={tasks}
              onComplete={completeTask}
              onFormChange={setTaskForm}
              onSubmit={submitTask}
            />
          ) : null}
          {activeTab === "files" ? (
            <CrmFileView
              canManage={props.canManage}
              data={props.data}
              error={fileError}
              files={files}
              form={fileForm}
              isSaving={isSaving}
              managePermission={props.managePermission}
              onFormChange={setFileForm}
              onSubmit={submitFile}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function isSafeExternalFileUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getTabId(tabId: ActivityRailTabId): string {
  return `crm-activity-tab-${tabId}`;
}

function getPanelId(tabId: ActivityRailTabId): string {
  return `crm-activity-panel-${tabId}`;
}

function getComposerId(entityType: CrmActivityEntityType, entityId: string): string {
  return `crm-${entityType}-${entityId}-feed-message`;
}
