// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWorkspaceAgentThread,
  fetchTenantCurrentScheduledTasks,
  fetchWorkspaceDealStages,
  fetchWorkspaceMyWorkTasks,
  fetchWorkspaceOpportunities,
  fetchWorkspaceProjects,
  postWorkspaceAgentMessage,
  useDashboardReadModelQueries,
  useDealsBoardReadModelQueries,
  useMyWorkReadModelQueries
} from "@/lib/api/read-models";
import { queryKeys } from "@/lib/api/query-keys";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("runtime read model API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares stable query keys for projects and CRM board data", () => {
    expect(queryKeys.workspace.projects).toEqual(["workspace", "projects"]);
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
      if (path === "/api/workspace/my-work") return json({ tasks: [{ id: "task-1" }] });
      if (path === "/api/workspace/opportunities") {
        return json({ opportunities: [{ id: "opp-1" }] });
      }
      if (path === "/api/workspace/deal-stages") {
        return json({ dealStages: [{ id: "lead" }] });
      }
      if (path === "/api/workspace/agent-thread") {
        return json({ context: {}, messages: [{ id: "agent-message-1" }] });
      }
      if (path === "/api/workspace/agent-thread/messages") {
        return json({ context: {}, messages: [{ id: "agent-message-2" }] }, 201);
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
    await expect(fetchWorkspaceMyWorkTasks()).resolves.toEqual([{ id: "task-1" }]);
    await expect(fetchWorkspaceOpportunities()).resolves.toEqual([{ id: "opp-1" }]);
    await expect(fetchWorkspaceDealStages()).resolves.toEqual([{ id: "lead" }]);
    await expect(fetchWorkspaceAgentThread()).resolves.toEqual({
      context: {},
      messages: [{ id: "agent-message-1" }]
    });
    await expect(postWorkspaceAgentMessage("Что горит?")).resolves.toEqual({
      context: {},
      messages: [{ id: "agent-message-2" }]
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
      "/api/workspace/my-work",
      "/api/workspace/opportunities",
      "/api/workspace/deal-stages",
      "/api/workspace/agent-thread",
      "/api/workspace/agent-thread/messages",
      "/api/tenant/current/scheduled-tasks?assigneeUserId=usr-1&fromDate=2026-05-30&toDate=2026-05-30"
    ]);
    expect(fetchMock.mock.calls[5]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify("Что горит?")
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).get("x-kiss-pm-action")).toBe("same-origin");
      expect(init?.credentials).toBe("same-origin");
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

  it("uses only project/task endpoints for the dashboard read model", async () => {
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
        return json({ context: {}, messages: [{ id: "agent-message-1", body: "Runtime only" }] });
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
          "/api/workspace/projects"
        ])
      );
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/workspace/opportunities");
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/workspace/deal-stages");
      expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain("/api/storybook/dashboard-agent");
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
