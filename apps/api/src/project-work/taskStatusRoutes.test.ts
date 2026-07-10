import { createAccessProfile } from "@kiss-pm/access-control";
import { createTenantUser } from "@kiss-pm/domain";
import type { TaskStatusInput, TaskStatusRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import { registerTaskStatusRoutes } from "./taskStatusRoutes";
import { createTaskStatusWorkspace } from "./taskStatusWorkspace";

const actor = createTenantUser({
  id: "user-task-status-admin",
  tenantId: "tenant-task-status",
  name: "Task Status Admin",
  accessProfileId: "profile-task-status-admin"
});

const profile = createAccessProfile({
  id: "profile-task-status-admin",
  permissions: ["tenant.task_statuses.manage"]
});

describe("task status PATCH route", () => {
  it("updates only the path status when the body contains a different existing id", async () => {
    const fixture = createRouteFixture();

    const response = await patchTaskStatus(fixture.app, {
      id: "status-body-target",
      name: "Path updated",
      category: "waiting",
      sortOrder: 30,
      status: "active"
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      taskStatus: { id: "status-path-target", name: "Path updated" }
    });
    expect(fixture.updates).toHaveLength(1);
    expect(fixture.updates[0]?.id).toBe("status-path-target");
    expect(fixture.auditCommandInputs).toEqual([
      expect.objectContaining({ id: "status-path-target" })
    ]);
  });

  it("enforces the path identity at the workspace boundary", async () => {
    const fixture = createRouteFixture();
    const workspace = createTaskStatusWorkspace(fixture.deps);

    const result = await workspace.updateTaskStatus({
      actor,
      profile,
      statusId: "status-path-target",
      value: {
        id: "status-body-target",
        name: "Path updated directly",
        category: "waiting",
        sortOrder: 30,
        status: "active"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      taskStatus: { id: "status-path-target", name: "Path updated directly" }
    });
    expect(fixture.updates).toHaveLength(1);
    expect(fixture.updates[0]?.id).toBe("status-path-target");
  });

  it.each([
    ["task_statuses_tenant_name_uidx", "task_status_name_taken"],
    ["task_statuses_tenant_sort_order_uidx", "task_status_sort_order_taken"]
  ])("maps %s update collisions to 409 %s", async (constraint, expectedError) => {
    const conflict = Object.assign(new Error(`duplicate key violates ${constraint}`), {
      code: "23505",
      constraint
    });
    const fixture = createRouteFixture(conflict);

    const response = await patchTaskStatus(fixture.app, {
      name: "Conflicting status",
      category: "waiting",
      sortOrder: 30,
      status: "active"
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: expectedError });
  });
});

function createRouteFixture(updateError?: Error) {
  const statuses = [
    taskStatus({ id: "status-path-target", name: "Path target", sortOrder: 10 }),
    taskStatus({ id: "status-body-target", name: "Body target", sortOrder: 20 })
  ];
  const updates: TaskStatusInput[] = [];
  const auditCommandInputs: Record<string, unknown>[] = [];
  const dataSource: Partial<ApiTenantDataSource> = {
    async listTaskStatuses() {
      return statuses;
    },
    async updateTaskStatusDefinition(input) {
      updates.push(input);
      if (updateError) throw updateError;
      const current = statuses.find((status) => status.id === input.id);
      if (!current) throw new Error(`Unexpected task status update: ${input.id}`);
      return { ...current, ...input, updatedAt: new Date("2026-07-10T01:00:00.000Z") };
    },
    async appendAuditEvent() {
      return;
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    }
  };
  const app = new Hono();
  const deps: ProjectWorkRouteDeps = {
    dataSource: dataSource as ApiTenantDataSource,
    async getSessionActorFromHeaders() {
      return actor;
    },
    async getActorProfile() {
      return profile;
    },
    async runDataSourceTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    },
    async appendManagementAuditEvent(input) {
      auditCommandInputs.push(input.commandInput);
      return "audit-task-status-update";
    }
  };
  registerTaskStatusRoutes(app, deps);

  return { app, auditCommandInputs, deps, updates };
}

function patchTaskStatus(app: Hono, body: Record<string, unknown>) {
  return app.request("/api/workspace/task-statuses/status-path-target", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: "kiss_pm_session=test"
    },
    body: JSON.stringify(body)
  });
}

function taskStatus(overrides: Partial<TaskStatusRecord>): TaskStatusRecord {
  return {
    id: "status-default",
    tenantId: "tenant-task-status",
    name: "Default status",
    category: "new",
    sortOrder: 1,
    status: "active",
    isSystem: false,
    createdAt: new Date("2026-07-10T00:00:00.000Z"),
    updatedAt: new Date("2026-07-10T00:00:00.000Z"),
    ...overrides
  };
}
