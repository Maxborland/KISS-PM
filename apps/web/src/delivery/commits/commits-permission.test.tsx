/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCommits } from "./commits-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TestCommitsView = {
  commits: Array<{
    auditEventId: string;
    actionType: string;
    version: number;
    at: string;
    summary: string;
    changedTaskIds: string[];
    revertible: boolean;
  }>;
  latestRevert: {
    auditEventId: string;
    before: { authored: { tasks: unknown[] } };
    commands: unknown[];
  } | null;
};

let permissions: string[] = [];
const revertLast = vi.fn(async () => ({ ok: false, message: "nothing_to_revert" }));
const loadCommits = vi.fn<() => Promise<TestCommitsView>>(async () => ({
  commits: [{
    auditEventId: "audit-1",
    actionType: "planning.task.updated",
    version: 2,
    at: "2026-07-10T00:00:00.000Z",
    summary: "Изменено название задачи",
    changedTaskIds: ["task-1"],
    revertible: true
  }],
  latestRevert: {
    auditEventId: "audit-1",
    before: { authored: { tasks: [] } },
    commands: []
  }
}));
const readModel = {
  project: {},
  authored: { tasks: [{ id: "task-1", wbsCode: "1", title: "Task" }] },
  planVersion: 2
};

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel,
    status: "ready",
    error: null,
    reload: vi.fn(),
    applyBatch: vi.fn(),
    revertLast,
    loadCommits
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({}),
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

async function renderCommits(): Promise<{ root: Root; host: HTMLDivElement }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<ProjectCommits projectId="project" />));
  await act(async () => Promise.resolve());
  return { root, host };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("commit permission controls", () => {
  beforeEach(() => {
    permissions = [];
    revertLast.mockClear();
    loadCommits.mockReset();
    loadCommits.mockImplementation(async () => ({
      commits: [{
        auditEventId: "audit-1",
        actionType: "planning.task.updated",
        version: 2,
        at: "2026-07-10T00:00:00.000Z",
        summary: "Изменено название задачи",
        changedTaskIds: ["task-1"],
        revertible: true
      }],
      latestRevert: {
        auditEventId: "audit-1",
        before: { authored: { tasks: [] } },
        commands: []
      }
    }));
  });

  it("keeps history readable and exposes revert only with project plan manage", async () => {
    permissions = ["tenant.project_plan.read"];
    const readOnly = await renderCommits();

    expect(readOnly.host.textContent).toContain("Изменено название задачи");
    expect(readOnly.host.textContent).not.toContain("Откатить последний");
    expect(readOnly.host.textContent).not.toContain("Откатить коммит");
    expect(revertLast).not.toHaveBeenCalled();
    await act(async () => readOnly.root.unmount());

    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];
    const manager = await renderCommits();
    const revertButton = [...manager.host.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Откатить последний")
    );

    expect(revertButton).toBeDefined();
    await act(async () => revertButton?.click());
    expect(revertLast).toHaveBeenCalledTimes(1);
    expect(revertLast).toHaveBeenCalledWith("audit-1");
    await act(async () => manager.root.unmount());
  });

  it("shows a load error and retries commit history", async () => {
    loadCommits
      .mockRejectedValueOnce(new Error("audit_history_unavailable"))
      .mockImplementationOnce(async () => ({
        commits: [{
          auditEventId: "audit-retry",
          actionType: "planning.task.updated",
          version: 3,
          at: "2026-07-10T01:00:00.000Z",
          summary: "История загружена после повтора",
          changedTaskIds: [],
          revertible: false
        }],
        latestRevert: null
      }));

    const rendered = await renderCommits();

    expect(rendered.host.textContent).toContain("audit_history_unavailable");

    const retryButton = [...rendered.host.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Повторить")
    );
    expect(retryButton).toBeDefined();

    await act(async () => retryButton?.click());
    expect(loadCommits).toHaveBeenCalledTimes(2);
    expect(rendered.host.textContent).toContain("История загружена после повтора");
    await act(async () => rendered.root.unmount());
  });

  it("ignores an older commit-history response after the project changes", async () => {
    const first = deferred<Awaited<ReturnType<typeof loadCommits>>>();
    const second = deferred<Awaited<ReturnType<typeof loadCommits>>>();
    loadCommits.mockReset();
    loadCommits.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const rendered = await renderCommits();
    await act(async () => {
      rendered.root.render(<ProjectCommits projectId="project-2" />);
    });
    expect(loadCommits).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve({
        commits: [{
          auditEventId: "audit-new",
          actionType: "planning.task.updated",
          version: 4,
          at: "2026-07-10T02:00:00.000Z",
          summary: "Новая история",
          changedTaskIds: [],
          revertible: false
        }],
        latestRevert: null
      });
      await second.promise;
    });
    expect(rendered.host.textContent).toContain("Новая история");

    await act(async () => {
      first.resolve({
        commits: [{
          auditEventId: "audit-old",
          actionType: "planning.task.updated",
          version: 3,
          at: "2026-07-10T01:00:00.000Z",
          summary: "Устаревшая история",
          changedTaskIds: [],
          revertible: false
        }],
        latestRevert: null
      });
      await first.promise;
    });
    expect(rendered.host.textContent).toContain("Новая история");
    expect(rendered.host.textContent).not.toContain("Устаревшая история");
    await act(async () => rendered.root.unmount());
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
