import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  clearSessionQueries,
  invalidateProjectIntakeQueries,
  workspaceQueryKeys
} from "./workspaceQueries";

describe("workspace query keys", () => {
  it("uses stable readable keys for server-state groups", () => {
    expect(workspaceQueryKeys.health()).toEqual(["health"]);
    expect(workspaceQueryKeys.me()).toEqual(["session", "me"]);
    expect(workspaceQueryKeys.users()).toEqual(["workspace", "users"]);
    expect(workspaceQueryKeys.positions()).toEqual(["workspace", "positions"]);
    expect(workspaceQueryKeys.accessRoles()).toEqual(["workspace", "accessRoles"]);
    expect(workspaceQueryKeys.auditEvents()).toEqual(["workspace", "auditEvents"]);
    expect(workspaceQueryKeys.clients()).toEqual(["workspace", "crm", "clients"]);
    expect(workspaceQueryKeys.contacts()).toEqual(["workspace", "crm", "contacts"]);
    expect(workspaceQueryKeys.projectTypes()).toEqual([
      "workspace",
      "crm",
      "projectTypes"
    ]);
    expect(workspaceQueryKeys.dealStages()).toEqual([
      "workspace",
      "crm",
      "dealStages"
    ]);
    expect(workspaceQueryKeys.opportunities()).toEqual(["workspace", "opportunities"]);
    expect(workspaceQueryKeys.opportunity("opportunity-1")).toEqual([
      "workspace",
      "opportunities",
      "opportunity-1"
    ]);
    expect(workspaceQueryKeys.opportunityActivity("opportunity-1")).toEqual([
      "workspace",
      "opportunities",
      "opportunity-1",
      "activity"
    ]);
    expect(workspaceQueryKeys.projects()).toEqual(["workspace", "projects"]);
    expect(workspaceQueryKeys.projectDetail("project-1")).toEqual([
      "workspace",
      "projects",
      "project-1"
    ]);
    expect(workspaceQueryKeys.projectTasks("project-1")).toEqual([
      "workspace",
      "projects",
      "project-1",
      "tasks"
    ]);
    expect(workspaceQueryKeys.myWork()).toEqual(["workspace", "myWork"]);
    expect(workspaceQueryKeys.customFields()).toEqual([
      "workspace",
      "config",
      "customFields"
    ]);
    expect(workspaceQueryKeys.projectTemplates()).toEqual([
      "workspace",
      "config",
      "projectTemplates"
    ]);
  });

  it("clears only session-bound cache on logout", async () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(workspaceQueryKeys.health(), { status: "ok" });
    queryClient.setQueryData(workspaceQueryKeys.me(), { user: { id: "user-1" } });
    queryClient.setQueryData(workspaceQueryKeys.users(), { users: [] });

    await clearSessionQueries(queryClient);

    expect(queryClient.getQueryData(workspaceQueryKeys.health())).toEqual({
      status: "ok"
    });
    expect(queryClient.getQueryData(workspaceQueryKeys.me())).toBeUndefined();
    expect(queryClient.getQueryData(workspaceQueryKeys.users())).toBeUndefined();
  });

  it("resets active session observers on logout", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(workspaceQueryKeys.me(), { user: { id: "user-1" } });
    const observer = new QueryObserver(queryClient, {
      queryKey: workspaceQueryKeys.me(),
      queryFn: async () => ({ user: { id: "should-not-run" } }),
      enabled: false
    });
    const unsubscribe = observer.subscribe(() => undefined);

    expect(observer.getCurrentResult().data).toEqual({ user: { id: "user-1" } });

    await clearSessionQueries(queryClient);

    expect(observer.getCurrentResult().data).toBeUndefined();
    unsubscribe();
  });

  it("invalidates the deal activity feed after deal state changes", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await invalidateProjectIntakeQueries(queryClient, "opportunity-1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.opportunities()
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.projects()
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.auditEvents()
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.opportunity("opportunity-1")
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.opportunityActivity("opportunity-1")
    });
  });
});
