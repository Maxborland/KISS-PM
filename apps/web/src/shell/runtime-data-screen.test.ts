// @vitest-environment happy-dom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RuntimeDataScreen, canOpenStaticRuntimeScreen } from "@/shell/runtime-data-screen";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const readModelHooks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  deals: vi.fn(),
  myWork: vi.fn(),
  projects: vi.fn(),
  confirmWorkspaceAgentProposal: vi.fn(),
  postWorkspaceAgentMessage: vi.fn()
}));

vi.mock("@/lib/api/read-models", () => ({
  confirmWorkspaceAgentProposal: readModelHooks.confirmWorkspaceAgentProposal,
  postWorkspaceAgentMessage: readModelHooks.postWorkspaceAgentMessage,
  useDashboardReadModelQueries: readModelHooks.dashboard,
  useDealsBoardReadModelQueries: readModelHooks.deals,
  useMyWorkReadModelQueries: readModelHooks.myWork,
  useProjectsListReadModelQuery: readModelHooks.projects
}));

vi.mock("@/shell/runtime-dashboard-screen", () => ({
  RuntimeDashboardScreen: ({
    data,
    onConfirmWorkspaceAgentAction,
    onSendWorkspaceAgentMessage
  }: {
    data: {
      tasks: { title: string }[];
      workspaceAgentThread?: { messages: { body: string }[]; proposals?: { id: string; title: string }[] };
    };
    onConfirmWorkspaceAgentAction?: (proposalId: string, decision: "apply" | "reject") => Promise<unknown>;
    onSendWorkspaceAgentMessage?: (body: string) => Promise<unknown>;
  }) =>
    createElement(
      "button",
      {
        "data-testid": "runtime-dashboard",
        onClick: () => {
          void onSendWorkspaceAgentMessage?.("Что горит?");
          void onConfirmWorkspaceAgentAction?.("proposal-runtime", "apply");
        }
      },
      [
        data.tasks.map((task) => task.title).join(", "),
        data.workspaceAgentThread?.messages.map((message) => message.body).join(", "),
        data.workspaceAgentThread?.proposals?.map((proposal) => proposal.title).join(", ")
      ].join(" ")
    )
}));

vi.mock("@/views/blocks/my-work-block", () => ({
  RuntimeMyWorkBlock: ({
    readOnly,
    tasks
  }: {
    readOnly?: boolean;
    tasks: { title: string }[];
  }) =>
    createElement(
      "div",
      { "data-testid": "runtime-my-work", "data-read-only": String(readOnly) },
      tasks.map((task) => task.title).join(", ")
    )
}));

vi.mock("@/views/layout/workspace-chrome", () => ({
  WorkspaceChrome: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "workspace-chrome" }, children)
}));

vi.mock("@/views/screens/screen-view", () => ({
  ScreenView: () => createElement("div", { "data-testid": "fixture-screen" }, "fixture fallback")
}));

describe("RuntimeDataScreen permission gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readModelHooks.dashboard.mockReturnValue(
      successReadModel({
        projects: [],
        tasks: [],
        scheduledTasks: [],
        workspaceAgentThread: { context: {}, messages: [], proposals: [] }
      })
    );
    readModelHooks.deals.mockReturnValue(successReadModel({ opportunities: [], dealStages: [] }));
    readModelHooks.myWork.mockReturnValue(successReadModel({ tasks: [], scheduledTasks: [] }));
    readModelHooks.projects.mockReturnValue({ data: { projects: [] }, error: null, isPending: false, isFetching: false });
    readModelHooks.postWorkspaceAgentMessage.mockResolvedValue({ context: {}, messages: [], proposals: [] });
    readModelHooks.confirmWorkspaceAgentProposal.mockResolvedValue({ context: {}, messages: [], proposals: [] });
  });

  it("blocks static admin, settings and catalog screens for project-only users", () => {
    const permissions = ["tenant.projects.read"];

    expect(canOpenStaticRuntimeScreen("09-admin", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("10-settings", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("08-entities-clients", permissions)).toBe(false);
  });

  it("allows static runtime screens when the matching read permission is present", () => {
    expect(canOpenStaticRuntimeScreen("09-admin", ["tenant.users.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("10-settings", ["tenant.workspace_config.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("08-entities-clients", ["tenant.clients.read"])).toBe(true);
  });

  it("requires project read access for dashboard and my work runtime routes", () => {
    expect(canOpenStaticRuntimeScreen("01-dashboard", [])).toBe(false);
    expect(canOpenStaticRuntimeScreen("02-my-work", [])).toBe(false);
    expect(canOpenStaticRuntimeScreen("01-dashboard", ["tenant.projects.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("02-my-work", ["tenant.projects.read"])).toBe(true);
  });

  it("renders dashboard from runtime read models without fixture fallback", async () => {
    readModelHooks.dashboard.mockReturnValue(
      successReadModel({
        projects: [],
        tasks: [{ id: "task-runtime", title: "Runtime dashboard task" }],
        scheduledTasks: [],
        workspaceAgentThread: {
          context: {},
          messages: [{ id: "agent-runtime", body: "Runtime agent message" }],
          proposals: [{ id: "proposal-runtime", title: "Runtime proposal" }]
        }
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "01-dashboard",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime dashboard task");
    expect(host.textContent).toContain("Runtime agent message");
    expect(host.textContent).toContain("Runtime proposal");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.dashboard).toHaveBeenCalledWith({ assigneeUserId: "usr-1" });
  });

  it("sends dashboard agent messages through the runtime workspace agent API", async () => {
    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "01-dashboard",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    await act(async () => {
      host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(readModelHooks.postWorkspaceAgentMessage).toHaveBeenCalled();
    expect(readModelHooks.postWorkspaceAgentMessage.mock.calls[0]?.[0]).toBe("Что горит?");
    expect(readModelHooks.confirmWorkspaceAgentProposal).toHaveBeenCalledWith(
      { proposalId: "proposal-runtime", decision: "apply" },
      expect.anything()
    );
  });

  it("renders my work from runtime read models without fixture fallback", async () => {
    readModelHooks.myWork.mockReturnValue(
      successReadModel({
        tasks: [{ id: "task-runtime", title: "Runtime my work task" }],
        scheduledTasks: []
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "02-my-work",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime my work task");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.myWork).toHaveBeenCalledWith({ assigneeUserId: "usr-1" });
  });
});

function successReadModel<T>(data: T) {
  return {
    data,
    error: null,
    isPending: false,
    isFetching: false,
    refetchAll: vi.fn()
  };
}

async function renderRuntime(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, element));
  });

  return host;
}
