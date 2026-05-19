import { describe, expect, it } from "vitest";
import { createApp } from "./app";

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
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
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
});
