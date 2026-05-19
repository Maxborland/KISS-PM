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
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

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
        "tenant.workspace_config.read",
        "tenant.workspace_config.manage",
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
        "tenant.workspace_config.read",
        "tenant.workspace_config.manage",
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
      password: "local-admin-password"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      name: "Борис Администратор",
      accessProfileId: "access-profile-beta-admin",
      password: "local-beta-password"
    },
    {
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      email: "reader@kiss-pm.local",
      name: "Роман Наблюдатель",
      accessProfileId: "access-profile-alpha-reader",
      password: "local-reader-password"
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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      apiSeedDataset,
      new Date("2026-05-18T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const response = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "access-profile-alpha-controller",
        name: "Контролер",
        permissions: ["tenant.users.read"]
      })
    });
    const profiles = await app.request("/api/tenant/current/access-profiles", {
      headers: { "x-kiss-pm-action": "same-origin", cookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { "x-kiss-pm-action": "same-origin", cookie }
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
    const cookie = await loginAs("reader@kiss-pm.local", "local-reader-password");
    const response = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
    const config = await app.request("/api/workspace/config/custom-fields", {
      headers: { "x-user-id": "user-alpha-admin" }
    });

    expect(users.status).toBe(401);
    expect(accessProfiles.status).toBe(401);
    expect(audit.status).toBe(401);
    expect(config.status).toBe(401);
  });

  it("rejects cookie-authenticated state changes without same-origin action header", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const response = await app.request("/api/workspace/positions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie
      },
      body: JSON.stringify({
        id: "position-without-action-header",
        name: "Без action header"
      })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("manages workspace custom fields and project templates with audit trail", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const createdField = await app.request("/api/workspace/config/custom-fields", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "field-project-priority",
        systemKey: "project_priority",
        tenantLabel: "Приоритет проекта",
        targetEntity: "project",
        fieldType: "select",
        required: true,
        status: "draft"
      })
    });
    const invalidField = await app.request("/api/workspace/config/custom-fields", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "field-invalid",
        systemKey: "Invalid Key",
        tenantLabel: "Некорректный ключ",
        targetEntity: "project",
        fieldType: "text"
      })
    });
    const invalidFieldLabel = await app.request("/api/workspace/config/custom-fields", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "field-too-long-label",
        systemKey: "too_long_label",
        tenantLabel: "x".repeat(121),
        targetEntity: "project",
        fieldType: "text"
      })
    });
    const updatedField = await app.request(
      "/api/workspace/config/custom-fields/field-project-priority",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          systemKey: "project_priority",
          tenantLabel: "Приоритет портфеля",
          targetEntity: "project",
          fieldType: "select",
          required: false,
          status: "active"
        })
      }
    );
    const renamedFieldKey = await app.request(
      "/api/workspace/config/custom-fields/field-project-priority",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          systemKey: "project_priority_renamed",
          tenantLabel: "Приоритет портфеля",
          targetEntity: "project",
          fieldType: "select",
          required: false,
          status: "active"
        })
      }
    );
    const createdTemplate = await app.request("/api/workspace/config/project-templates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "template-implementation",
        systemKey: "implementation",
        tenantLabel: "Внедрение",
        description: "Базовый шаблон проекта внедрения",
        status: "draft"
      })
    });
    const updatedTemplate = await app.request(
      "/api/workspace/config/project-templates/template-implementation",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          systemKey: "implementation",
          tenantLabel: "Внедрение обновлено",
          description: "",
          status: "active"
        })
      }
    );
    const renamedTemplateKey = await app.request(
      "/api/workspace/config/project-templates/template-implementation",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          systemKey: "implementation_renamed",
          tenantLabel: "Внедрение обновлено",
          description: "",
          status: "active"
        })
      }
    );
    const fields = await app.request("/api/workspace/config/custom-fields", {
      headers: { cookie }
    });
    const templates = await app.request("/api/workspace/config/project-templates", {
      headers: { cookie }
    });
    const betaCookie = await loginAs("beta@kiss-pm.local", "local-beta-password");
    const betaFields = await app.request("/api/workspace/config/custom-fields", {
      headers: { cookie: betaCookie }
    });
    const betaTemplates = await app.request("/api/workspace/config/project-templates", {
      headers: { cookie: betaCookie }
    });
    const betaSameIdField = await app.request("/api/workspace/config/custom-fields", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: betaCookie
      },
      body: JSON.stringify({
        id: "field-project-priority",
        systemKey: "project_priority",
        tenantLabel: "Приоритет проекта beta",
        targetEntity: "project",
        fieldType: "select",
        required: false,
        status: "draft"
      })
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });

    expect(createdField.status).toBe(201);
    await expect(createdField.json()).resolves.toMatchObject({
      customField: {
        id: "field-project-priority",
        tenantId: "tenant-alpha",
        systemKey: "project_priority",
        tenantLabel: "Приоритет проекта",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(invalidField.status).toBe(400);
    await expect(invalidField.json()).resolves.toEqual({
      error: "invalid_system_key"
    });
    expect(invalidFieldLabel.status).toBe(400);
    await expect(invalidFieldLabel.json()).resolves.toEqual({
      error: "invalid_tenant_label"
    });
    expect(updatedField.status).toBe(200);
    await expect(updatedField.json()).resolves.toMatchObject({
      customField: {
        tenantLabel: "Приоритет портфеля",
        required: false,
        status: "active",
        systemKey: "project_priority",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(renamedFieldKey.status).toBe(400);
    await expect(renamedFieldKey.json()).resolves.toEqual({
      error: "system_key_immutable"
    });
    expect(createdTemplate.status).toBe(201);
    expect(updatedTemplate.status).toBe(200);
    await expect(updatedTemplate.json()).resolves.toMatchObject({
      projectTemplate: {
        systemKey: "implementation",
        tenantLabel: "Внедрение обновлено",
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });
    expect(renamedTemplateKey.status).toBe(400);
    await expect(renamedTemplateKey.json()).resolves.toEqual({
      error: "system_key_immutable"
    });
    await expect(fields.json()).resolves.toMatchObject({
      customFields: expect.arrayContaining([
        expect.objectContaining({ id: "field-project-priority" })
      ])
    });
    await expect(templates.json()).resolves.toMatchObject({
      projectTemplates: expect.arrayContaining([
        expect.objectContaining({ id: "template-implementation" })
      ])
    });
    await expect(betaFields.json()).resolves.toEqual({
      customFields: []
    });
    await expect(betaTemplates.json()).resolves.toEqual({
      projectTemplates: []
    });
    expect(betaSameIdField.status).toBe(201);
    await expect(betaSameIdField.json()).resolves.toMatchObject({
      customField: {
        id: "field-project-priority",
        tenantId: "tenant-beta"
      }
    });
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "workspace.custom_field.created" }),
        expect.objectContaining({ actionType: "workspace.custom_field.updated" }),
        expect.objectContaining({ actionType: "workspace.project_template.created" }),
        expect.objectContaining({ actionType: "workspace.project_template.updated" })
      ])
    });
  });

  it("denies workspace config read and mutation for users without config permissions", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "local-reader-password");

    const fields = await app.request("/api/workspace/config/custom-fields", {
      headers: { cookie }
    });
    const templateCreate = await app.request("/api/workspace/config/project-templates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "template-denied",
        systemKey: "template_denied",
        tenantLabel: "Нельзя создать",
        status: "draft"
      })
    });

    expect(fields.status).toBe(403);
    await expect(fields.json()).resolves.toEqual({ error: "permission_missing" });
    expect(templateCreate.status).toBe(403);
    await expect(templateCreate.json()).resolves.toEqual({
      error: "permission_missing"
    });
  });

  it("does not leak access profiles across tenants", async () => {
    const alphaCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const betaCookie = await loginAs("beta@kiss-pm.local", "local-beta-password");
    await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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

  it("keeps access role ids scoped to each tenant", async () => {
    const alphaCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const betaCookie = await loginAs("beta@kiss-pm.local", "local-beta-password");
    const sharedRoleInput = {
      id: "access-profile-shared-local-id",
      name: "Локальная роль",
      permissions: ["tenant.users.read"]
    };

    const alphaRole = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: alphaCookie
      },
      body: JSON.stringify(sharedRoleInput)
    });
    const betaRole = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: betaCookie
      },
      body: JSON.stringify(sharedRoleInput)
    });
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const alphaRoles = await dataSource.listAccessProfilesByTenantId("tenant-alpha");
    const betaRoles = await dataSource.listAccessProfilesByTenantId("tenant-beta");

    expect(alphaRole.status).toBe(201);
    expect(betaRole.status).toBe(201);
    expect(
      alphaRoles.find((role) => role.id === sharedRoleInput.id)
    ).toMatchObject({
      tenantId: "tenant-alpha",
      id: sharedRoleInput.id
    });
    expect(
      betaRoles.find((role) => role.id === sharedRoleInput.id)
    ).toMatchObject({
      tenantId: "tenant-beta",
      id: sharedRoleInput.id
    });
  });

  it("allows clearing optional profile contact fields", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");

    const filled = await app.request("/api/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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

  it("rejects unsafe profile theme values before persistence", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");

    const invalidTheme = await app.request("/api/profile/theme", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        theme: "light injected-class",
        accentColor: "#2563eb"
      })
    });
    const invalidAccent = await app.request("/api/profile/theme", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        theme: "dark",
        accentColor: "url(https://example.invalid/pixel)"
      })
    });

    expect(invalidTheme.status).toBe(400);
    await expect(invalidTheme.json()).resolves.toEqual({ error: "invalid_theme" });
    expect(invalidAccent.status).toBe(400);
    await expect(invalidAccent.json()).resolves.toEqual({
      error: "invalid_accent_color"
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
        password: "local-admin-password"
      })
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const createdUser = await appWithFailingAudit.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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

  it("rolls back workspace config creation when audit write fails inside the transaction", async () => {
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
        password: "local-admin-password"
      })
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const createdField = await appWithFailingAudit.request(
      "/api/workspace/config/custom-fields",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          id: "field-rollback",
          systemKey: "field_rollback",
          tenantLabel: "Откат аудита",
          targetEntity: "project",
          fieldType: "text",
          status: "draft"
        })
      }
    );
    const fields = await baseDataSource.listCustomFieldDefinitions("tenant-alpha");

    expect(createdField.status).toBe(500);
    expect(fields.some((field) => field.id === "field-rollback")).toBe(false);
  });

  it("rolls back access role create, update and delete when audit write fails", async () => {
    const db = createDatabase(client);
    const baseDataSource = createPostgresTenantDataSource(db);
    await baseDataSource.createAccessProfile({
      id: "access-profile-alpha-rollback-existing",
      tenantId: "tenant-alpha",
      name: "Роль для отката",
      permissions: ["tenant.users.read"]
    });
    const appWithFailingAudit = createApp({
      dataSource: {
        ...baseDataSource,
        async appendAuditEvent() {
          throw new Error("audit_failed");
        },
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
        password: "local-admin-password"
      })
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const createdRole = await appWithFailingAudit.request(
      "/api/tenant/current/access-profiles",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          id: "access-profile-alpha-rollback-new",
          name: "Новая роль без аудита",
          permissions: ["tenant.users.read"]
        })
      }
    );
    const updatedRole = await appWithFailingAudit.request(
      "/api/workspace/access-roles/access-profile-alpha-rollback-existing",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          name: "Роль не должна сохраниться",
          permissions: ["tenant.users.read", "profile.read"]
        })
      }
    );
    const deletedRole = await appWithFailingAudit.request(
      "/api/workspace/access-roles/access-profile-alpha-rollback-existing",
      {
        method: "DELETE",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const roles = await baseDataSource.listAccessProfilesByTenantId("tenant-alpha");

    expect(createdRole.status).toBe(500);
    expect(updatedRole.status).toBe(500);
    expect(deletedRole.status).toBe(500);
    expect(
      roles.some((role) => role.id === "access-profile-alpha-rollback-new")
    ).toBe(false);
    expect(
      roles.find((role) => role.id === "access-profile-alpha-rollback-existing")
    ).toMatchObject({
      name: "Роль для отката",
      permissions: ["tenant.users.read"]
    });
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
        password: "local-admin-password"
      })
    });
    const cookie = login.headers.get("set-cookie") ?? "";

    const createdUser = await appWithoutTransaction.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
        password: "local-admin-password"
      })
    });

    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie") ?? "";

    const me = await app.request("/api/auth/me", {
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const selfDisable = await app.request("/api/workspace/users/user-alpha-admin", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
          "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
    const createUserInvalidTheme = await app.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "user-invalid-theme",
        email: "invalid-theme@kiss-pm.local",
        name: "Невалидная тема",
        accessProfileId: "access-profile-alpha-reader",
        theme: "dark extra-class",
        accentColor: "#2563eb",
        password: "product12345"
      })
    });
    const createUserInvalidAccent = await app.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "user-invalid-accent",
        email: "invalid-accent@kiss-pm.local",
        name: "Невалидный акцент",
        accessProfileId: "access-profile-alpha-reader",
        theme: "dark",
        accentColor: "rgb(37 99 235)",
        password: "product12345"
      })
    });
    const updateUserInvalidTheme = await app.request("/api/workspace/users/user-product-lead", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        email: "product@kiss-pm.local",
        name: "Полина Продукт",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-product-lead",
        status: "active",
        theme: "light injected-class",
        accentColor: "#2563eb"
      })
    });
    const updateUserInvalidAccent = await app.request(
      "/api/workspace/users/user-product-lead",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          email: "product@kiss-pm.local",
          name: "Полина Продукт",
          accessProfileId: "access-profile-alpha-reader",
          positionId: "position-product-lead",
          status: "active",
          theme: "light",
          accentColor: "url(https://example.invalid/pixel)"
        })
      }
    );
    const userWithoutPassword = await app.request("/api/workspace/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const updatedUser = await app.request("/api/workspace/users/user-product-lead", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
        "x-kiss-pm-action": "same-origin",
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
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const assignedPositionDelete = await app.request(
      "/api/workspace/positions/position-product-lead",
      {
        method: "DELETE",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const accessRole = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
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
          "x-kiss-pm-action": "same-origin",
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
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const deletedUser = await app.request("/api/workspace/users/user-product-lead", {
      method: "DELETE",
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const deletedPosition = await app.request("/api/workspace/positions/position-product-lead", {
      method: "DELETE",
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: {
        "x-kiss-pm-action": "same-origin",
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
    expect(createUserInvalidTheme.status).toBe(400);
    await expect(createUserInvalidTheme.json()).resolves.toEqual({
      error: "invalid_theme"
    });
    expect(createUserInvalidAccent.status).toBe(400);
    await expect(createUserInvalidAccent.json()).resolves.toEqual({
      error: "invalid_accent_color"
    });
    expect(updateUserInvalidTheme.status).toBe(400);
    await expect(updateUserInvalidTheme.json()).resolves.toEqual({
      error: "invalid_theme"
    });
    expect(updateUserInvalidAccent.status).toBe(400);
    await expect(updateUserInvalidAccent.json()).resolves.toEqual({
      error: "invalid_accent_color"
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



