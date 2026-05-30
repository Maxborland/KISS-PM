// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWorkspaceDealStages,
  fetchWorkspaceOpportunities,
  fetchWorkspaceProjects,
  useDealsBoardReadModelQueries
} from "@/lib/api/read-models";
import { queryKeys } from "@/lib/api/query-keys";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("runtime read model API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares stable query keys for projects and CRM board data", () => {
    expect(queryKeys.workspace.projects).toEqual(["workspace", "projects"]);
    expect(queryKeys.workspace.opportunities).toEqual(["workspace", "opportunities"]);
    expect(queryKeys.workspace.dealStages).toEqual(["workspace", "deal-stages"]);
  });

  it("fetches read-only screen data through documented same-origin endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/workspace/projects") return json({ projects: [{ id: "project-1" }] });
      if (path === "/api/workspace/opportunities") {
        return json({ opportunities: [{ id: "opp-1" }] });
      }
      if (path === "/api/workspace/deal-stages") {
        return json({ dealStages: [{ id: "lead" }] });
      }
      return json({ error: "not_found" }, 404);
    });

    await expect(fetchWorkspaceProjects()).resolves.toEqual([{ id: "project-1" }]);
    await expect(fetchWorkspaceOpportunities()).resolves.toEqual([{ id: "opp-1" }]);
    await expect(fetchWorkspaceDealStages()).resolves.toEqual([{ id: "lead" }]);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/workspace/projects",
      "/api/workspace/opportunities",
      "/api/workspace/deal-stages"
    ]);
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
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}
