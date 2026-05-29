import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWorkspaceClients,
  fetchWorkspaceDealStages,
  fetchWorkspaceOpportunities,
  fetchWorkspaceProjects,
  fetchWorkspaceProjectTypes
} from "@/lib/api/read-models";
import { queryKeys } from "@/lib/api/query-keys";

describe("runtime read model API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares stable query keys for projects and CRM board data", () => {
    expect(queryKeys.workspace.projects).toEqual(["workspace", "projects"]);
    expect(queryKeys.workspace.opportunities).toEqual(["workspace", "opportunities"]);
    expect(queryKeys.workspace.dealStages).toEqual(["workspace", "deal-stages"]);
    expect(queryKeys.workspace.clients).toEqual(["workspace", "clients"]);
    expect(queryKeys.workspace.projectTypes).toEqual(["workspace", "project-types"]);
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
      if (path === "/api/workspace/clients") return json({ clients: [{ id: "client-1" }] });
      if (path === "/api/workspace/project-types") {
        return json({ projectTypes: [{ id: "type-1" }] });
      }
      return json({ error: "not_found" }, 404);
    });

    await expect(fetchWorkspaceProjects()).resolves.toEqual([{ id: "project-1" }]);
    await expect(fetchWorkspaceOpportunities()).resolves.toEqual([{ id: "opp-1" }]);
    await expect(fetchWorkspaceDealStages()).resolves.toEqual([{ id: "lead" }]);
    await expect(fetchWorkspaceClients()).resolves.toEqual([{ id: "client-1" }]);
    await expect(fetchWorkspaceProjectTypes()).resolves.toEqual([{ id: "type-1" }]);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/workspace/projects",
      "/api/workspace/opportunities",
      "/api/workspace/deal-stages",
      "/api/workspace/clients",
      "/api/workspace/project-types"
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).get("x-kiss-pm-action")).toBe("same-origin");
      expect(init?.credentials).toBe("same-origin");
    }
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}
