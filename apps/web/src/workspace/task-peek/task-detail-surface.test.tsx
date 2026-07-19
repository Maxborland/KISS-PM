// @vitest-environment happy-dom

import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskDetailResponse, TaskRecord } from "@/workspace/lib/workspace-client";
import { TaskDetailSurface } from "./task-detail-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const harness = vi.hoisted(() => ({
  data: null as TaskDetailResponse | null
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));
vi.mock("@/delivery/ui/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("@/components/domain/surface-state", () => ({
  SurfaceState: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("@/components/domain/form-dialog", () => ({
  FormDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>
}));
vi.mock("./task-peek", () => ({
  taskPeekRecordFromWorkspace: (task: TaskRecord) => task,
  TaskPeekDetails: () => null
}));
vi.mock("@/workspace/lib/use-workspace", () => ({
  useTaskDetail: () => ({
    data: harness.data,
    status: "ready",
    error: null,
    reload: vi.fn(),
    notFound: false,
    updateTask: vi.fn(),
    createComment: vi.fn()
  })
}));

const task = {
  id: "task-detail-1",
  projectId: "proj-detail-1",
  title: "Согласовать требования",
  plannedWork: 40,
  updatedAt: "2026-07-01T00:00:00.000Z"
} as TaskRecord;

const detail = (projectName: string | null): TaskDetailResponse => ({
  task,
  projectId: "proj-detail-1",
  projectName,
  activities: [],
  attachmentItems: []
});

describe("TaskDetailSurface navigation", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("links the task to its project page and back to «Мои задачи»", async () => {
    harness.data = detail("Производственный портал");
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));

    const projectLink = document.querySelector('a[href="/projects/proj-detail-1"]');
    expect(projectLink?.textContent).toBe("Производственный портал");

    const myWorkLink = document.querySelector('a[href="/my-work"]');
    expect(myWorkLink?.textContent).toContain("Мои задачи");
  });

  it("keeps the project link honest when projectName is unavailable (fail-soft)", async () => {
    harness.data = detail(null);
    await act(async () => root.render(<TaskDetailSurface taskId={task.id} />));

    const projectLink = document.querySelector('a[href="/projects/proj-detail-1"]');
    expect(projectLink?.textContent).toBe("Открыть проект");
  });
});
