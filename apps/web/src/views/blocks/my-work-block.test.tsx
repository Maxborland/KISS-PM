// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ScheduledTask, Task, TaskActivity, TaskStatus, WorkspaceUser } from "@/lib/api-types";
import {
  RuntimeMyWorkBlock,
  canTransitionTaskStatus,
  resolveTaskStatusIdForColumn
} from "@/views/blocks/my-work-block";
import { ScreenRouteProvider } from "@/views/layout/screen-route-context";
import { getScreenRoute } from "@/views/screens/screen-route";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RuntimeMyWorkBlock", () => {
  let host: HTMLElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    host?.remove();
    host = null;
    root = null;
  });

  it("syncs visible cards when runtime task data changes without remounting", async () => {
    await renderRuntimeMyWork([makeTask({ id: "task-before", title: "Runtime task before refresh" })]);

    expect(host?.textContent).toContain("Runtime task before refresh");

    await renderRuntimeMyWork([makeTask({ id: "task-after", title: "Runtime task after refresh" })]);

    expect(host?.textContent).toContain("Runtime task after refresh");
    expect(host?.textContent).not.toContain("Runtime task before refresh");
  });

  it("does not expose the Storybook task page link in runtime drawers", async () => {
    await renderRuntimeMyWork([makeTask({ id: "task-runtime", title: "Runtime task drawer" })]);

    const row = host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-runtime"]');
    expect(row).not.toBeNull();

    await act(async () => {
      row?.click();
    });

    expect(host?.querySelector('a[href*="screens-задачи--task-card"]')).toBeNull();
    expect(host?.querySelector('a[aria-label="Открыть карточку задачи как страницу"]')).toBeNull();
  });

  it("opens a runtime task drawer from an agent deep link when the task is in the read model", async () => {
    await renderRuntimeMyWork(
      [makeTask({ id: "task-agent-result", title: "Runtime task from agent" })],
      { initialOpenTaskId: "task-agent-result" }
    );

    expect(document.body.querySelector(".task-drawer")).not.toBeNull();
    expect(document.body.textContent).toContain("Runtime task from agent");
    expect(document.body.textContent).toContain("task-agent-result");
    expect(document.body.querySelector('a[aria-label="Открыть карточку задачи как страницу"]')).toBeNull();
  });

  it("consumes the agent deep link after the first successful drawer open", async () => {
    await renderRuntimeMyWork(
      [makeTask({ id: "task-agent-result", title: "Runtime task from agent" })],
      { initialOpenTaskId: "task-agent-result" }
    );
    expect(document.body.querySelector(".task-drawer")).not.toBeNull();

    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]')?.click();
    });
    expect(document.body.querySelector(".task-drawer")).toBeNull();

    await renderRuntimeMyWork(
      [makeTask({ id: "task-agent-result", title: "Runtime task after refresh" })],
      { initialOpenTaskId: "task-agent-result" }
    );

    expect(document.body.querySelector(".task-drawer")).toBeNull();
    expect(host?.textContent).toContain("Runtime task after refresh");
  });

  it("does not open a runtime task drawer when the agent deep link target is not loaded", async () => {
    await renderRuntimeMyWork(
      [makeTask({ id: "task-other", title: "Another runtime task" })],
      { initialOpenTaskId: "task-missing" }
    );

    expect(document.body.querySelector(".task-drawer")).toBeNull();
    expect(document.body.textContent).not.toContain("task-missing");
  });

  it("shows today's daily work slice for multi-day scheduled tasks", async () => {
    const today = isoDateOffset(0);
    const finish = isoDateOffset(4);

    await renderRuntimeMyWork([], {
      initialMode: "kanban",
      scheduledTasks: [
        makeScheduledTask({
          plannedStart: today,
          plannedFinish: finish,
          workMinutes: 2400
        })
      ]
    });

    expect(host?.textContent).toContain("План на сегодня");
    expect(host?.textContent).toContain("8 ч");
    expect(host?.textContent).not.toContain("40 ч");
  });

  it("resolves runtime status moves to active workspace task statuses", () => {
    expect(
      resolveTaskStatusIdForColumn(
        [
          makeTaskStatus({ id: "task-status-done-archived", category: "done", status: "archived", sortOrder: 1 }),
          makeTaskStatus({ id: "task-status-done-active", category: "done", status: "active", sortOrder: 2 })
        ],
        "done",
        "in_progress"
      )
    ).toBe("task-status-done-active");
    expect(
      resolveTaskStatusIdForColumn(
        [
          makeTaskStatus({ id: "task-status-new", category: "new", status: "active", sortOrder: 1 }),
          makeTaskStatus({ id: "task-status-waiting", category: "waiting", status: "active", sortOrder: 2 })
        ],
        "new",
        "in_progress"
      )
    ).toBe("task-status-waiting");
    expect(
      resolveTaskStatusIdForColumn(
        [makeTaskStatus({ id: "task-status-done", category: "done", status: "active", sortOrder: 4 })],
        "done",
        "new"
      )
    ).toBeNull();
    expect(resolveTaskStatusIdForColumn([], "review", "in_progress")).toBeNull();
  });

  it("enables runtime status drag only for transition-capable task participants", async () => {
    const executorTask = makeTask({
      id: "task-executor",
      participants: [{ userId: "usr-1", role: "executor" }],
      title: "Executor task"
    });
    const observerTask = makeTask({
      id: "task-observer",
      participants: [{ userId: "usr-1", role: "observer" }],
      title: "Observer task"
    });
    const approverTask = makeTask({
      id: "task-approver",
      participants: [{ userId: "usr-1", role: "approver" }],
      title: "Approver task"
    });

    await renderRuntimeMyWork([executorTask, observerTask, approverTask], {
      currentUserId: "usr-1",
      initialMode: "kanban",
      onMoveTaskStatus: async () => undefined
    });

    expect(host?.querySelector('[data-card-id="task-executor"]')?.getAttribute("data-dnd-active")).toBe(
      "true"
    );
    expect(host?.querySelector('[data-card-id="task-observer"]')?.getAttribute("data-dnd-active")).toBeNull();
    expect(host?.querySelector('[data-card-id="task-approver"]')?.getAttribute("data-dnd-active")).toBeNull();

    await renderRuntimeMyWork([observerTask], {
      canManageProjectTasks: true,
      currentUserId: "usr-1",
      initialMode: "kanban",
      onMoveTaskStatus: async () => undefined
    });

    expect(canTransitionTaskStatus(observerTask, "usr-1", true)).toBe(true);
    expect(host?.querySelector('[data-card-id="task-observer"]')?.getAttribute("data-dnd-active")).toBe(
      "true"
    );
  });

  it("posts comments from the runtime task drawer through the provided action", async () => {
    const comments: Array<{ body: string; taskId: string }> = [];
    await renderRuntimeMyWork(
      [makeTask({ id: "task-comment", title: "Runtime task with comments" })],
      {
        onAddTaskComment: async (input) => {
          comments.push(input);
        },
        taskActivities: [
          makeTaskActivity({
            body: "Existing runtime comment",
            id: "activity-existing",
            taskId: "task-comment"
          })
        ]
      }
    );

    const row = host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-comment"]');
    expect(row).not.toBeNull();

    await act(async () => {
      row?.click();
    });

    expect(document.body.textContent).toContain("Existing runtime comment");
    expect(document.body.textContent).not.toContain("Подготовила черновик КП");
    expect(document.body.textContent).not.toContain("Согласовать ТЗ");
    expect(document.body.textContent).not.toContain("DataHub KPI");

    const textarea = document.body.querySelector<HTMLTextAreaElement>('textarea[placeholder="Написать комментарий…"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(textarea, " Runtime drawer comment ");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      document.body.querySelector<HTMLButtonElement>(".feed__compose-actions button")?.click();
    });

    expect(comments).toEqual([{ body: "Runtime drawer comment", taskId: "task-comment" }]);
  });

  it("exposes a runtime status action in the task drawer when project task management is allowed", async () => {
    await renderRuntimeMyWork([makeTask({ id: "task-status-action", title: "Runtime status task" })], {
      canManageProjectTasks: true,
      onMoveTaskStatus: async () => undefined,
      taskStatuses: [
        makeTaskStatus({ id: "task-status-in-progress", category: "in_progress", status: "active", sortOrder: 2 }),
        makeTaskStatus({ id: "task-status-review", category: "review", status: "active", sortOrder: 3 })
      ]
    });

    await act(async () => {
      host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-status-action"]')?.click();
    });

    expect(
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Статус задачи Runtime status task"]')
    ).not.toBeNull();
    expect(document.body.textContent).not.toContain("Согласовать ТЗ");
    expect(document.body.textContent).not.toContain("DataHub KPI");
  });

  it("exposes owner and due actions in the runtime task drawer only for project managers", async () => {
    const updates: Array<{
      taskId: string;
      fields: { dueDate?: string | undefined; ownerUserId?: string | undefined };
    }> = [];
    const task = makeTask({ id: "task-fields", title: "Runtime task fields" });

    await renderRuntimeMyWork([task], {
      canManageProjectTasks: false,
      onUpdateTaskFields: async (updatedTask, fields) => {
        updates.push({ fields, taskId: updatedTask.id });
      },
      workspaceUsers: makeWorkspaceUsers()
    });

    await act(async () => {
      host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-fields"]')?.click();
    });

    expect(document.body.textContent).toContain("Ответственного и срок меняет руководитель проекта.");
    expect(document.body.querySelector('input[aria-label="Срок задачи Runtime task fields"]')).toBeNull();

    await renderRuntimeMyWork([task], {
      canManageProjectTasks: true,
      onUpdateTaskFields: async (updatedTask, fields) => {
        updates.push({ fields, taskId: updatedTask.id });
      },
      workspaceUsers: makeWorkspaceUsers()
    });

    await act(async () => {
      host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-fields"]')?.click();
    });

    const dueInput = document.body.querySelector<HTMLInputElement>('input[aria-label="Срок задачи Runtime task fields"]');
    expect(dueInput).not.toBeNull();

    await act(async () => {
      if (!dueInput) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(dueInput, "2026-06-09");
      dueInput.dispatchEvent(new Event("input", { bubbles: true }));
      dueInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(updates).toContainEqual({ fields: { dueDate: "2026-06-09" }, taskId: "task-fields" });
  });

  it("shows the blocker action as an explicit data-contract gap instead of a fake mutation", async () => {
    const updates: Array<{ taskId: string }> = [];
    const task = makeTask({ id: "task-blocker-gap", title: "Runtime blocker gap" });

    await renderRuntimeMyWork([task], {
      canManageProjectTasks: true,
      onUpdateTaskFields: async (updatedTask) => {
        updates.push({ taskId: updatedTask.id });
      }
    });

    await act(async () => {
      host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-blocker-gap"]')?.click();
    });

    const blockerButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Блокер задачи Runtime blocker gap"]'
    );
    expect(blockerButton).not.toBeNull();
    expect(blockerButton?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Причина блокера не хранится в текущих данных; для внимания используйте статус «Ожидает»."
    );

    await act(async () => {
      blockerButton?.click();
    });
    expect(updates).toEqual([]);

    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]')?.click();
    });

    const waitingTask = {
      ...makeTask({ id: "task-blocker-waiting", title: "Runtime waiting blocker" }),
      status: "waiting" as const,
      statusCategory: "waiting" as const,
      statusId: "task-status-waiting",
      statusName: "Ожидает"
    };

    await renderRuntimeMyWork([waitingTask], { canManageProjectTasks: true });
    await act(async () => {
      host?.querySelector<HTMLElement>('tr[aria-label="Открыть карточку task-blocker-waiting"]')?.click();
    });

    expect(document.body.textContent).toContain("Ожидает: задача уже попадает во внимание.");
  });

  async function renderRuntimeMyWork(
    tasks: Task[],
    options: {
      canManageProjectTasks?: boolean;
      currentUserId?: string;
      initialMode?: "kanban" | "list";
      initialOpenTaskId?: string;
      onAddTaskComment?: (input: { body: string; taskId: string }) => Promise<unknown> | void;
      onUpdateTaskFields?: (
        task: Task,
        fields: { dueDate?: string | undefined; ownerUserId?: string | undefined }
      ) => Promise<unknown> | void;
      onMoveTaskStatus?: (input: { projectId: string; taskId: string; statusId: string }) => Promise<unknown>;
      scheduledTasks?: ScheduledTask[];
      taskActivities?: TaskActivity[];
      taskStatuses?: TaskStatus[];
      workspaceUsers?: WorkspaceUser[];
    } = {}
  ) {
    if (!host) {
      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
    }

    await act(async () => {
      root?.render(
        <ScreenRouteProvider meta={getScreenRoute("02-my-work")}>
          <RuntimeMyWorkBlock
            initialMode={options.initialMode ?? "list"}
            initialOpenTaskId={options.initialOpenTaskId}
            readOnly
            scheduledTasks={options.scheduledTasks ?? []}
            taskActivities={options.taskActivities ?? []}
            taskStatuses={options.taskStatuses ?? []}
            tasks={tasks}
            workspaceUsers={options.workspaceUsers ?? []}
            currentUserId={options.currentUserId}
            canManageProjectTasks={options.canManageProjectTasks ?? false}
            {...(options.onAddTaskComment ? { onAddTaskComment: options.onAddTaskComment } : {})}
            {...(options.onUpdateTaskFields ? { onUpdateTaskFields: options.onUpdateTaskFields } : {})}
            {...(options.onMoveTaskStatus ? { onMoveTaskStatus: options.onMoveTaskStatus } : {})}
          />
        </ScreenRouteProvider>
      );
    });
  }
});

function makeTask({
  id,
  participants = [{ userId: "usr-1", role: "executor" }],
  title
}: {
  id: string;
  participants?: Task["participants"];
  title: string;
}): Task {
  return {
    id,
    tenantId: "tenant-1",
    projectId: "project-1",
    stageId: null,
    title,
    description: null,
    status: "in_progress",
    statusId: "task-status-in-progress",
    statusName: "В работе",
    statusCategory: "in_progress",
    priority: "normal",
    requesterUserId: "usr-1",
    ownerUserId: "usr-1",
    plannedStart: "2026-05-30T00:00:00.000Z",
    plannedFinish: "2026-05-31T00:00:00.000Z",
    durationWorkingDays: 1,
    plannedWork: 60,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    archivedAt: null,
    participants
  };
}

function makeScheduledTask({
  plannedStart,
  plannedFinish,
  workMinutes
}: {
  plannedStart: string;
  plannedFinish: string;
  workMinutes: number;
}): ScheduledTask {
  return {
    id: "scheduled-task-1",
    title: "Runtime scheduled task",
    projectId: "project-1",
    projectTitle: "Runtime project",
    plannedStart,
    plannedFinish,
    workMinutes,
    createdAt: `${plannedStart}T00:00:00.000Z`,
    statusId: "task-status-in-progress"
  };
}

function makeWorkspaceUsers(): WorkspaceUser[] {
  return [
    {
      id: "usr-1",
      tenantId: "tenant-1",
      name: "Runtime User",
      accessProfileId: "access-profile-1",
      email: "runtime.user@example.test",
      positionId: null,
      positionName: null,
      phone: null,
      status: "active",
      telegram: null,
      theme: "system",
      accentColor: "blue"
    },
    {
      id: "usr-2",
      tenantId: "tenant-1",
      name: "Runtime Lead",
      accessProfileId: "access-profile-1",
      email: "runtime.lead@example.test",
      positionId: null,
      positionName: null,
      phone: null,
      status: "active",
      telegram: null,
      theme: "system",
      accentColor: "blue"
    }
  ];
}

function makeTaskActivity({
  body,
  id,
  taskId
}: {
  body: string;
  id: string;
  taskId: string;
}): TaskActivity {
  return {
    id,
    tenantId: "tenant-1",
    taskId,
    type: "comment",
    body,
    title: null,
    fileUrl: null,
    fileSizeBytes: null,
    mimeType: null,
    authorUserId: "usr-1",
    createdAt: "2026-05-30T10:00:00.000Z",
    updatedAt: "2026-05-30T10:00:00.000Z"
  };
}

function makeTaskStatus({
  id,
  category,
  status,
  sortOrder
}: {
  id: string;
  category: "new" | "waiting" | "in_progress" | "review" | "done";
  status: "active" | "archived";
  sortOrder: number;
}) {
  return {
    id,
    tenantId: "tenant-1",
    name: id,
    category,
    sortOrder,
    status,
    isSystem: true,
    createdAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z"
  };
}

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
