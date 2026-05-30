// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ScheduledTask, Task } from "@/lib/api-types";
import { RuntimeMyWorkBlock } from "@/views/blocks/my-work-block";
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

  async function renderRuntimeMyWork(
    tasks: Task[],
    options: {
      initialMode?: "kanban" | "list";
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

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
