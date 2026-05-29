import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import {
  fetchAuthMe,
  fetchWorkspaceAccessRoles,
  fetchWorkspaceCustomFields,
  fetchWorkspacePositions,
  fetchWorkspaceUsers,
  isSessionRequiredError
} from "@/lib/api/bootstrap";
import { queryKeys } from "@/lib/api/query-keys";

describe("runtime API bootstrap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares stable query keys for auth and shell dictionaries", () => {
    expect(queryKeys.auth.me).toEqual(["auth", "me"]);
    expect(queryKeys.workspace.users).toEqual(["workspace", "users"]);
    expect(queryKeys.workspace.positions).toEqual(["workspace", "positions"]);
    expect(queryKeys.workspace.accessRoles).toEqual(["workspace", "access-roles"]);
    expect(queryKeys.workspace.customFields).toEqual(["workspace", "config", "custom-fields"]);
  });

  it("fetches bootstrap endpoints through same-origin apiFetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input);
      if (path === "/api/auth/me") return json({ user: { id: "usr-1", name: "Камил" } });
      if (path === "/api/workspace/users") return json({ users: [{ id: "usr-1" }] });
      if (path === "/api/workspace/positions") return json({ positions: [{ id: "pos-1" }] });
      if (path === "/api/workspace/access-roles") return json({ accessRoles: [{ id: "role-1", permissions: [] }] });
      if (path === "/api/workspace/config/custom-fields") return json({ customFields: [{ id: "field-1" }] });
      return json({ error: "not_found" }, 404);
    });

    await expect(fetchAuthMe()).resolves.toMatchObject({ user: { id: "usr-1" } });
    await expect(fetchWorkspaceUsers()).resolves.toEqual([{ id: "usr-1" }]);
    await expect(fetchWorkspacePositions()).resolves.toEqual([{ id: "pos-1" }]);
    await expect(fetchWorkspaceAccessRoles()).resolves.toEqual([{ id: "role-1", permissions: [] }]);
    await expect(fetchWorkspaceCustomFields()).resolves.toEqual([{ id: "field-1" }]);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/auth/me",
      "/api/workspace/users",
      "/api/workspace/positions",
      "/api/workspace/access-roles",
      "/api/workspace/config/custom-fields"
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).get("x-kiss-pm-action")).toBe("same-origin");
      expect(init?.credentials).toBe("same-origin");
    }
  });

  it("treats 401 session_required as login state", () => {
    const error = new ApiError(401, "unauthorized", "session_required", {
      error: "session_required"
    });
    expect(isSessionRequiredError(error)).toBe(true);
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

