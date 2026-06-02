// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ScheduledTask, Task } from "@/lib/api-types";
import { RuntimeMyWorkBlock, resolveTaskStatusIdForColumn } from "@/views/blocks/my-work-block";
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

  async function renderRuntimeMyWork(
    tasks: Task[],
    options: {
      initialMode?: "kanban" | "list";
      initialOpenTaskId?: string;
      scheduledTasks?: ScheduledTask[];
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
            tasks={tasks}
          />
        </ScreenRouteProvider>
      );
    });
  }
});

function makeTask({ id, title }: { id: string; title: string }): Task {
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
    participants: [{ userId: "usr-1", role: "executor" }]
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
