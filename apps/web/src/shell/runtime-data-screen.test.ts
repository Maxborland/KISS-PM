// @vitest-environment happy-dom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import { RuntimeDataScreen, canOpenStaticRuntimeScreen } from "@/shell/runtime-data-screen";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const readModelHooks = vi.hoisted(() => ({
  agent: vi.fn(),
  dashboard: vi.fn(),
  deals: vi.fn(),
  myWork: vi.fn(),
  projectDetail: vi.fn(),
  projects: vi.fn(),
  projectsBlock: vi.fn(),
  confirmWorkspaceAgentProposal: vi.fn(),
  postWorkspaceAgentMessage: vi.fn()
}));

vi.mock("@/lib/api/read-models", () => ({
  confirmWorkspaceAgentProposal: readModelHooks.confirmWorkspaceAgentProposal,
  postWorkspaceAgentMessage: readModelHooks.postWorkspaceAgentMessage,
  useAgentCockpitReadModelQuery: readModelHooks.agent,
  useDashboardReadModelQueries: readModelHooks.dashboard,
  useDealsBoardReadModelQueries: readModelHooks.deals,
  useMyWorkReadModelQueries: readModelHooks.myWork,
  useProjectDetailReadModelQuery: readModelHooks.projectDetail,
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
    initialOpenTaskId,
    readOnly,
    tasks
  }: {
    initialOpenTaskId?: string;
    readOnly?: boolean;
    tasks: { title: string }[];
  }) =>
    createElement(
      "div",
      {
        "data-initial-open-task-id": initialOpenTaskId ?? "",
        "data-testid": "runtime-my-work",
        "data-read-only": String(readOnly)
      },
      tasks.map((task) => task.title).join(", ")
    )
}));

vi.mock("@/views/blocks/projects-list-block", () => ({
  ProjectsListBlock: ({
    getProjectHref,
    projectTemplates,
    projects,
    readOnly
  }: {
    getProjectHref?: (project: { id: string }) => string;
    projectTemplates: { tenantLabel?: string }[];
    projects: { id: string; title?: string }[];
    readOnly?: boolean;
  }) => {
    readModelHooks.projectsBlock({ getProjectHref, projectTemplates, projects, readOnly });
    return createElement(
      "div",
      {
        "data-testid": "runtime-projects",
        "data-read-only": String(readOnly)
      },
      [
        projects.map((project) => project.title).join(", "),
        projectTemplates.map((template) => template.tenantLabel).join(", ")
      ].join(" ")
    );
  }
}));

vi.mock("@/views/blocks/project-detail-block", () => ({
  ProjectDetailBlock: ({
    project,
    readOnly,
    tasks
  }: {
    project: { title?: string };
    readOnly?: boolean;
    tasks: { title?: string }[];
  }) =>
    createElement(
      "div",
      {
        "data-testid": "runtime-project-detail",
        "data-read-only": String(readOnly)
      },
      [project.title, tasks.map((task) => task.title).join(", ")].join(" ")
    )
}));

vi.mock("@/views/layout/workspace-chrome", () => ({
  WorkspaceChrome: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "workspace-chrome" }, children)
}));

vi.mock("@/views/layout/route-page-intro", () => ({
  RoutePageIntro: ({ lead }: { lead?: string }) =>
    createElement("p", { "data-testid": "route-page-intro" }, lead)
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
    readModelHooks.agent.mockReturnValue(
      {
        data: {
          operationsCockpit: emptyOperationsCockpit(),
          workspaceAgentThread: { context: {}, messages: [], proposals: [] }
        },
        error: null,
        isPending: false,
        isFetching: false,
        refetch: vi.fn()
      }
    );
    readModelHooks.myWork.mockReturnValue(successReadModel({ tasks: [], scheduledTasks: [] }));
    readModelHooks.projects.mockReturnValue(
      successReadModel({
        projects: [],
        projectTemplates: []
      })
    );
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: { id: "project-runtime", title: "Runtime project detail" },
        tasks: []
      })
    );
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

  it("does not fall back to fixture screens for non-beta runtime routes", async () => {
    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "10-settings",
        permissions: ["tenant.workspace_config.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Раздел не включён в beta");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.dashboard).not.toHaveBeenCalled();
    expect(readModelHooks.projects).not.toHaveBeenCalled();
    expect(readModelHooks.deals).not.toHaveBeenCalled();
  });

  it("requires project read access for dashboard and my work runtime routes", () => {
    expect(canOpenStaticRuntimeScreen("01-dashboard", [])).toBe(false);
    expect(canOpenStaticRuntimeScreen("20-agent-cockpit", [])).toBe(false);
    expect(canOpenStaticRuntimeScreen("02-my-work", [])).toBe(false);
    expect(canOpenStaticRuntimeScreen("01-dashboard", ["tenant.projects.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("20-agent-cockpit", ["tenant.projects.read"])).toBe(true);
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

  it("renders the /agent cockpit from the workspace agent thread API", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    readModelHooks.agent.mockReturnValue(
      {
        data: {
          operationsCockpit: {
            ...emptyOperationsCockpit(),
            indicators: {
              ...emptyOperationsCockpit().indicators,
              activeProjects: 2,
              overdueTasks: 1,
              criticalTasks: 1,
              openDeals: 3
            },
            attentionItems: [
              {
                id: "attention-runtime",
                kind: "task_overdue",
                severity: "critical",
                title: "Просрочен авторский надзор",
                reason: "Плановая дата завершения задачи уже прошла.",
                entity: { type: "task", id: "task-attention", title: "Просрочен авторский надзор" },
                projectId: "project-1",
                ownerUserId: "usr-1",
                dueDate: "2026-05-30"
              }
            ]
          },
          workspaceAgentThread: {
            context: {},
            messages: [
              {
                authorUserId: "usr-1",
                body: "Что требует внимания сегодня?",
                context: {},
                createdAt: "2026-06-01T00:00:00.000Z",
                id: "agent-message"
              }
            ],
            proposals: [
              {
                actionType: "workspace.agent.create_task",
                auditEventId: null,
                context: {},
                createdAt: "2026-06-01T00:01:00.000Z",
                description: "Создать задачу восстановления срока.",
                id: "agent-proposal",
                messageId: "agent-message",
                payload: { task: { title: "Проверить риски портфеля" } },
                resolvedAt: null,
                status: "proposed",
                title: "Создать задачу"
              }
            ]
          }
        },
        error: null,
        isPending: false,
        isFetching: false,
        refetch: vi.fn()
      }
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "20-agent-cockpit",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Единый управленческий центр");
    expect(host.textContent).toContain("Контекст агента");
    expect(host.textContent).toContain("2 активных проектов");
    expect(host.textContent).toContain("Просрочен авторский надзор");
    expect(host.textContent).toContain("Что требует внимания сегодня?");
    expect(host.textContent).toContain("Сверка изменений");
    expect(host.textContent).toContain("Будет создана задача: Проверить риски портфеля");
    expect(host.textContent).toContain("Перед применением нужна явная сверка пользователя.");

    await act(async () => {
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Применить"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(readModelHooks.confirmWorkspaceAgentProposal).toHaveBeenCalledWith(
      { proposalId: "agent-proposal", decision: "apply" },
      expect.anything()
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.workspaceAgentThread });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.projects });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.myWork("usr-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
    invalidateSpy.mockRestore();
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

  it("renders projects from runtime projects and project templates without fixture fallback", async () => {
    readModelHooks.projects.mockReturnValue(
      successReadModel({
        projects: [{ id: "project-runtime", title: "Runtime architecture project" }],
        projectTemplates: [{ id: "template-runtime", tenantLabel: "Runtime template" }]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07-projects-list",
        permissions: ["tenant.projects.read"]
      })
    );

    expect(host.textContent).toContain("Runtime architecture project");
    expect(host.textContent).toContain("Runtime template");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.projectsBlock).toHaveBeenCalledWith({
      getProjectHref: expect.any(Function),
      projects: [{ id: "project-runtime", title: "Runtime architecture project" }],
      projectTemplates: [{ id: "template-runtime", tenantLabel: "Runtime template" }],
      readOnly: true
    });
    expect(readModelHooks.projectsBlock.mock.calls[0]?.[0].getProjectHref({ id: "project-runtime" })).toBe(
      "/projects/project-runtime"
    );
  });

  it("keeps runtime projects explicit when project templates are unavailable", async () => {
    readModelHooks.projects.mockReturnValue(
      successReadModel({
        projects: [{ id: "project-runtime", title: "Runtime project without templates" }],
        projectTemplates: []
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07-projects-list",
        permissions: ["tenant.projects.read"]
      })
    );

    expect(host.textContent).toContain("Runtime project without templates");
    expect(readModelHooks.projectsBlock).toHaveBeenCalledWith({
      getProjectHref: expect.any(Function),
      projects: [{ id: "project-runtime", title: "Runtime project without templates" }],
      projectTemplates: [],
      readOnly: true
    });
  });

  it("renders project detail from the runtime project read model", async () => {
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: { id: "project-runtime", title: "Runtime project detail" },
        tasks: [{ id: "task-runtime", title: "Runtime task detail" }]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07b-project-detail",
        projectId: "project-runtime",
        permissions: ["tenant.projects.read"]
      })
    );

    expect(host.textContent).toContain("Runtime project detail");
    expect(host.textContent).toContain("Runtime task detail");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.projectDetail).toHaveBeenCalledWith("project-runtime");
  });

  it("shows not-found state for unknown runtime project ids", async () => {
    readModelHooks.projectDetail.mockReturnValue(
      successQuery(undefined, {
        error: new ApiError(404, "not_found", "project_not_found", {
          error: "project_not_found"
        })
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07b-project-detail",
        projectId: "project-missing",
        permissions: ["tenant.projects.read"]
      })
    );

    expect(host.textContent).toContain("Проект не найден");
  });

  it("passes the agent task deep link into runtime my work", async () => {
    readModelHooks.myWork.mockReturnValue(
      successReadModel({
        tasks: [{ id: "task-agent-result", title: "Runtime task from agent" }],
        scheduledTasks: []
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "02-my-work",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1",
        initialTaskId: "task-agent-result"
      })
    );

    expect(host.querySelector("[data-testid='runtime-my-work']")?.getAttribute("data-initial-open-task-id")).toBe(
      "task-agent-result"
    );
    expect(host.textContent).toContain("Runtime task from agent");
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

function successQuery<T>(
  data: T,
  overrides: Partial<{
    data: T;
    error: unknown;
    isPending: boolean;
    isFetching: boolean;
    refetch: ReturnType<typeof vi.fn>;
  }> = {}
) {
  return {
    data,
    error: null,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides
  };
}

function emptyOperationsCockpit() {
  return {
    generatedAt: "2026-06-01T00:00:00.000Z",
    scope: { type: "workspace", tenantId: "tenant-alpha" },
    indicators: {
      activeProjects: 0,
      overdueProjects: 0,
      activeTasks: 0,
      overdueTasks: 0,
      waitingTasks: 0,
      criticalTasks: 0,
      openDeals: 0,
      readyToActivateDeals: 0
    },
    attentionItems: [],
    workloadHints: { byPerson: [] },
    pipelinePressure: { deals: [] },
    agentContext: {
      contextType: "operations_cockpit",
      focus: { type: "workspace", tenantId: "tenant-alpha" },
      generatedAt: "2026-06-01T00:00:00.000Z",
      sourceEntityTypes: ["Project", "Task", "Opportunity", "TenantUser"],
      unavailableSources: []
    }
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
