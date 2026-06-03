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
  adminAccessRoles: vi.fn(),
  agent: vi.fn(),
  adminUsers: vi.fn(),
  audit: vi.fn(),
  clients: vi.fn(),
  contacts: vi.fn(),
  dashboard: vi.fn(),
  deals: vi.fn(),
  myWork: vi.fn(),
  products: vi.fn(),
  projectDetail: vi.fn(),
  projects: vi.fn(),
  projectsBlock: vi.fn(),
  taskActivity: vi.fn(),
  confirmWorkspaceAgentProposal: vi.fn(),
  createWorkspaceProjectTask: vi.fn(),
  postWorkspaceAgentMessage: vi.fn(),
  postWorkspaceTaskComment: vi.fn(),
  updateWorkspaceTaskFields: vi.fn(),
  updateWorkspaceProjectTaskStatus: vi.fn()
}));

vi.mock("@/lib/api/read-models", () => ({
  confirmWorkspaceAgentProposal: readModelHooks.confirmWorkspaceAgentProposal,
  createWorkspaceProjectTask: readModelHooks.createWorkspaceProjectTask,
  postWorkspaceAgentMessage: readModelHooks.postWorkspaceAgentMessage,
  postWorkspaceTaskComment: readModelHooks.postWorkspaceTaskComment,
  updateWorkspaceTaskFields: readModelHooks.updateWorkspaceTaskFields,
  updateWorkspaceProjectTaskStatus: readModelHooks.updateWorkspaceProjectTaskStatus,
  useAgentCockpitReadModelQuery: readModelHooks.agent,
  useAdminAccessRolesReadModelQuery: readModelHooks.adminAccessRoles,
  useAdminUsersReadModelQuery: readModelHooks.adminUsers,
  useAuditEventsReadModelQuery: readModelHooks.audit,
  useClientsReadModelQuery: readModelHooks.clients,
  useContactsReadModelQuery: readModelHooks.contacts,
  useDashboardReadModelQueries: readModelHooks.dashboard,
  useDealsBoardReadModelQueries: readModelHooks.deals,
  useMyWorkReadModelQueries: readModelHooks.myWork,
  useProductsReadModelQuery: readModelHooks.products,
  useProjectDetailReadModelQuery: readModelHooks.projectDetail,
  useProjectsListReadModelQuery: readModelHooks.projects,
  useTaskActivityReadModelQuery: readModelHooks.taskActivity
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
    activityTaskId,
    currentUserId,
    onAddTaskComment,
    onCreateTask,
    onChangeTaskStatus,
    onUpdateTaskFields,
    project,
    readOnly,
    taskStatuses,
    tasks,
    taskActivities,
    workspaceUsers
  }: {
    activityTaskId?: string;
    currentUserId?: string;
    onAddTaskComment?: (input: {
      body: string;
      taskId: string;
    }) => Promise<unknown>;
    onCreateTask?: (input: {
      dueDate: string;
      ownerUserId: string;
      statusId: string;
      title: string;
    }) => Promise<unknown>;
    onChangeTaskStatus?: (task: { id: string }, statusId: string) => Promise<unknown>;
    onUpdateTaskFields?: (
      task: { id: string },
      fields: { dueDate?: string; ownerUserId?: string }
    ) => Promise<unknown>;
    project: { title?: string };
    readOnly?: boolean;
    taskActivities?: { body?: string | null; id: string }[];
    taskStatuses?: { id: string; name: string }[];
    tasks: { id: string; title?: string }[];
    workspaceUsers?: { id: string; name: string }[];
  }) =>
    createElement("div", { "data-testid": "runtime-project-detail", "data-read-only": String(readOnly) }, [
      createElement(
        "button",
        {
          key: "comment",
          "data-activity-task-id": activityTaskId ?? "",
          "data-testid": "runtime-project-comment-action",
          onClick: () =>
            void onAddTaskComment?.({
              body: "Runtime project comment",
              taskId: activityTaskId ?? tasks[0]?.id ?? "task-runtime"
            })
        },
        "comment task"
      ),
      createElement(
        "button",
        {
          key: "status",
          "data-testid": "runtime-project-status-action",
          onClick: () => {
            const firstTask = tasks[0];
            const firstStatus = taskStatuses?.[0];
            if (firstTask && firstStatus) void onChangeTaskStatus?.(firstTask, firstStatus.id);
          }
        },
        "update status"
      ),
      createElement(
        "button",
        {
          key: "fields",
          "data-testid": "runtime-project-fields-action",
          onClick: () => {
            const firstTask = tasks[0];
            if (firstTask) void onUpdateTaskFields?.(firstTask, { dueDate: "2026-06-09", ownerUserId: "usr-2" });
          }
        },
        "update fields"
      ),
      createElement(
        "button",
        {
          key: "create",
          "data-current-user-id": currentUserId ?? "",
          "data-testid": "runtime-project-create-task",
          "data-users-count": String(workspaceUsers?.length ?? 0),
          onClick: () =>
            void onCreateTask?.({
              dueDate: "2026-06-04",
              ownerUserId: workspaceUsers?.[0]?.id ?? currentUserId ?? "usr-1",
              statusId: taskStatuses?.[0]?.id ?? "task-status-new",
              title: "Runtime created task"
            })
        },
        "create task"
      ),
      [project.title, tasks.map((task) => task.title).join(", "), taskActivities?.map((activity) => activity.body).join(", ")].join(" ")
    ])
}));

vi.mock("@/views/blocks/project-timeline-block", () => ({
  ProjectTimelineBlock: ({
    data,
    project
  }: {
    data: { rows: { name: string }[] };
    project: { title?: string };
  }) =>
    createElement(
      "div",
      { "data-testid": "runtime-project-timeline" },
      [project.title, data.rows.map((row) => row.name).join(", ")].join(" ")
    )
}));

vi.mock("@/views/blocks/audit-events-runtime-block", () => ({
  AuditEventsRuntimeBlock: ({ auditEvents }: { auditEvents: { actionType: string }[] }) =>
    createElement(
      "div",
      { "data-testid": "runtime-audit-events" },
      auditEvents.map((event) => event.actionType).join(", ")
    )
}));

vi.mock("@/views/blocks/admin-users-runtime-block", () => ({
  AdminUsersRuntimeBlock: ({ users }: { users: { name: string }[] }) =>
    createElement(
      "div",
      { "data-testid": "runtime-admin-users" },
      users.map((user) => user.name).join(", ")
    )
}));

vi.mock("@/views/blocks/admin-access-roles-runtime-block", () => ({
  AdminAccessRolesRuntimeBlock: ({ accessRoles }: { accessRoles: { name: string }[] }) =>
    createElement(
      "div",
      { "data-testid": "runtime-admin-access-roles" },
      accessRoles.map((role) => role.name).join(", ")
    )
}));

vi.mock("@/views/blocks/clients-runtime-block", () => ({
  ClientsRuntimeBlock: ({ clients }: { clients: { name: string }[] }) =>
    createElement(
      "div",
      { "data-testid": "runtime-clients" },
      clients.map((client) => client.name).join(", ")
    )
}));

vi.mock("@/views/blocks/contacts-runtime-block", () => ({
  ContactsRuntimeBlock: ({ contacts }: { contacts: { name: string }[] }) =>
    createElement(
      "div",
      { "data-testid": "runtime-contacts" },
      contacts.map((contact) => contact.name).join(", ")
    )
}));

vi.mock("@/views/blocks/products-runtime-block", () => ({
  ProductsRuntimeBlock: ({ products }: { products: { name: string }[] }) =>
    createElement(
      "div",
      { "data-testid": "runtime-products" },
      products.map((product) => product.name).join(", ")
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
    readModelHooks.adminUsers.mockReturnValue(successQuery({ users: [] }));
    readModelHooks.adminAccessRoles.mockReturnValue(successQuery({ accessRoles: [] }));
    readModelHooks.audit.mockReturnValue(successQuery({ auditEvents: [] }));
    readModelHooks.clients.mockReturnValue(successQuery({ clients: [] }));
    readModelHooks.contacts.mockReturnValue(successQuery({ contacts: [] }));
    readModelHooks.products.mockReturnValue(successQuery({ products: [] }));
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
        taskStatuses: [],
        tasks: [],
        workspaceUsers: []
      })
    );
    readModelHooks.taskActivity.mockReturnValue(successQuery({ activities: [] }));
    readModelHooks.postWorkspaceAgentMessage.mockResolvedValue({ context: {}, messages: [], proposals: [] });
    readModelHooks.postWorkspaceTaskComment.mockResolvedValue({ id: "activity-runtime" });
    readModelHooks.confirmWorkspaceAgentProposal.mockResolvedValue({ context: {}, messages: [], proposals: [] });
    readModelHooks.updateWorkspaceProjectTaskStatus.mockResolvedValue({ id: "task-runtime" });
    readModelHooks.updateWorkspaceTaskFields.mockResolvedValue({
      id: "task-runtime",
      projectId: "project-runtime"
    });
    readModelHooks.createWorkspaceProjectTask.mockResolvedValue({ id: "task-created" });
  });

  it("blocks static admin, settings and catalog screens for project-only users", () => {
    const permissions = ["tenant.projects.read"];

    expect(canOpenStaticRuntimeScreen("09-admin", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("09-admin-roles", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("10-settings", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("08-entities-clients", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("08-entities-products", permissions)).toBe(false);
  });

  it("allows static runtime screens when the matching read permission is present", () => {
    expect(canOpenStaticRuntimeScreen("09-admin", ["tenant.users.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("09-admin-roles", ["tenant.access_profiles.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("10-settings", ["tenant.workspace_config.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("08-entities-clients", ["tenant.clients.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("08-entities-products", ["tenant.products.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("17-project-audit", ["tenant.audit_events.read"])).toBe(true);
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
        taskStatuses: [{ id: "task-status-review", name: "На проверке" }],
        tasks: [{ id: "task-runtime", title: "Runtime task detail" }],
        workspaceUsers: [{ id: "usr-1", name: "Runtime User" }]
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
    expect(readModelHooks.taskActivity).toHaveBeenCalledWith("task-runtime");
  });

  it("renders project timeline from the runtime project read model without fixture fallback", async () => {
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: {
          id: "project-runtime",
          title: "Runtime project timeline",
          tenantId: "tenant-runtime",
          clientName: "Runtime client",
          plannedStart: "2026-06-01T00:00:00.000Z",
          plannedFinish: "2026-06-12T00:00:00.000Z",
          plannedHours: 120
        },
        taskStatuses: [
          {
            category: "in_progress",
            id: "task-status-progress",
            name: "В работе"
          }
        ],
        tasks: [
          {
            actualWork: 0,
            archivedAt: null,
            id: "task-runtime",
            ownerUserId: "usr-1",
            plannedFinish: "2026-06-04T00:00:00.000Z",
            plannedStart: "2026-06-02T00:00:00.000Z",
            plannedWork: 8,
            priority: "normal",
            progress: 0.5,
            projectId: "project-runtime",
            requesterUserId: "usr-1",
            stageId: null,
            statusCategory: "in_progress",
            statusId: "task-status-progress",
            statusName: "В работе",
            tenantId: "tenant-runtime",
            title: "Runtime timeline task"
          }
        ],
        workspaceUsers: [{ id: "usr-1", name: "Runtime User" }]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "12-project-gantt",
        projectId: "project-runtime",
        permissions: ["tenant.project_plan.read"]
      })
    );

    expect(host.textContent).toContain("Runtime project timeline");
    expect(host.textContent).toContain("Runtime timeline task");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(host.textContent).not.toContain("Разработать концепцию");
    expect(readModelHooks.projectDetail).toHaveBeenCalledWith("project-runtime");
  });

  it("renders audit from the runtime audit read model without fixture fallback", async () => {
    readModelHooks.audit.mockReturnValue(
      successQuery({
        auditEvents: [
          {
            actionType: "workspace.agent.proposal.apply",
            id: "audit-runtime"
          }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "17-project-audit",
        permissions: ["tenant.audit_events.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("workspace.agent.proposal.apply");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.audit).toHaveBeenCalled();
  });

  it("renders admin users from the runtime users read model without fixture fallback", async () => {
    readModelHooks.adminUsers.mockReturnValue(
      successQuery({
        users: [
          {
            id: "usr-admin",
            name: "Runtime Admin"
          }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "09-admin",
        permissions: ["tenant.users.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime Admin");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.adminUsers).toHaveBeenCalled();
  });

  it("renders admin access roles from the runtime access roles read model without fixture fallback", async () => {
    readModelHooks.adminAccessRoles.mockReturnValue(
      successQuery({
        accessRoles: [
          {
            id: "role-runtime",
            name: "Runtime Role"
          }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "09-admin-roles",
        permissions: ["tenant.access_profiles.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime Role");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.adminAccessRoles).toHaveBeenCalled();
  });

  it("renders clients from the runtime clients read model without fixture fallback", async () => {
    readModelHooks.clients.mockReturnValue(
      successQuery({
        clients: [
          {
            id: "client-runtime",
            name: "Runtime Client"
          }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "08-entities-clients",
        permissions: ["tenant.clients.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime Client");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.clients).toHaveBeenCalled();
  });

  it("renders contacts from the runtime contacts read model without fixture fallback", async () => {
    readModelHooks.contacts.mockReturnValue(
      successQuery({
        contacts: [
          {
            id: "contact-runtime",
            name: "Runtime Contact"
          }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "08-entities-contacts",
        permissions: ["tenant.contacts.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime Contact");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.contacts).toHaveBeenCalled();
  });

  it("renders products from the runtime products read model without fixture fallback", async () => {
    readModelHooks.products.mockReturnValue(
      successQuery({
        products: [
          {
            id: "product-runtime",
            name: "Runtime Product"
          }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "08-entities-products",
        permissions: ["tenant.products.read"],
        currentUserId: "usr-1"
      })
    );

    expect(host.textContent).toContain("Runtime Product");
    expect(host.textContent).not.toContain("fixture fallback");
    expect(readModelHooks.products).toHaveBeenCalled();
  });

  it("updates task status from project detail through the project-scoped task status API", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: { id: "project-runtime", title: "Runtime project detail" },
        taskStatuses: [{ id: "task-status-review", name: "На проверке" }],
        tasks: [{ id: "task-runtime", title: "Runtime task detail" }],
        workspaceUsers: []
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07b-project-detail",
        projectId: "project-runtime",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    await act(async () => {
      host.querySelector("[data-testid='runtime-project-status-action']")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(readModelHooks.updateWorkspaceProjectTaskStatus.mock.calls[0]?.[0]).toEqual({
      projectId: "project-runtime",
      statusId: "task-status-review",
      taskId: "task-runtime"
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.workspace.project("project-runtime")
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.projects });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.operationsCockpit });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.myWork("usr-1") });
    invalidateSpy.mockRestore();
  });

  it("updates task owner and due date from project detail through the full task update API", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: { id: "project-runtime", title: "Runtime project detail" },
        taskStatuses: [{ id: "task-status-new", name: "Новая" }],
        tasks: [{ id: "task-runtime", projectId: "project-runtime", title: "Runtime task detail" }],
        workspaceUsers: [
          { id: "usr-1", name: "Runtime User" },
          { id: "usr-2", name: "Runtime Lead" }
        ]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07b-project-detail",
        projectId: "project-runtime",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    await act(async () => {
      host.querySelector("[data-testid='runtime-project-fields-action']")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(readModelHooks.updateWorkspaceTaskFields.mock.calls[0]?.[0]).toEqual({
      dueDate: "2026-06-09",
      ownerUserId: "usr-2",
      task: { id: "task-runtime", projectId: "project-runtime", title: "Runtime task detail" }
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.workspace.project("project-runtime")
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.projects });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.operationsCockpit });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.myWork("usr-1") });
    invalidateSpy.mockRestore();
  });

  it("creates project tasks through the project-scoped runtime task API", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: { id: "project-runtime", title: "Runtime project detail" },
        taskStatuses: [{ id: "task-status-new", name: "Новая" }],
        tasks: [{ id: "task-runtime", title: "Runtime task detail" }],
        workspaceUsers: [{ id: "usr-1", name: "Runtime User" }]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07b-project-detail",
        projectId: "project-runtime",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    await act(async () => {
      host.querySelector("[data-testid='runtime-project-create-task']")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(readModelHooks.createWorkspaceProjectTask.mock.calls[0]?.[0]).toEqual({
      dueDate: "2026-06-04",
      ownerUserId: "usr-1",
      projectId: "project-runtime",
      statusId: "task-status-new",
      title: "Runtime created task"
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.workspace.project("project-runtime")
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.projects });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.operationsCockpit });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tenant.currentScheduledTasksRoot });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.myWork("usr-1") });
    invalidateSpy.mockRestore();
  });

  it("adds task comments from project detail and refreshes task activity", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    readModelHooks.projectDetail.mockReturnValue(
      successQuery({
        project: { id: "project-runtime", title: "Runtime project detail" },
        taskStatuses: [{ id: "task-status-new", name: "Новая" }],
        tasks: [{ id: "task-runtime", projectId: "project-runtime", title: "Runtime task detail" }],
        workspaceUsers: [{ id: "usr-1", name: "Runtime User" }]
      })
    );
    readModelHooks.taskActivity.mockReturnValue(
      successQuery({
        activities: [{ id: "activity-runtime", body: "Existing runtime comment" }]
      })
    );

    const host = await renderRuntime(
      createElement(RuntimeDataScreen, {
        screenId: "07b-project-detail",
        projectId: "project-runtime",
        permissions: ["tenant.projects.read"],
        currentUserId: "usr-1"
      })
    );

    await act(async () => {
      host.querySelector("[data-testid='runtime-project-comment-action']")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(host.textContent).toContain("Existing runtime comment");
    expect(readModelHooks.postWorkspaceTaskComment.mock.calls[0]?.[0]).toEqual({
      body: "Runtime project comment",
      taskId: "task-runtime"
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.workspace.taskActivity("task-runtime")
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.workspace.project("project-runtime")
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workspace.operationsCockpit });
    invalidateSpy.mockRestore();
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
