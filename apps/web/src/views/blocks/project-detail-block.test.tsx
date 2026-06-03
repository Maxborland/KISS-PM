// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { Project, Task, TaskStatus, WorkspaceUser } from "@/lib/api-types";
import { ProjectDetailBlock } from "@/views/blocks/project-detail-block";
import { ScreenRouteProvider } from "@/views/layout/screen-route-context";
import { getScreenRoute } from "@/views/screens/screen-route";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ProjectDetailBlock", () => {
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

  it("shows blocker state through the status model instead of a fake blocker mutation", async () => {
    await renderProjectDetail({
      taskStatuses: [
        makeTaskStatus("task-status-in-progress", "В работе", "in_progress", 1),
        makeTaskStatus("task-status-waiting", "Ожидает", "waiting", 2)
      ],
      tasks: [
        makeTask({
          id: "task-active",
          status: "in_progress",
          statusId: "task-status-in-progress",
          statusName: "В работе",
          title: "Активная задача"
        }),
        makeTask({
          id: "task-waiting",
          status: "waiting",
          statusId: "task-status-waiting",
          statusName: "Ожидает",
          title: "Задача с блокером"
        })
      ],
      workspaceUsers: [makeWorkspaceUser("usr-1", "Анна Архитектор")]
    });

    expect(host?.textContent).toContain("Блокер: используйте статус «Ожидает».");
    expect(host?.textContent).toContain("Блокер: задача уже во внимании.");
  });

  async function renderProjectDetail({
    taskStatuses,
    tasks,
    workspaceUsers
  }: {
    taskStatuses: TaskStatus[];
    tasks: Task[];
    workspaceUsers: WorkspaceUser[];
  }) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <ScreenRouteProvider meta={getScreenRoute("07b-project-detail")}>
          <ProjectDetailBlock
            currentUserId="usr-1"
            project={makeProject()}
            readOnly
            taskStatuses={taskStatuses}
            tasks={tasks}
            workspaceUsers={workspaceUsers}
            onChangeTaskStatus={async () => undefined}
          />
        </ScreenRouteProvider>
      );
    });
  }
});

function makeProject(): Project {
  return {
    id: "project-1",
    tenantId: "tenant-1",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: "client-1",
    projectTypeId: null,
    title: "Школа на Неве",
    clientName: "Администрация района",
    status: "active",
    plannedStart: "2026-05-01T00:00:00.000Z",
    plannedFinish: "2026-07-01T00:00:00.000Z",
    contractValue: 12_000_000,
    plannedHours: 1200,
    templateId: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    activatedAt: "2026-05-01T00:00:00.000Z",
    demand: []
  };
}

function makeTask({
  id,
  status,
  statusId,
  statusName,
  title
}: {
  id: string;
  status: Task["status"];
  statusId: string;
  statusName: string;
  title: string;
}): Task {
  return {
    id,
    tenantId: "tenant-1",
    projectId: "project-1",
    stageId: null,
    title,
    description: null,
    status,
    statusId,
    statusName,
    statusCategory: status,
    priority: "normal",
    requesterUserId: "usr-1",
    ownerUserId: "usr-1",
    plannedStart: "2026-05-10T00:00:00.000Z",
    plannedFinish: "2026-05-12T00:00:00.000Z",
    durationWorkingDays: 2,
    plannedWork: 16,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    archivedAt: null,
    participants: [{ userId: "usr-1", role: "executor" }]
  };
}

function makeTaskStatus(
  id: string,
  name: string,
  category: TaskStatus["category"],
  sortOrder: number
): TaskStatus {
  return {
    id,
    tenantId: "tenant-1",
    name,
    category,
    sortOrder,
    status: "active",
    isSystem: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  };
}

function makeWorkspaceUser(id: string, name: string): WorkspaceUser {
  return {
    id,
    tenantId: "tenant-1",
    name,
    accessProfileId: "access-profile-1",
    email: `${id}@example.test`,
    positionId: null,
    positionName: null,
    phone: null,
    status: "active",
    telegram: null,
    theme: "system",
    accentColor: "blue"
  };
}
