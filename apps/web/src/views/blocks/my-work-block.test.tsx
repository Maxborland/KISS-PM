// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { Task } from "@/lib/api-types";
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

  async function renderRuntimeMyWork(tasks: Task[]) {
    if (!host) {
      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
    }

    await act(async () => {
      root?.render(
        <ScreenRouteProvider meta={getScreenRoute("02-my-work")}>
          <RuntimeMyWorkBlock
            initialMode="list"
            readOnly
            scheduledTasks={[]}
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
