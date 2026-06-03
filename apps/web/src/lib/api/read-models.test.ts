// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWorkspaceOperationsCockpit,
  fetchWorkspaceAgentThread,
  fetchTenantCurrentScheduledTasks,
  fetchWorkspaceDealStages,
  confirmWorkspaceAgentProposal,
  fetchWorkspaceMyWorkTasks,
  fetchWorkspaceOpportunities,
  fetchWorkspaceProjectDetail,
  fetchWorkspaceProjectTemplates,
  fetchWorkspaceProjects,
  fetchWorkspaceTaskStatuses,
  createWorkspaceProjectTask,
  postWorkspaceAgentMessage,
  updateWorkspaceTaskFields,
  updateWorkspaceProjectTaskStatus,
  useAgentCockpitReadModelQuery,
  useDashboardReadModelQueries,
  useDealsBoardReadModelQueries,
  useMyWorkReadModelQueries,
  useProjectDetailReadModelQuery,
  useProjectsListReadModelQuery
} from "@/lib/api/read-models";
import { queryKeys } from "@/lib/api/query-keys";
import type { OperationsCockpitReadModel, Task } from "@/lib/api-types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("runtime read model API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares stable query keys for projects and CRM board data", () => {
    expect(queryKeys.workspace.projects).toEqual(["workspace", "projects"]);
    expect(queryKeys.workspace.project("project-alpha")).toEqual(["workspace", "projects", "project-alpha"]);
    expect(queryKeys.workspace.taskStatuses).toEqual(["workspace", "task-statuses"]);
    expect(queryKeys.workspace.users).toEqual(["workspace", "users"]);
    expect(queryKeys.workspace.projectTemplates).toEqual(["workspace", "config", "project-templates"]);
    expect(queryKeys.workspace.operationsCockpit).toEqual(["workspace", "operations-cockpit"]);
    expect(queryKeys.workspace.myWork("usr-1")).toEqual(["workspace", "my-work", "usr-1"]);
    expect(queryKeys.workspace.myWork("usr-2")).toEqual(["workspace", "my-work", "usr-2"]);
    expect(queryKeys.workspace.workspaceAgentThread).toEqual(["workspace", "agent-thread"]);
    expect(queryKeys.workspace.opportunities).toEqual(["workspace", "opportunities"]);
    expect(queryKeys.workspace.dealStages).toEqual(["workspace", "deal-stages"]);
    expect(queryKeys.tenant.currentScheduledTasks("usr-1", "2026-05-30", "2026-05-30")).toEqual([
      "tenant",
      "current",
      "scheduled-tasks",
      "usr-1",
      "2026-05-30",
      "2026-05-30"
    ]);
  });

  it("fetches read-only screen data through documented same-origin endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects") return json({ projects: [{ id: "project-1" }] });
      if (path === "/api/workspace/projects/project-1") {
        return json({ project: { id: "project-1" }, tasks: [{ id: "task-1" }] });
      }
      if (path === "/api/workspace/task-statuses") {
        return json({ taskStatuses: [{ id: "task-status-in-progress" }] });
      }
      if (path === "/api/workspace/users") {
        return json({ users: [{ id: "usr-1", name: "Камил" }] });
      }
      if (path === "/api/workspace/projects/project-1/tasks/task-1/status") {
        return json({ task: { id: "task-1", statusId: "task-status-review" } });
      }
      if (path === "/api/workspace/projects/project-1/tasks") {
        return json({ task: { id: "task-created", title: "Runtime created task" } }, 201);
      }
      if (path === "/api/workspace/tasks/task-1") {
        return json({ task: { id: "task-1", ownerUserId: "usr-2", plannedFinish: "2026-06-09" } });
      }
      if (path === "/api/workspace/config/project-templates") {
        return json({ projectTemplates: [{ id: "template-1" }] });
      }
      if (path === "/api/workspace/my-work") return json({ tasks: [{ id: "task-1" }] });
      if (path === "/api/workspace/opportunities") {
        return json({ opportunities: [{ id: "opp-1" }] });
      }
      if (path === "/api/workspace/deal-stages") {
        return json({ dealStages: [{ id: "lead" }] });
      }
      if (path === "/api/workspace/agent-thread") {
        return json(agentThreadPayload({ messages: [{ id: "agent-message-1" }] }));
      }
      if (path === "/api/workspace/operations-cockpit") {
        return json({
          cockpit: {
            indicators: { activeProjects: 1 },
            attentionItems: [],
            agentContext: { unavailableSources: [] }
          }
        });
      }
      if (path === "/api/workspace/agent-thread/messages") {
        return json(
          agentThreadPayload({
            messages: [{ id: "agent-message-2" }],
            proposals: [{ id: "proposal-1", confirmation: availableConfirmation("proposal-1") }]
          }),
          201
        );
      }
      if (path === "/api/workspace/agent-thread/proposals/proposal-1/confirm") {
        return json(
          agentThreadPayload({
            messages: [],
            proposals: [{ id: "proposal-1", status: "applied", confirmation: closedConfirmation("proposal-1") }]
          })
        );
      }
      if (
        path ===
        "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-1&fromDate=2026-05-30&toDate=2026-05-30"
      ) {
        return json({ tasks: [{ id: "scheduled-1" }] });
      }
      return json({ error: "not_found" }, 404);
    });

    await expect(fetchWorkspaceProjects()).resolves.toEqual([{ id: "project-1" }]);
    await expect(fetchWorkspaceProjectDetail("project-1")).resolves.toEqual({
      project: { id: "project-1" },
      taskStatuses: [],
      tasks: [{ id: "task-1" }],
      workspaceUsers: []
    });
    await expect(fetchWorkspaceTaskStatuses()).resolves.toEqual([{ id: "task-status-in-progress" }]);
    await expect(
      updateWorkspaceProjectTaskStatus({
        projectId: "project-1",
        taskId: "task-1",
        statusId: "task-status-review"
      })
    ).resolves.toEqual({ id: "task-1", statusId: "task-status-review" });
    await expect(
      createWorkspaceProjectTask({
        dueDate: "2026-06-04",
        ownerUserId: "usr-1",
        projectId: "project-1",
        statusId: "task-status-in-progress",
        title: "Runtime created task"
      })
    ).resolves.toEqual({ id: "task-created", title: "Runtime created task" });
    await expect(
      updateWorkspaceTaskFields({
        dueDate: "2026-06-09",
        ownerUserId: "usr-2",
        task: taskFixture({
          id: "task-1",
          participants: [
            { role: "executor", userId: "usr-1" },
            { role: "observer", userId: "usr-3" }
          ]
        })
      })
    ).resolves.toEqual({ id: "task-1", ownerUserId: "usr-2", plannedFinish: "2026-06-09" });
    await expect(fetchWorkspaceProjectTemplates()).resolves.toEqual([{ id: "template-1" }]);
    await expect(fetchWorkspaceMyWorkTasks()).resolves.toEqual([{ id: "task-1" }]);
    await expect(fetchWorkspaceOpportunities()).resolves.toEqual([{ id: "opp-1" }]);
    await expect(fetchWorkspaceDealStages()).resolves.toEqual([{ id: "lead" }]);
    await expect(fetchWorkspaceAgentThread()).resolves.toMatchObject({
      thread: {
        kind: "workspace_agent_cockpit",
        scope: { type: "workspace", tenantId: "tenant-alpha" },
        context: {}
      },
      mutationPolicy: {
        mode: "confirmation_required",
        messagePostMutatesWorkspace: false,
        mutationEndpoint: "/api/workspace/agent-thread/proposals/:proposalId/confirm",
        allowedDecisions: ["apply", "reject"]
      },
      context: {},
      messages: [{ id: "agent-message-1" }],
      proposals: []
    });
    await expect(fetchWorkspaceOperationsCockpit()).resolves.toEqual({
      indicators: { activeProjects: 1 },
      attentionItems: [],
      agentContext: { unavailableSources: [] }
    });
    await expect(postWorkspaceAgentMessage("Что горит?")).resolves.toMatchObject({
      mutationPolicy: {
        mode: "confirmation_required",
        messagePostMutatesWorkspace: false
      },
      context: {},
      messages: [{ id: "agent-message-2" }],
      proposals: [
        {
          id: "proposal-1",
          confirmation: {
            required: true,
            status: "available",
            endpoint: "/api/workspace/agent-thread/proposals/proposal-1/confirm",
            allowedDecisions: ["apply", "reject"],
            mutationOnlyOnApply: true
          }
        }
      ]
    });
    await expect(confirmWorkspaceAgentProposal({ proposalId: "proposal-1", decision: "apply" })).resolves.toMatchObject({
      mutationPolicy: {
        mode: "confirmation_required",
        messagePostMutatesWorkspace: false
      },
      context: {},
      messages: [],
      proposals: [
        {
          id: "proposal-1",
          status: "applied",
          confirmation: {
            required: true,
            status: "closed",
            endpoint: "/api/workspace/agent-thread/proposals/proposal-1/confirm",
            allowedDecisions: [],
            mutationOnlyOnApply: true
          }
        }
      ]
    });
    await expect(
      fetchTenantCurrentScheduledTasks({
        assigneeUserId: "usr-1",
        fromDate: "2026-05-30",
        toDate: "2026-05-30"
      })
    ).resolves.toEqual([{ id: "scheduled-1" }]);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/workspace/projects",
      "/api/workspace/projects/project-1",
      "/api/workspace/task-statuses",
      "/api/workspace/projects/project-1/tasks/task-1/status",
      "/api/workspace/projects/project-1/tasks",
      "/api/workspace/tasks/task-1",
      "/api/workspace/config/project-templates",
      "/api/workspace/my-work",
      "/api/workspace/opportunities",
      "/api/workspace/deal-stages",
      "/api/workspace/agent-thread",
      "/api/workspace/operations-cockpit",
      "/api/workspace/agent-thread/messages",
      "/api/workspace/agent-thread/proposals/proposal-1/confirm",
      "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-1&fromDate=2026-05-30&toDate=2026-05-30"
    ]);
    const postMessageCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/workspace/agent-thread/messages"
    );
    const updateTaskStatusCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/workspace/projects/project-1/tasks/task-1/status"
    );
    const createTaskCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/workspace/projects/project-1/tasks"
    );
    const updateTaskFieldsCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/workspace/tasks/task-1"
    );
    const confirmProposalCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/workspace/agent-thread/proposals/proposal-1/confirm"
    );
    expect(postMessageCall?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify("Что горит?")
    });
    expect(updateTaskStatusCall?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ statusId: "task-status-review" })
    });
    expect(createTaskCall?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        description: null,
        durationWorkingDays: 1,
        participants: [{ role: "executor", userId: "usr-1" }],
        plannedFinish: "2026-06-04",
        plannedStart: "2026-06-04",
        plannedWork: 1,
        priority: "normal",
        requiresAcceptance: false,
        statusId: "task-status-in-progress",
        title: "Runtime created task"
      })
    });
    expect(updateTaskFieldsCall?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        clientUpdatedAt: "2026-06-01T10:00:00.000Z",
        description: null,
        durationWorkingDays: 1,
        participants: [
          { role: "executor", userId: "usr-2" },
          { role: "observer", userId: "usr-3" }
        ],
        plannedFinish: "2026-06-09",
        plannedStart: "2026-06-01",
        plannedWork: 1,
        priority: "normal",
        requiresAcceptance: false,
        statusId: "task-status-new",
        title: "Runtime task"
      })
    });
    expect(confirmProposalCall?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ decision: "apply" })
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).get("x-kiss-pm-action")).toBe("same-origin");
      expect(init?.credentials).toBe("same-origin");
    }
  });

  it("loads the projects list from projects and project template endpoints", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects") return json({ projects: [{ id: "project-live" }] });
      if (path === "/api/workspace/config/project-templates") {
        return json({ projectTemplates: [{ id: "template-live" }] });
      }
      return json({ error: "not_found" }, 404);
    });

    function ProjectsProbe() {
      useProjectsListReadModelQuery();
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ProjectsProbe)
          )
        );
      });

      await act(async () => {
        await vi.waitFor(() =>
          expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
            "/api/workspace/config/project-templates",
            "/api/workspace/projects"
          ])
        );
      });
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/storybook/projects");
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("keeps projects readable when project template catalog access is forbidden", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    let latestData: unknown;
    let latestError: unknown;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects") return json({ projects: [{ id: "project-live" }] });
      if (path === "/api/workspace/config/project-templates") return json({ error: "forbidden" }, 403);
      return json({ error: "not_found" }, 404);
    });

    function ProjectsProbe() {
      const readModel = useProjectsListReadModelQuery();
      latestData = readModel.data;
      latestError = readModel.error;
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ProjectsProbe)
          )
        );
      });

      await act(async () => {
        await vi.waitFor(() =>
          expect(latestData).toEqual({
            projects: [{ id: "project-live" }],
            projectTemplates: []
          })
        );
      });
      expect(latestError).toBeNull();
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("loads project detail by real project id without storybook fallback", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects/project-runtime") {
        return json({
          project: { id: "project-runtime", title: "Runtime project detail" },
          tasks: [{ id: "task-runtime", title: "Runtime task detail" }]
        });
      }
      if (path === "/api/workspace/task-statuses") {
        return json({ taskStatuses: [{ id: "task-status-runtime", name: "В работе" }] });
      }
      if (path === "/api/workspace/users") {
        return json({ users: [{ id: "usr-runtime", name: "Runtime User" }] });
      }
      return json({ error: "not_found" }, 404);
    });
    let latestData: unknown;

    function ProjectDetailProbe() {
      const readModel = useProjectDetailReadModelQuery("project-runtime");
      latestData = readModel.data;
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ProjectDetailProbe)
          )
        );
      });

      await act(async () => {
        await vi.waitFor(() =>
          expect(latestData).toEqual({
            project: { id: "project-runtime", title: "Runtime project detail" },
            taskStatuses: [{ id: "task-status-runtime", name: "В работе" }],
            tasks: [{ id: "task-runtime", title: "Runtime task detail" }],
            workspaceUsers: [{ id: "usr-runtime", name: "Runtime User" }]
          })
        );
      });
      expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
        "/api/workspace/projects/project-runtime",
        "/api/workspace/task-statuses",
        "/api/workspace/users"
      ]);
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain(
        "/api/storybook/projects/project-runtime"
      );
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("keeps project detail readable when workspace users access is forbidden", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    let latestData: unknown;
    let latestError: unknown;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects/project-runtime") {
        return json({
          project: { id: "project-runtime", title: "Runtime project detail" },
          tasks: [{ id: "task-runtime", title: "Runtime task detail" }]
        });
      }
      if (path === "/api/workspace/task-statuses") {
        return json({ taskStatuses: [{ id: "task-status-runtime", name: "В работе" }] });
      }
      if (path === "/api/workspace/users") return json({ error: "forbidden" }, 403);
      return json({ error: "not_found" }, 404);
    });

    function ProjectDetailProbe() {
      const readModel = useProjectDetailReadModelQuery("project-runtime");
      latestData = readModel.data;
      latestError = readModel.error;
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ProjectDetailProbe)
          )
        );
      });

      await act(async () => {
        await vi.waitFor(() =>
          expect(latestData).toEqual({
            project: { id: "project-runtime", title: "Runtime project detail" },
            taskStatuses: [{ id: "task-status-runtime", name: "В работе" }],
            tasks: [{ id: "task-runtime", title: "Runtime task detail" }],
            workspaceUsers: []
          })
        );
      });
      expect(latestError).toBeNull();
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("does not fetch unused client or project type catalogs for the deals board", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/opportunities") {
        return json({ opportunities: [{ id: "opp-1" }] });
      }
      if (path === "/api/workspace/deal-stages") {
        return json({ dealStages: [{ id: "lead" }] });
      }
      return json({ error: "not_found" }, 404);
    });

    function DealsProbe() {
      useDealsBoardReadModelQueries();
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(DealsProbe)
          )
        );
      });

      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
          "/api/workspace/deal-stages",
          "/api/workspace/opportunities"
        ])
      );
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/workspace/clients");
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain(
        "/api/workspace/project-types"
      );
    } finally {
      act(() => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("loads the agent cockpit from agent thread and operations cockpit endpoints", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/agent-thread") {
        return json(agentThreadPayload({ messages: [{ id: "agent-message-1" }], proposals: [] }));
      }
      if (path === "/api/workspace/operations-cockpit") {
        return json({
          cockpit: {
            indicators: { activeProjects: 2, overdueTasks: 1, criticalTasks: 1, openDeals: 3 },
            attentionItems: [{ id: "attention-1", title: "Просрочен этап" }],
            agentContext: { contextType: "operations_cockpit", unavailableSources: [] }
          }
        });
      }
      return json({ error: "not_found" }, 404);
    });

    function AgentProbe() {
      useAgentCockpitReadModelQuery();
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(AgentProbe)
          )
        );
      });

      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
          "/api/workspace/agent-thread",
          "/api/workspace/operations-cockpit"
        ])
      );
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/storybook/agent");
    } finally {
      act(() => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("keeps the agent cockpit usable when operations cockpit persistence is unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/operations-cockpit") {
        return json({ error: "persistence_not_configured" }, 501);
      }
      return json({ error: "not_found" }, 404);
    });

    const fallback = await fetchWorkspaceOperationsCockpit();
    expect(fallback).toMatchObject({
      indicators: {
        activeProjects: 0,
        activeTasks: 0,
        openDeals: 0
      },
      attentionItems: [],
      agentContext: {
        contextType: "operations_cockpit",
        unavailableSources: [
          {
            source: "operations_cockpit",
            reason: "persistence_not_configured"
          }
        ]
      }
    });
    expect(fallback.agentContext.unavailableSources).toEqual([
      {
        source: "operations_cockpit",
        reason: "persistence_not_configured"
      }
    ]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/workspace/operations-cockpit"]);
  });

  it("preserves unavailableSources from operations cockpit payload exactly", async () => {
    const fixture = operationsCockpitFixture();
    const payload: OperationsCockpitReadModel = {
      ...fixture,
      generatedAt: "2026-06-02T10:00:00.000Z",
      indicators: {
        ...fixture.indicators,
        openDeals: 7
      },
      agentContext: {
        contextType: "operations_cockpit",
        focus: {
          type: "workspace",
          tenantId: "tenant-alpha"
        },
        generatedAt: "2026-06-02T10:00:00.000Z",
        sourceEntityTypes: ["Project", "Task", "Opportunity"],
        unavailableSources: [
          { source: "resource_workload", reason: "unavailable_source" },
          { source: "opportunity_pipeline", reason: "feature_hidden" }
        ]
      }
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/operations-cockpit") {
        return json({ cockpit: payload });
      }
      return json({ error: "not_found" }, 404);
    });

    const readModel = await fetchWorkspaceOperationsCockpit();
    expect(readModel).toEqual(payload);
    expect(readModel.agentContext.unavailableSources).toEqual(payload.agentContext.unavailableSources);
  });

  it("does not hide operations cockpit permission errors", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/operations-cockpit") {
        return json({ error: "forbidden" }, 403);
      }
      return json({ error: "not_found" }, 404);
    });

    await expect(fetchWorkspaceOperationsCockpit()).rejects.toMatchObject({
      status: 403,
      body: { error: "forbidden" }
    });
  });

  it("loads the dashboard read model from project, task, agent and operations endpoints", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects") return json({ projects: [{ id: "project-1" }] });
      if (path === "/api/workspace/my-work") return json({ tasks: [{ id: "task-1" }] });
      if (
        path ===
        "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-1&fromDate=2026-05-30&toDate=2026-05-30"
      ) {
        return json({ tasks: [{ id: "scheduled-1" }] });
      }
      if (path === "/api/workspace/agent-thread") {
        return json(
          agentThreadPayload({
            messages: [{ id: "agent-message-1", body: "Runtime only" }],
            proposals: []
          })
        );
      }
      if (path === "/api/workspace/operations-cockpit") {
        return json({
          cockpit: {
            indicators: { activeProjects: 2, overdueTasks: 1 },
            attentionItems: [{ id: "attention-dashboard", title: "Просрочен выпуск стадии П" }],
            workloadHints: { byPerson: [] },
            pipelinePressure: { deals: [] },
            agentContext: { contextType: "operations_cockpit", unavailableSources: [] }
          }
        });
      }
      return json({ error: "not_found" }, 404);
    });

    function DashboardProbe() {
      useDashboardReadModelQueries({
        assigneeUserId: "usr-1",
        fromDate: "2026-05-30",
        toDate: "2026-05-30"
      });
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(DashboardProbe)
          )
        );
      });

      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
          "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-1&fromDate=2026-05-30&toDate=2026-05-30",
          "/api/workspace/agent-thread",
          "/api/workspace/my-work",
          "/api/workspace/operations-cockpit",
          "/api/workspace/projects"
        ])
      );
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/storybook/dashboard-agent");
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/storybook/operations-cockpit");
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/workspace/opportunities");
    } finally {
      act(() => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });

  it("keys my-work task data by current user", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/my-work") {
        return json({ tasks: [{ id: `task-${fetchMock.mock.calls.length}` }] });
      }
      if (
        path ===
          "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-1&fromDate=2026-05-30&toDate=2026-05-30" ||
        path ===
          "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-2&fromDate=2026-05-30&toDate=2026-05-30"
      ) {
        return json({ tasks: [] });
      }
      return json({ error: "not_found" }, 404);
    });

    function MyWorkProbe({ userId }: { userId: string }) {
      useMyWorkReadModelQueries({
        assigneeUserId: userId,
        fromDate: "2026-05-30",
        toDate: "2026-05-30"
      });
      return null;
    }

    try {
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(MyWorkProbe, { userId: "usr-1" })
          )
        );
      });

      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.map((call) => call[0])).toContain("/api/workspace/my-work")
      );

      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(MyWorkProbe, { userId: "usr-2" })
          )
        );
      });

      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.filter((call) => call[0] === "/api/workspace/my-work")).toHaveLength(2)
      );
    } finally {
      act(() => root.unmount());
      queryClient.clear();
      host.remove();
    }
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

function operationsCockpitFallback(): OperationsCockpitReadModel {
  return {
    generatedAt: "",
    scope: {
      type: "workspace",
      tenantId: ""
    },
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
    workloadHints: {
      byPerson: []
    },
    pipelinePressure: {
      deals: []
    },
    agentContext: {
      contextType: "operations_cockpit",
      focus: {
        type: "workspace",
        tenantId: ""
      },
      generatedAt: "",
      sourceEntityTypes: [],
      unavailableSources: [
        {
          source: "operations_cockpit",
          reason: "persistence_not_configured"
        }
      ]
    }
  };
}

function operationsCockpitFixture(overrides: Partial<OperationsCockpitReadModel> = {}): OperationsCockpitReadModel {
  const base = operationsCockpitFallback();
  return {
    ...base,
    ...overrides,
    indicators: {
      ...base.indicators,
      ...overrides.indicators
    },
    workloadHints: {
      ...base.workloadHints,
      ...overrides.workloadHints
    },
    pipelinePressure: {
      ...base.pipelinePressure,
      ...overrides.pipelinePressure
    },
    agentContext: {
      ...base.agentContext,
      ...overrides.agentContext
    },
    scope: {
      ...base.scope,
      ...overrides.scope
    }
  };
}

function agentThreadPayload(overrides: Partial<Record<"context" | "messages" | "proposals", unknown>> = {}) {
  const context = overrides.context ?? {};
  return {
    thread: {
      kind: "workspace_agent_cockpit",
      scope: { type: "workspace", tenantId: "tenant-alpha" },
      context
    },
    mutationPolicy: {
      mode: "confirmation_required",
      messagePostMutatesWorkspace: false,
      mutationEndpoint: "/api/workspace/agent-thread/proposals/:proposalId/confirm",
      allowedDecisions: ["apply", "reject"]
    },
    context,
    messages: overrides.messages ?? [],
    proposals: overrides.proposals ?? []
  };
}

function availableConfirmation(proposalId: string) {
  return {
    required: true,
    status: "available",
    endpoint: `/api/workspace/agent-thread/proposals/${proposalId}/confirm`,
    allowedDecisions: ["apply", "reject"],
    mutationOnlyOnApply: true
  };
}

function closedConfirmation(proposalId: string) {
  return {
    ...availableConfirmation(proposalId),
    status: "closed",
    allowedDecisions: []
  };
}

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    actualWork: 0,
    archivedAt: null,
    createdAt: "2026-06-01T09:00:00.000Z",
    description: null,
    durationWorkingDays: 1,
    id: "task-runtime",
    ownerUserId: "usr-1",
    participants: [{ role: "executor", userId: "usr-1" }],
    plannedFinish: "2026-06-02T00:00:00.000Z",
    plannedStart: "2026-06-01T00:00:00.000Z",
    plannedWork: 1,
    priority: "normal",
    progress: 0,
    projectId: "project-1",
    requesterUserId: "usr-1",
    requiresAcceptance: false,
    source: "manual",
    stageId: null,
    status: "new",
    statusCategory: "new",
    statusId: "task-status-new",
    statusName: "Новая",
    tenantId: "tenant-alpha",
    title: "Runtime task",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides
  };
}
