import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const apiSeedDataset: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Альфа Проект" },
    { id: "tenant-beta", name: "Бета Проект" }
  ],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.users.read",
        "tenant.users.manage",
        "tenant.access_profiles.read",
        "tenant.access_profiles.manage",
        "tenant.positions.read",
        "tenant.positions.manage",
        "tenant.audit_events.read",
        "profile.read",
        "profile.update",
        "workspace.theme.manage"
      ]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Администратор",
      permissions: [
        "tenant.users.read",
        "tenant.users.manage",
        "tenant.access_profiles.read",
        "tenant.access_profiles.manage",
        "tenant.positions.read",
        "tenant.positions.manage",
        "tenant.audit_events.read",
        "profile.read",
        "profile.update",
        "workspace.theme.manage"
      ]
    },
    {
      id: "access-profile-alpha-reader",
      tenantId: "tenant-alpha",
      name: "Наблюдатель",
      permissions: ["tenant.users.read"]
    }
  ],
  positions: [
    {
      id: "position-project-manager",
      tenantId: "tenant-alpha",
      name: "Руководитель проекта"
    },
    {
      id: "position-engineer",
      tenantId: "tenant-alpha",
      name: "Инженер"
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-project-manager",
      password: "admin12345"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      name: "Борис Администратор",
      accessProfileId: "access-profile-beta-admin",
      password: "beta12345"
    },
    {
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      email: "reader@kiss-pm.local",
      name: "Роман Наблюдатель",
      accessProfileId: "access-profile-alpha-reader",
      password: "reader12345"
    }
  ]
};

describe("API with PostgreSQL data source", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    const db = createDatabase(client);
    app = createApp({
      dataSource: createPostgresTenantDataSource(db)
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      apiSeedDataset,
      new Date("2026-05-18T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("serves seeded dev users from PostgreSQL", async () => {
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
          id: "user-alpha-reader",
          tenantId: "tenant-alpha",
          name: "Роман Наблюдатель"
        },
        {
          id: "user-beta-admin",
          tenantId: "tenant-beta",
          name: "Борис Администратор"
        }
      ]
    });
  });

  it("keeps tenant isolation through the PostgreSQL data source", async () => {
    const currentTenant = await app.request("/api/tenant/current", {
      headers: { "x-user-id": "user-alpha-admin" }
    });
    const crossTenantUsers = await app.request("/api/tenant/tenant-beta/users", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(currentTenant.status).toBe(200);
    await expect(currentTenant.json()).resolves.toEqual({
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
    expect(crossTenantUsers.status).toBe(403);
    await expect(crossTenantUsers.json()).resolves.toEqual({
      error: "cross_tenant_denied"
    });
  });

  it("creates an access profile through a permission-checked command and writes audit", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "access-profile-alpha-controller",
        name: "Контролер",
        permissions: ["tenant.users.read"]
      })
    });
    const profiles = await app.request("/api/tenant/current/access-profiles", {
      headers: { cookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      accessProfile: {
        id: "access-profile-alpha-controller",
        tenantId: "tenant-alpha",
        name: "Контролер",
        permissions: ["tenant.users.read"]
      }
    });
    expect(profiles.status).toBe(200);
    await expect(profiles.json()).resolves.toMatchObject({
      accessProfiles: expect.arrayContaining([
        {
          id: "access-profile-alpha-controller",
          tenantId: "tenant-alpha",
          name: "Контролер",
          permissions: ["tenant.users.read"]
        }
      ])
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          tenantId: "tenant-alpha",
          actorUserId: "user-alpha-admin",
          actionType: "tenant.access_profile.created",
          correlationId: expect.any(String)
        })
      ])
    });
  });

  it("denies access-profile creation when the actor lacks management permission", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const response = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "access-profile-alpha-denied",
        name: "Не должен создаться",
        permissions: ["tenant.users.read"]
      })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "permission_missing"
    });
  });

  it("rejects x-user-id fallback on session-protected workspace routes", async () => {
    const users = await app.request("/api/workspace/users", {
      headers: { "x-user-id": "user-alpha-admin" }
    });
    const accessProfiles = await app.request("/api/tenant/current/access-profiles", {
      headers: { "x-user-id": "user-alpha-admin" }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(users.status).toBe(401);
    expect(accessProfiles.status).toBe(401);
    expect(audit.status).toBe(401);
  });

  it("does not leak access profiles across tenants", async () => {
    const alphaCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const betaCookie = await loginAs("beta@kiss-pm.local", "beta12345");
    await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: alphaCookie
      },
      body: JSON.stringify({
        id: "access-profile-alpha-controller",
        name: "Контролер",
        permissions: ["tenant.users.read"]
      })
    });

    const betaProfiles = await app.request("/api/tenant/current/access-profiles", {
      headers: { cookie: betaCookie }
    });

    expect(betaProfiles.status).toBe(200);
    await expect(betaProfiles.json()).resolves.not.toMatchObject({
      accessProfiles: expect.arrayContaining([
        expect.objectContaining({ id: "access-profile-alpha-controller" })
      ])
    });
  });

  it("allows clearing optional profile contact fields", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const filled = await app.request("/api/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        name: "Анна Администратор",
        phone: "+7 999 000-00-00",
        telegram: "@anna"
      })
    });
    const cleared = await app.request("/api/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        phone: "",
        telegram: ""
      })
    });

    expect(filled.status).toBe(200);
    expect(cleared.status).toBe(200);
    await expect(cleared.json()).resolves.toMatchObject({
      user: {
        id: "user-alpha-admin",
        phone: null,
        telegram: null
      }
    });
  });

  it("rolls back user creation when audit write fails inside the transaction", async () => {
    const db = createDatabase(client);
    const baseDataSource = createPostgresTenantDataSource(db);
    const appWithFailingAudit = createApp({
      dataSource: {
        ...baseDataSource,
        async withTransaction(operation) {
          return db.transaction((transaction) =>
            operation({
              ...createPostgresTenantDataSource(transaction as unknown as typeof db),
              async appendAuditEvent() {
                throw new Error("audit_failed");
              }
            })
          );
        }
      }
    });
    const login = await appWithFailingAudit.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "admin12345"
      })
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const createdUser = await appWithFailingAudit.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "user-rollback",
        email: "rollback@kiss-pm.local",
        name: "Откат Транзакции",
        accessProfileId: "access-profile-alpha-reader",
        password: "rollback12345"
      })
    });
    const users = await baseDataSource.listWorkspaceUsers("tenant-alpha");

    expect(createdUser.status).toBe(500);
    expect(users.some((user) => user.id === "user-rollback")).toBe(false);
  });

  it("rejects user management when transaction boundary is not configured", async () => {
    const db = createDatabase(client);
    const baseDataSource = createPostgresTenantDataSource(db);
    const { withTransaction: _withTransaction, ...dataSourceWithoutTransaction } =
      baseDataSource;
    const appWithoutTransaction = createApp({
      dataSource: dataSourceWithoutTransaction
    });
    const login = await appWithoutTransaction.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "admin12345"
      })
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const createdUser = await appWithoutTransaction.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "user-no-transaction",
        email: "no-transaction@kiss-pm.local",
        name: "Нет Транзакции",
        accessProfileId: "access-profile-alpha-reader",
        password: "password123"
      })
    });

    expect(createdUser.status).toBe(501);
    await expect(createdUser.json()).resolves.toEqual({
      error: "persistence_not_configured"
    });
  });

  it("logs in with password, reads session user and manages workspace users and positions", async () => {
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "admin12345"
      })
    });

    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie") ?? "";

    const me = await app.request("/api/auth/me", {
      headers: {
        cookie
      }
    });
    const selfDisable = await app.request("/api/workspace/users/user-alpha-admin", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        name: "Анна Администратор",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-project-manager",
        status: "inactive"
      })
    });
    const selfRoleUpdate = await app.request(
      "/api/workspace/access-roles/access-profile-alpha-admin",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          name: "Администратор без прав",
          permissions: ["tenant.users.read"]
        })
      }
    );
    const position = await app.request("/api/workspace/positions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "position-product-lead",
        name: "Руководитель продукта",
        description: "Отвечает за продуктовый контур"
      })
    });
    const createdUser = await app.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "user-product-lead",
        email: "product@kiss-pm.local",
        name: "Полина Продукт",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-product-lead",
        phone: "+7 900 000-00-00",
        telegram: "@product",
        theme: "dark",
        accentColor: "#2563eb",
        password: "product12345"
      })
    });
    const duplicatePosition = await app.request("/api/workspace/positions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "position-product-lead-copy",
        name: "Руководитель продукта",
        description: "Дубликат названия"
      })
    });
    const duplicateUser = await app.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "user-product-lead-copy",
        email: "product@kiss-pm.local",
        name: "Дубликат email",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-product-lead",
        password: "product12345"
      })
    });
    const invalidUserStatus = await app.request("/api/workspace/users/user-product-lead", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        email: "product@kiss-pm.local",
        name: "Полина Продукт",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-product-lead",
        status: "paused"
      })
    });
    const userWithoutPassword = await app.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "user-without-password",
        email: "without-password@kiss-pm.local",
        name: "Без Пароля",
        accessProfileId: "access-profile-alpha-reader"
      })
    });
    const users = await app.request("/api/workspace/users", {
      headers: {
        cookie
      }
    });
    const updatedUser = await app.request("/api/workspace/users/user-product-lead", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        email: "product2@kiss-pm.local",
        name: "Полина Продукт обновлено",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-product-lead",
        status: "active"
      })
    });
    const oldEmailLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "product@kiss-pm.local",
        password: "product12345"
      })
    });
    const newEmailLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "product2@kiss-pm.local",
        password: "product12345"
      })
    });
    const disabledUser = await app.request("/api/workspace/users/user-product-lead", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        email: "product2@kiss-pm.local",
        name: "Полина Продукт обновлено",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-product-lead",
        status: "inactive"
      })
    });
    const updatedPosition = await app.request("/api/workspace/positions/position-product-lead", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        name: "Руководитель продукта обновлено",
        description: "Отвечает за продуктовый контур"
      })
    });
    const inactiveUserLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "product2@kiss-pm.local",
        password: "product12345"
      })
    });
    const assignedRoleDelete = await app.request(
      "/api/workspace/access-roles/access-profile-alpha-reader",
      {
        method: "DELETE",
        headers: {
          cookie
        }
      }
    );
    const assignedPositionDelete = await app.request(
      "/api/workspace/positions/position-product-lead",
      {
        method: "DELETE",
        headers: {
          cookie
        }
      }
    );
    const accessRole = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "access-profile-alpha-temp",
        name: "Временная роль",
        permissions: ["tenant.users.read"]
      })
    });
    const updatedAccessRole = await app.request(
      "/api/workspace/access-roles/access-profile-alpha-temp",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie
        },
        body: JSON.stringify({
          name: "Временная роль обновлено",
          permissions: ["tenant.users.read", "profile.read"]
        })
      }
    );
    const deletedAccessRole = await app.request(
      "/api/workspace/access-roles/access-profile-alpha-temp",
      {
        method: "DELETE",
        headers: {
          cookie
        }
      }
    );
    const deletedUser = await app.request("/api/workspace/users/user-product-lead", {
      method: "DELETE",
      headers: {
        cookie
      }
    });
    const deletedPosition = await app.request("/api/workspace/positions/position-product-lead", {
      method: "DELETE",
      headers: {
        cookie
      }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: {
        cookie
      }
    });

    expect(cookie).toContain("kiss_pm_session=");
    expect(me.status).toBe(200);
    expect(selfDisable.status).toBe(400);
    await expect(selfDisable.json()).resolves.toEqual({
      error: "self_access_change_forbidden"
    });
    expect(selfRoleUpdate.status).toBe(400);
    await expect(selfRoleUpdate.json()).resolves.toEqual({
      error: "self_access_role_update_forbidden"
    });
    await expect(me.json()).resolves.toMatchObject({
      user: {
        id: "user-alpha-admin",
        email: "admin@kiss-pm.local",
        positionName: "Руководитель проекта"
      },
      permissions: expect.arrayContaining(["tenant.users.manage"])
    });
    expect(position.status).toBe(201);
    await expect(position.json()).resolves.toMatchObject({
      position: {
        id: "position-product-lead",
        tenantId: "tenant-alpha",
        name: "Руководитель продукта"
      }
    });
    expect(createdUser.status).toBe(201);
    await expect(createdUser.json()).resolves.toMatchObject({
      user: {
        id: "user-product-lead",
        email: "product@kiss-pm.local",
        positionName: "Руководитель продукта"
      }
    });
    expect(duplicatePosition.status).toBe(409);
    await expect(duplicatePosition.json()).resolves.toEqual({
      error: "position_name_taken"
    });
    expect(duplicateUser.status).toBe(409);
    await expect(duplicateUser.json()).resolves.toEqual({
      error: "user_email_taken"
    });
    expect(invalidUserStatus.status).toBe(400);
    await expect(invalidUserStatus.json()).resolves.toEqual({
      error: "invalid_user_status"
    });
    expect(userWithoutPassword.status).toBe(400);
    await expect(userWithoutPassword.json()).resolves.toEqual({
      error: "invalid_user_password"
    });
    await expect(users.json()).resolves.toMatchObject({
      users: expect.arrayContaining([
        expect.objectContaining({
          id: "user-product-lead",
          email: "product@kiss-pm.local"
        })
      ])
    });
    expect(updatedUser.status).toBe(200);
    await expect(updatedUser.json()).resolves.toMatchObject({
      user: {
        id: "user-product-lead",
        email: "product2@kiss-pm.local",
        name: "Полина Продукт обновлено",
        phone: "+7 900 000-00-00",
        telegram: "@product",
        status: "active",
        theme: "dark",
        accentColor: "#2563eb"
      }
    });
    expect(oldEmailLogin.status).toBe(401);
    await expect(oldEmailLogin.json()).resolves.toEqual({
      error: "invalid_credentials"
    });
    expect(newEmailLogin.status).toBe(200);
    expect(disabledUser.status).toBe(200);
    expect(updatedPosition.status).toBe(200);
    await expect(updatedPosition.json()).resolves.toMatchObject({
      position: {
        id: "position-product-lead",
        name: "Руководитель продукта обновлено"
      }
    });
    expect(inactiveUserLogin.status).toBe(403);
    await expect(inactiveUserLogin.json()).resolves.toEqual({
      error: "user_inactive"
    });
    expect(assignedRoleDelete.status).toBe(409);
    await expect(assignedRoleDelete.json()).resolves.toEqual({
      error: "access_role_assigned"
    });
    expect(assignedPositionDelete.status).toBe(409);
    await expect(assignedPositionDelete.json()).resolves.toEqual({
      error: "position_assigned"
    });
    expect(accessRole.status).toBe(201);
    expect(updatedAccessRole.status).toBe(200);
    await expect(updatedAccessRole.json()).resolves.toMatchObject({
      accessRole: {
        id: "access-profile-alpha-temp",
        name: "Временная роль обновлено",
        permissions: ["tenant.users.read", "profile.read"]
      }
    });
    expect(deletedAccessRole.status).toBe(200);
    expect(deletedUser.status).toBe(200);
    expect(deletedPosition.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "workspace.user.created" }),
        expect.objectContaining({ actionType: "workspace.user.updated" }),
        expect.objectContaining({ actionType: "workspace.user.deleted" }),
        expect.objectContaining({ actionType: "workspace.position.created" }),
        expect.objectContaining({ actionType: "workspace.position.updated" }),
        expect.objectContaining({ actionType: "workspace.position.deleted" }),
        expect.objectContaining({ actionType: "tenant.access_profile.created" }),
        expect.objectContaining({ actionType: "tenant.access_profile.updated" }),
        expect.objectContaining({ actionType: "tenant.access_profile.deleted" })
      ])
    });
  });
});
