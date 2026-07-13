// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyWorkTaskDeepLinkResolver } from "./my-work-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useTaskDetail = vi.fn();
const clearTaskParam = vi.fn();
const taskId = "task-outside-my-work";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(`task=${taskId}`) }));
vi.mock("@/workspace/lib/use-workspace", () => ({ useTaskDetail: (...args: unknown[]) => useTaskDetail(...args) }));
vi.mock("@/workspace/lib/url-peek", () => ({ useUrlPeekParamCleaner: () => clearTaskParam }));
vi.mock("@/workspace/task-peek/task-peek", () => ({
  taskPeekRecordFromWorkspace: (task: { id: string; title: string }) => task,
  TaskPeek: ({ task, children }: { task: { id: string }; children: React.ReactNode }) => <div data-testid="canonical-task-peek" data-task-id={task.id}>{children}</div>
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("MyWorkTaskDeepLinkResolver", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    clearTaskParam.mockReset();
    useTaskDetail.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("loads an absent task through the canonical detail hook and mounts TaskPeek", async () => {
    useTaskDetail.mockReturnValue({ data: { task: { id: taskId, title: "Внешняя задача" } }, status: "ready", notFound: false });
    await act(async () => root.render(<MyWorkTaskDeepLinkResolver tasks={[]} />));
    expect(useTaskDetail).toHaveBeenCalledWith(taskId);
    expect(document.querySelector('[data-testid="canonical-task-peek"]')?.getAttribute("data-task-id")).toBe(taskId);
  });

  it("delegates to the already rendered TaskPeek when the task is present in My Work", async () => {
    await act(async () => root.render(<MyWorkTaskDeepLinkResolver tasks={[{ id: taskId } as never]} />));
    expect(useTaskDetail).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="canonical-task-peek"]')).toBeNull();
  });

  it("clears an unavailable task parameter instead of leaving a dead URL", async () => {
    useTaskDetail.mockReturnValue({ data: null, status: "forbidden", notFound: false });
    await act(async () => root.render(<MyWorkTaskDeepLinkResolver tasks={[]} />));
    expect(clearTaskParam).toHaveBeenCalledTimes(1);
  });
});
