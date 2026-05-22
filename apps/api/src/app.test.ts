import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { ApiTenantDataSource, WorkspaceUserRecord } from "./apiTypes";
import type { TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";
import { hashPassword } from "@kiss-pm/persistence";

describe("KISS PM API Phase 1 shell", () => {
  it("returns health status", async () => {
    const app = createApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", product: "KISS PM" });
  });

  it("lists deterministic dev users for local Phase 1 login", async () => {
    const app = createApp({ enableDevTenantRoutes: true });

    const response = await app.request("/api/session/dev-users");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: "user-alpha-admin",
          tenantId: "tenant-alpha",
          name: "Анна Администратор"
        },
        {
          id: "user-beta-admin",
          tenantId: "tenant-beta",
          name: "Борис Администратор"
        }
      ]
    });
  });

  it("returns the current tenant for the dev-session user", async () => {
    const app = createApp({ enableDevTenantRoutes: true });

    const response = await app.request("/api/tenant/current", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenant: {
        id: "tenant-alpha",
        name: "Альфа Проект"
      },
      user: {
        id: "user-alpha-admin",
        tenantId: "tenant-alpha",
        name: "Анна Администратор"
      }
    });
  });

  it("denies cross-tenant user reads", async () => {
    const app = createApp({ enableDevTenantRoutes: true });

    const response = await app.request("/api/tenant/tenant-beta/users", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "cross_tenant_denied"
    });
  });

  it("keeps dev header routes disabled unless explicitly enabled", async () => {
    const app = createApp();

    const devUsers = await app.request("/api/session/dev-users");
    const currentTenant = await app.request("/api/tenant/current", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(devUsers.status).toBe(404);
    expect(currentTenant.status).toBe(404);
  });

  it("sets no-store cache headers even for early API rejections", async () => {
    const app = createApp();

    const response = await app.request("/api/workspace/opportunities", {
      method: "POST"
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("rejects cross-site browser mutations even with the action header", async () => {
    const app = createApp();

    const response = await app.request("http://127.0.0.1/api/workspace/opportunities", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
        "x-kiss-pm-action": "same-origin"
      }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("rate-limits repeated failed login attempts", async () => {
    const credential = {
      tenantId: "tenant-alpha",
      userId: "user-alpha-admin",
      email: "admin@kiss-pm.local",
      ...hashPassword("local-admin-password")
    };
    const dataSource: Partial<ApiTenantDataSource> = {
      async findCredentialByEmail(email) {
        return email === credential.email ? credential : undefined;
      },
      async createSession() {
        return;
      },
      async findUserById(userId) {
        if (userId !== credential.userId) return undefined;
        return {
          id: credential.userId,
          tenantId: credential.tenantId,
          name: "Анна Администратор",
          accessProfileId: "tenant-admin"
        };
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: credential.email,
          password: "wrong-password"
        })
      });
      expect(response.status).toBe(401);
    }

    const blocked = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: credential.email,
        password: "wrong-password"
      })
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    await expect(blocked.json()).resolves.toEqual({
      error: "too_many_login_attempts"
    });
  });

  it("rejects oversized login JSON before auth work", async () => {
    const dataSource: Partial<ApiTenantDataSource> = {
      async findCredentialByEmail() {
        throw new Error("credential_lookup_should_not_run");
      },
      async createSession() {
        throw new Error("session_create_should_not_run");
      }
    };
    const app = createApp({ dataSource: dataSource as ApiTenantDataSource });

    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "local-admin-password",
        padding: "x".repeat(70 * 1024)
      })
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "payload_too_large"
    });
  });

  it("can serve tenant users from an injected data source", async () => {
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: {
        async listDevUsers() {
          return [
            {
              id: "user-db-admin",
              tenantId: "tenant-db",
              name: "Дарья Администратор",
              accessProfileId: "tenant-admin"
            }
          ];
        },
        async findUserById(userId) {
          if (userId !== "user-db-admin") return undefined;
          return {
            id: "user-db-admin",
            tenantId: "tenant-db",
            name: "Дарья Администратор",
            accessProfileId: "tenant-admin"
          };
        },
        async findTenantById(tenantId) {
          if (tenantId !== "tenant-db") return undefined;
          return {
            id: "tenant-db",
            name: "DB Tenant"
          };
        },
        async listUsersByTenantId(tenantId) {
          if (tenantId !== "tenant-db") return [];
          return [
            {
              id: "user-db-admin",
              tenantId: "tenant-db",
              name: "Дарья Администратор",
              accessProfileId: "tenant-admin"
            }
          ];
        }
      }
    });

    const response = await app.request("/api/tenant/tenant-db/users", {
      headers: { "x-user-id": "user-db-admin" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: "user-db-admin",
          tenantId: "tenant-db",
          name: "Дарья Администратор"
        }
      ]
    });
  });

  it("fails closed when an actor access profile is missing", async () => {
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: {
        async listDevUsers() {
          return [];
        },
        async findUserById(userId) {
          if (userId !== "user-with-missing-profile") return undefined;
          return {
            id: "user-with-missing-profile",
            tenantId: "tenant-db",
            name: "Пользователь без роли",
            accessProfileId: "missing-profile"
          };
        },
        async findTenantById(tenantId) {
          if (tenantId !== "tenant-db") return undefined;
          return {
            id: "tenant-db",
            name: "DB Tenant"
          };
        },
        async findAccessProfileById() {
          return undefined;
        },
        async listUsersByTenantId() {
          return [];
        }
      }
    });

    const response = await app.request("/api/tenant/tenant-db/users", {
      headers: { "x-user-id": "user-with-missing-profile" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "access_profile_not_found"
    });
  });

  it("fails closed when a persisted actor cannot resolve access profile repository", async () => {
    const app = createApp({
      enableDevTenantRoutes: true,
      dataSource: {
        async listDevUsers() {
          return [];
        },
        async findUserById(userId) {
          if (userId !== "user-with-unwired-profile") return undefined;
          return {
            id: "user-with-unwired-profile",
            tenantId: "tenant-db",
            name: "Пользователь без репозитория ролей",
            accessProfileId: "tenant-admin"
          };
        },
        async findTenantById(tenantId) {
          if (tenantId !== "tenant-db") return undefined;
          return {
            id: "tenant-db",
            name: "DB Tenant"
          };
        },
        async listUsersByTenantId() {
          return [];
        },
        async listWorkspaceUsers() {
          return [];
        }
      }
    });

    const response = await app.request("/api/tenant/tenant-db/users", {
      headers: { "x-user-id": "user-with-unwired-profile" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "access_profile_not_found"
    });
  });

  it("rechecks task edit permission after acquiring the planning lock", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const users: WorkspaceUserRecord[] = [
      {
        id: "user-requester",
        tenantId: "tenant-db",
        name: "Рита Постановщик",
        email: "requester@kiss-pm.local",
        accessProfileId: "reader-profile",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      },
      {
        id: "user-current-requester",
        tenantId: "tenant-db",
        name: "Кирилл Новый Постановщик",
        email: "new-requester@kiss-pm.local",
        accessProfileId: "reader-profile",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      },
      {
        id: "user-executor",
        tenantId: "tenant-db",
        name: "Егор Исполнитель",
        email: "executor@kiss-pm.local",
        accessProfileId: "reader-profile",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      }
    ];
    const status: TaskStatusRecord = {
      id: "task-status-new",
      tenantId: "tenant-db",
      name: "Новая",
      category: "new",
      sortOrder: 10,
      status: "active",
      isSystem: true,
      createdAt: now,
      updatedAt: now
    };
    let task: TaskRecord = {
      id: "task-stale",
      tenantId: "tenant-db",
      projectId: "project-alpha",
      stageId: null,
      title: "Проверить stale-read",
      description: null,
      status: "new",
      statusId: status.id,
      statusName: status.name,
      statusCategory: "new",
      priority: "normal",
      requesterUserId: "user-requester",
      ownerUserId: "user-executor",
      plannedStart: now,
      plannedFinish: now,
      durationWorkingDays: 1,
      plannedWork: 8,
      actualWork: 0,
      progress: 0,
      requiresAcceptance: false,
      source: "manual",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      participants: [
        { userId: "user-requester", role: "requester" },
        { userId: "user-executor", role: "executor" }
      ]
    };
    let applyPlanningCommandCalled = false;
    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return users.find((user) => user.id === userId);
      },
      async findTenantById(tenantId) {
        return tenantId === "tenant-db" ? { id: tenantId, name: "DB Tenant" } : undefined;
      },
      async findAccessProfileById() {
        return { id: "reader-profile", permissions: ["tenant.projects.read"] };
      },
      async listUsersByTenantId() {
        return users;
      },
      async listWorkspaceUsers() {
        return users;
      },
      async findSessionByTokenHash() {
        return {
          id: "session-stale",
          tenantId: "tenant-db",
          userId: "user-requester",
          tokenHash: "ignored",
          expiresAt: new Date("2026-07-01T00:00:00.000Z")
        };
      },
      async findTaskById() {
        return { ...task, participants: [...task.participants] };
      },
      async listTaskStatuses() {
        return [status];
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async lockTenantResourcePlanning() {
        task = {
          ...task,
          requesterUserId: "user-current-requester",
          participants: [
            { userId: "user-current-requester", role: "requester" },
            { userId: "user-executor", role: "executor" }
          ]
        };
      },
      async getPlanSnapshot() {
        throw new Error("stale task should fail before planning preview");
      },
      async applyPlanningCommand() {
        applyPlanningCommandCalled = true;
      },
      async updateTaskMetadata() {
        throw new Error("stale task should fail before metadata update");
      },
      async incrementPlanVersion() {
        return 2;
      },
      async createTaskActivity() {
        throw new Error("stale task should fail before activity creation");
      },
      async appendAuditEvent() {
        throw new Error("stale task should fail before audit");
      }
    };
    const app = createApp({ dataSource });

    const response = await app.request("/api/workspace/tasks/task-stale", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=stale-token"
      },
      body: JSON.stringify({
        title: "Попытка изменения",
        description: null,
        priority: "normal",
        statusId: status.id,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationWorkingDays: 1,
        plannedWork: 8,
        requiresAcceptance: false,
        clientUpdatedAt: now.toISOString(),
        participants: [{ userId: "user-executor", role: "executor" }]
      })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(applyPlanningCommandCalled).toBe(false);
  });
});
