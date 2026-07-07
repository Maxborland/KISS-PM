import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  hashSessionToken,
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
        "tenant.workspace_config.read",
        "tenant.workspace_config.manage",
        "tenant.clients.read",
        "tenant.clients.manage",
        "tenant.contacts.read",
        "tenant.contacts.manage",
        "tenant.products.read",
        "tenant.products.manage",
        "tenant.project_types.read",
        "tenant.project_types.manage",
        "tenant.deal_stages.read",
        "tenant.deal_stages.manage",
        "tenant.opportunities.read",
        "tenant.opportunities.manage",
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.project_activation.manage",
        "tenant.resource_feasibility.read",
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
        "tenant.clients.read",
        "tenant.clients.manage",
        "tenant.contacts.read",
        "tenant.contacts.manage",
        "tenant.products.read",
        "tenant.products.manage",
        "tenant.project_types.read",
        "tenant.project_types.manage",
        "tenant.deal_stages.read",
        "tenant.deal_stages.manage",
        "tenant.opportunities.read",
        "tenant.opportunities.manage",
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.project_activation.manage",
        "tenant.resource_feasibility.read",
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
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка",
      description: "Клиент для Phase 3 intake"
    }
  ],
  contacts: [
    {
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      name: "Ирина Клиент",
      email: "irina@example.test",
      role: "Заказчик"
    }
  ],
  projectTypes: [
    {
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение",
      description: "Проект внедрения"
    }
  ],
  dealStages: [
    {
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
      name: "Новая",
      sortOrder: 10
    },
    {
      id: "deal-stage-qualified",
      tenantId: "tenant-alpha",
      name: "Квалификация",
      sortOrder: 20
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
      positionId: "position-engineer",
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

  function sessionTokenFromCookie(cookie: string): string {
    const token = /(?:^|;\s*)kiss_pm_session=([^;]+)/.exec(cookie)?.[1];
    expect(token).toBeDefined();
    return token ?? "";
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    const db = createDatabase(client);
    app = createApp({
      dataSource: createPostgresTenantDataSource(db),
      enableDevTenantRoutes: true
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      apiSeedDataset,
      new Date("2026-05-18T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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

  it("bounds audit event reads with a validated limit", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    for (const suffix of ["one", "two"]) {
      const response = await app.request("/api/tenant/current/access-profiles", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          id: `access-profile-alpha-audit-${suffix}`,
          name: `Audit ${suffix}`,
          permissions: ["tenant.users.read"]
        })
      });
      expect(response.status).toBe(201);
    }

    const audit = await app.request("/api/tenant/current/audit-events?limit=1", {
      headers: { cookie }
    });

    expect(audit.status).toBe(200);
    const body = (await audit.json()) as { auditEvents: Array<unknown> };
    expect(body.auditEvents).toHaveLength(1);
  });

  it("denies access-profile creation when the actor lacks management permission", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "reader12345");
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
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
    const betaCookie = await loginAs("beta@kiss-pm.local", "beta12345");
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

  it("creates an opportunity, checks feasibility, activates a project and writes audit", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const opportunityField = await app.request("/api/workspace/config/custom-fields", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "field-opportunity-priority",
        systemKey: "opportunity_priority",
        tenantLabel: "Приоритет сделки",
        targetEntity: "opportunity",
        fieldType: "text",
        required: false,
        status: "active"
      })
    });
    const opportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "opportunity-phase-3",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Внедрение KISS PM",
        description: "Первичный проект внедрения",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 960_000,
        plannedHourlyRate: 6_000,
        probability: 80,
        templateId: null,
        customFieldValues: {
          "field-opportunity-priority": "Высокий"
        },
        demand: [
          { positionId: "position-engineer", requiredHours: 80 },
          { positionId: "position-project-manager", requiredHours: 80 }
        ]
      })
    });
    const rejectedOpportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "opportunity-rejected",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Сделка без бюджета",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 120_000,
        plannedHourlyRate: 6_000,
        probability: 20,
        demand: [{ positionId: "position-engineer", requiredHours: 20 }]
      })
    });
    const rejectedFinalAction = await app.request(
      "/api/workspace/opportunities/opportunity-rejected/finalize",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          status: "lost_rejected",
          reason: "Клиент заморозил бюджет"
        })
      }
    );
    const repeatedRejectedFinalAction = await app.request(
      "/api/workspace/opportunities/opportunity-rejected/finalize",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          status: "won_closed",
          reason: "Повторная попытка"
        })
      }
    );
    const invalidOpportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "opportunity-invalid",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Некорректная сделка",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 100_000,
        plannedHourlyRate: 0,
        probability: 80,
        demand: [{ positionId: "position-engineer", requiredHours: 10 }]
      })
    });
    const feasibility = await app.request(
      "/api/workspace/opportunities/opportunity-phase-3/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const activation = await app.request(
      "/api/workspace/opportunities/opportunity-phase-3/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          id: "project-phase-3",
          acceptedRiskReason: "Запускаем с контролем загрузки руководителя проекта"
        })
      }
    );
    const repeatedFeasibility = await app.request(
      "/api/workspace/opportunities/opportunity-phase-3/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const repeatedActivation = await app.request(
      "/api/workspace/opportunities/opportunity-phase-3/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({ id: "project-phase-3-copy" })
      }
    );
    const opportunities = await app.request("/api/workspace/opportunities", {
      headers: { cookie }
    });
    const projects = await app.request("/api/workspace/projects", {
      headers: { cookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });
    const me = await app.request("/api/auth/me", {
      headers: { cookie }
    });

    expect(opportunityField.status).toBe(201);
    expect(opportunity.status).toBe(201);
    await expect(opportunity.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-phase-3",
        tenantId: "tenant-alpha",
        plannedHours: 160,
        customFieldValues: {
          "field-opportunity-priority": "Высокий"
        },
        demand: [
          { positionId: "position-engineer", requiredHours: 80 },
          { positionId: "position-project-manager", requiredHours: 80 }
        ]
      }
    });
    expect(invalidOpportunity.status).toBe(400);
    await expect(invalidOpportunity.json()).resolves.toEqual({
      error: "invalid_planned_hourly_rate"
    });
    expect(rejectedOpportunity.status).toBe(201);
    expect(rejectedFinalAction.status).toBe(200);
    await expect(rejectedFinalAction.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-rejected",
        status: "lost_rejected"
      }
    });
    expect(repeatedRejectedFinalAction.status).toBe(409);
    await expect(repeatedRejectedFinalAction.json()).resolves.toEqual({
      error: "opportunity_final_action_locked"
    });
    expect(feasibility.status).toBe(200);
    await expect(feasibility.json()).resolves.toMatchObject({
      opportunity: {
        status: "ready_to_activate",
        feasibilityStatus: "ok"
      },
      assessment: {
        plannedHours: 160,
        totalRequiredHours: 160,
        status: "ok",
        rows: expect.arrayContaining([
          expect.objectContaining({
            positionId: "position-engineer",
            requiredHours: 80,
            status: "ok"
          })
        ])
      }
    });
    expect(activation.status).toBe(201);
    await expect(activation.json()).resolves.toMatchObject({
      project: {
        id: "project-phase-3",
        tenantId: "tenant-alpha",
        sourceOpportunityId: "opportunity-phase-3",
        status: "active",
        demand: expect.arrayContaining([
          { positionId: "position-engineer", requiredHours: 80 }
        ])
      }
    });
    expect(repeatedFeasibility.status).toBe(409);
    await expect(repeatedFeasibility.json()).resolves.toEqual({
      error: "opportunity_not_feasible"
    });
    expect(repeatedActivation.status).toBe(409);
    await expect(repeatedActivation.json()).resolves.toEqual({
      error: "opportunity_not_activatable"
    });
    await expect(opportunities.json()).resolves.toMatchObject({
      opportunities: expect.arrayContaining([
        expect.objectContaining({
          id: "opportunity-phase-3",
          status: "won_closed"
        }),
        expect.objectContaining({
          id: "opportunity-rejected",
          status: "lost_rejected"
        })
      ])
    });
    await expect(projects.json()).resolves.toMatchObject({
      projects: expect.arrayContaining([
        expect.objectContaining({
          id: "project-phase-3",
          status: "active"
        })
      ])
    });
    const auditBody = await audit.json();
    expect(auditBody).toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "opportunity.created" }),
        expect.objectContaining({ actionType: "opportunity.lost_rejected" }),
        expect.objectContaining({ actionType: "opportunity.feasibility_checked" }),
        expect.objectContaining({ actionType: "project.activated" })
      ])
    });
    expect(auditBody.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "project.activated",
          beforeState: expect.objectContaining({ status: "draft" }),
          afterState: expect.objectContaining({ status: "active" })
        })
      ])
    );
    expect(me.headers.get("cache-control")).toBe("no-store, private");
    expect(opportunities.headers.get("cache-control")).toBe("no-store, private");
    expect(projects.headers.get("cache-control")).toBe("no-store, private");
  });

  it("keeps project drafts out of the active projects workspace API", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const opportunity = await dataSource.createOpportunity({
      id: "opportunity-draft-hidden",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      title: "Черновик вне боевой зоны",
      projectType: "Внедрение",
      description: null,
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
      contractValue: 480_000,
      plannedHourlyRate: 6_000,
      plannedHours: 80,
      probability: 80,
      status: "ready_to_activate",
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 80 }]
    });
    const draft = await dataSource.createProjectDraftFromOpportunity({
      id: "project-draft-hidden",
      tenantId: opportunity.tenantId,
      sourceOpportunityId: opportunity.id,
      clientId: opportunity.clientId,
      projectTypeId: opportunity.projectTypeId,
      title: opportunity.title,
      clientName: opportunity.clientName,
      status: "draft",
      plannedStart: opportunity.plannedStart,
      plannedFinish: opportunity.plannedFinish,
      contractValue: opportunity.contractValue,
      plannedHours: opportunity.plannedHours,
      templateId: opportunity.templateId,
      demand: opportunity.demand
    });
    const activeProjects = await app.request("/api/workspace/projects", {
      headers: { cookie }
    });

    expect(draft).toMatchObject({
      id: "project-draft-hidden",
      status: "draft",
      activatedAt: null
    });
    expect(activeProjects.status).toBe(200);
    await expect(activeProjects.json()).resolves.toEqual({ projects: [] });
  });

  it("rechecks current resource capacity during project activation", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const baseOpportunity = {
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-12",
      contractValue: 480_000,
      plannedHourlyRate: 6_000,
      probability: 80,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 80 }]
    };

    const firstOpportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        ...baseOpportunity,
        id: "opportunity-stale-feasibility",
        title: "Проект со старой проверкой"
      })
    });
    const firstFeasibility = await app.request(
      "/api/workspace/opportunities/opportunity-stale-feasibility/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const competingOpportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        ...baseOpportunity,
        id: "opportunity-capacity-consumer",
        title: "Проект, занявший ресурс"
      })
    });
    const competingFeasibility = await app.request(
      "/api/workspace/opportunities/opportunity-capacity-consumer/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const competingActivation = await app.request(
      "/api/workspace/opportunities/opportunity-capacity-consumer/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({ id: "project-capacity-consumer" })
      }
    );
    const staleActivation = await app.request(
      "/api/workspace/opportunities/opportunity-stale-feasibility/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({ id: "project-stale-feasibility" })
      }
    );
    const acceptedRiskActivation = await app.request(
      "/api/workspace/opportunities/opportunity-stale-feasibility/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          id: "project-stale-feasibility",
          acceptedRiskReason: "Подтвержден осознанный запуск при дефиците инженера"
        })
      }
    );

    expect(firstOpportunity.status).toBe(201);
    expect(firstFeasibility.status).toBe(200);
    await expect(firstFeasibility.json()).resolves.toMatchObject({
      assessment: { status: "ok" }
    });
    expect(competingOpportunity.status).toBe(201);
    expect(competingFeasibility.status).toBe(200);
    expect(competingActivation.status).toBe(201);
    expect(staleActivation.status).toBe(409);
    await expect(staleActivation.json()).resolves.toEqual({
      error: "risk_acceptance_required"
    });
    expect(acceptedRiskActivation.status).toBe(201);
  });

  it("serializes concurrent activations that compete for the same position capacity", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const baseOpportunity = {
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-12",
      contractValue: 480_000,
      plannedHourlyRate: 6_000,
      probability: 80,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 80 }]
    };
    await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        ...baseOpportunity,
        id: "opportunity-concurrent-a",
        title: "Конкурентный проект A"
      })
    });
    await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        ...baseOpportunity,
        id: "opportunity-concurrent-b",
        title: "Конкурентный проект B"
      })
    });
    const feasibilityA = await app.request(
      "/api/workspace/opportunities/opportunity-concurrent-a/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const feasibilityB = await app.request(
      "/api/workspace/opportunities/opportunity-concurrent-b/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const [activationA, activationB] = await Promise.all([
      app.request("/api/workspace/opportunities/opportunity-concurrent-a/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({ id: "project-concurrent-a" })
      }),
      app.request("/api/workspace/opportunities/opportunity-concurrent-b/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({ id: "project-concurrent-b" })
      })
    ]);
    const projects = await app.request("/api/workspace/projects", {
      headers: { cookie }
    });

    expect(feasibilityA.status).toBe(200);
    expect(feasibilityB.status).toBe(200);
    expect([activationA.status, activationB.status].sort()).toEqual([201, 409]);
    const rejectedActivation = activationA.status === 409 ? activationA : activationB;
    await expect(rejectedActivation.json()).resolves.toEqual({
      error: "risk_acceptance_required"
    });
    await expect(projects.json()).resolves.toMatchObject({
      projects: expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/^project-concurrent-/) })
      ])
    });
  });

  it("denies opportunity and project reads and mutations for users without Phase 3 permissions", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "reader12345");

    const opportunities = await app.request("/api/workspace/opportunities", {
      headers: { cookie }
    });
    const projects = await app.request("/api/workspace/projects", {
      headers: { cookie }
    });
    const createOpportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "opportunity-denied",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Недоступная сделка",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 100_000,
        plannedHourlyRate: 5_000,
        probability: 50,
        demand: [{ positionId: "position-engineer", requiredHours: 10 }]
      })
    });
    const malformedCreateOpportunity = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: "{"
    });
    const feasibility = await app.request(
      "/api/workspace/opportunities/opportunity-denied/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );
    const activation = await app.request(
      "/api/workspace/opportunities/opportunity-denied/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({ id: "project-denied" })
      }
    );
    const finalAction = await app.request(
      "/api/workspace/opportunities/opportunity-denied/finalize",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          status: "lost_rejected",
          reason: "Нет доступа"
        })
      }
    );
    const malformedActivation = await app.request(
      "/api/workspace/opportunities/opportunity-denied/activate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: "{"
      }
    );
    const auditEvents = await createPostgresTenantDataSource(
      createDatabase(client)
    ).listAuditEventsByTenantId("tenant-alpha");

    expect(opportunities.status).toBe(403);
    expect(projects.status).toBe(403);
    expect(createOpportunity.status).toBe(403);
    expect(malformedCreateOpportunity.status).toBe(403);
    expect(feasibility.status).toBe(403);
    expect(activation.status).toBe(403);
    expect(finalAction.status).toBe(403);
    expect(malformedActivation.status).toBe(403);
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: "user-alpha-reader",
          actionType: "opportunity.create_denied",
          permissionResult: expect.objectContaining({
            allowed: false,
            reason: "permission_missing"
          }),
          executionResult: expect.objectContaining({
            status: "denied"
          })
        }),
        expect.objectContaining({
          actorUserId: "user-alpha-reader",
          actionType: "opportunity.feasibility_denied",
          sourceEntity: {
            type: "Opportunity",
            id: "opportunity-denied"
          },
          executionResult: expect.objectContaining({
            status: "denied"
          })
        }),
        expect.objectContaining({
          actorUserId: "user-alpha-reader",
          actionType: "project.activation_denied",
          sourceEntity: {
            type: "Opportunity",
            id: "opportunity-denied"
          },
          executionResult: expect.objectContaining({
            status: "denied"
          })
        }),
        expect.objectContaining({
          actorUserId: "user-alpha-reader",
          actionType: "opportunity.final_action_denied",
          sourceEntity: {
            type: "Opportunity",
            id: "opportunity-denied"
          },
          executionResult: expect.objectContaining({
            status: "denied"
          })
        })
      ])
    );
  });

  it("denies workspace config read and mutation for users without config permissions", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "reader12345");

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
    const alphaCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const betaCookie = await loginAs("beta@kiss-pm.local", "beta12345");
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
    const alphaCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const betaCookie = await loginAs("beta@kiss-pm.local", "beta12345");
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
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");

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
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");

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
        password: "admin12345"
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
        password: "admin12345"
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
        password: "admin12345"
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
        password: "admin12345"
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

  it("returns a stable conflict when concurrent workspace user creates reuse an email", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };
    const body = {
      email: "race-user@kiss-pm.local",
      name: "Гонка Пользователя",
      accessProfileId: "access-profile-alpha-reader",
      password: "race12345"
    };

    const [first, second] = await Promise.all([
      app.request("/api/workspace/users", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, id: "user-race-a" })
      }),
      app.request("/api/workspace/users", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, id: "user-race-b" })
      })
    ]);
    const statuses = [first.status, second.status].sort();
    const conflict = first.status === 409 ? first : second;
    const users = await app.request("/api/workspace/users", {
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const usersBody = await users.json() as {
      users: Array<{ email: string }>;
    };

    expect(statuses).toEqual([201, 409]);
    await expect(conflict.json()).resolves.toEqual({
      error: "user_email_taken"
    });
    expect(
      usersBody.users.filter((user) => user.email === "race-user@kiss-pm.local")
    ).toHaveLength(1);
  });

  it("returns a stable conflict when concurrent workspace user updates reuse an email", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const createA = await app.request("/api/workspace/users", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "user-email-race-a",
        email: "email-race-a@kiss-pm.local",
        name: "Гонка Email A",
        accessProfileId: "access-profile-alpha-reader",
        password: "raceA12345"
      })
    });
    const createB = await app.request("/api/workspace/users", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "user-email-race-b",
        email: "email-race-b@kiss-pm.local",
        name: "Гонка Email B",
        accessProfileId: "access-profile-alpha-reader",
        password: "raceB12345"
      })
    });
    expect([createA.status, createB.status]).toEqual([201, 201]);

    const [first, second] = await Promise.all([
      app.request("/api/workspace/users/user-email-race-a", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          email: "email-race-shared@kiss-pm.local",
          name: "Гонка Email A",
          accessProfileId: "access-profile-alpha-reader",
          status: "active"
        })
      }),
      app.request("/api/workspace/users/user-email-race-b", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          email: "email-race-shared@kiss-pm.local",
          name: "Гонка Email B",
          accessProfileId: "access-profile-alpha-reader",
          status: "active"
        })
      })
    ]);
    const statuses = [first.status, second.status].sort();
    const conflict = first.status === 409 ? first : second;
    const users = await app.request("/api/workspace/users", {
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const usersBody = await users.json() as {
      users: Array<{ email: string }>;
    };

    expect(statuses).toEqual([200, 409]);
    await expect(conflict.json()).resolves.toEqual({
      error: "user_email_taken"
    });
    expect(
      usersBody.users.filter(
        (user) => user.email === "email-race-shared@kiss-pm.local"
      )
    ).toHaveLength(1);
  });

  it("returns a stable conflict when concurrent access role creates reuse an id", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const [first, second] = await Promise.all([
      app.request("/api/tenant/current/access-profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "access-profile-alpha-race",
          name: "Роль Гонка A",
          permissions: ["tenant.users.read"]
        })
      }),
      app.request("/api/tenant/current/access-profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "access-profile-alpha-race",
          name: "Роль Гонка B",
          permissions: ["tenant.users.read"]
        })
      })
    ]);
    const statuses = [first.status, second.status].sort();
    const conflict = first.status === 409 ? first : second;
    const profiles = await app.request("/api/tenant/current/access-profiles", {
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const profilesBody = await profiles.json() as {
      accessProfiles: Array<{ id: string }>;
    };

    expect(statuses).toEqual([201, 409]);
    await expect(conflict.json()).resolves.toEqual({
      error: "access_role_id_taken"
    });
    expect(
      profilesBody.accessProfiles.filter(
        (profile) => profile.id === "access-profile-alpha-race"
      )
    ).toHaveLength(1);
  });

  it("returns a stable conflict when concurrent access role creates reuse a name", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const [first, second] = await Promise.all([
      app.request("/api/tenant/current/access-profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "access-profile-alpha-name-race-a",
          name: "Роль Гонка Имени",
          permissions: ["tenant.users.read"]
        })
      }),
      app.request("/api/tenant/current/access-profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "access-profile-alpha-name-race-b",
          name: "Роль Гонка Имени",
          permissions: ["tenant.users.read"]
        })
      })
    ]);
    const statuses = [first.status, second.status].sort();
    const conflict = first.status === 409 ? first : second;
    const profiles = await app.request("/api/tenant/current/access-profiles", {
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const profilesBody = await profiles.json() as {
      accessProfiles: Array<{ name: string }>;
    };

    expect(statuses).toEqual([201, 409]);
    await expect(conflict.json()).resolves.toEqual({
      error: "access_role_name_taken"
    });
    expect(
      profilesBody.accessProfiles.filter(
        (profile) => profile.name === "Роль Гонка Имени"
      )
    ).toHaveLength(1);
  });

  it("returns a stable conflict when concurrent access role updates reuse a name", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const createA = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "access-profile-alpha-name-update-race-a",
        name: "Роль Update Race A",
        permissions: ["tenant.users.read"]
      })
    });
    const createB = await app.request("/api/tenant/current/access-profiles", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "access-profile-alpha-name-update-race-b",
        name: "Роль Update Race B",
        permissions: ["tenant.users.read"]
      })
    });
    expect([createA.status, createB.status]).toEqual([201, 201]);

    const [first, second] = await Promise.all([
      app.request(
        "/api/workspace/access-roles/access-profile-alpha-name-update-race-a",
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name: "Роль Общая После Гонки",
            permissions: ["tenant.users.read"]
          })
        }
      ),
      app.request(
        "/api/workspace/access-roles/access-profile-alpha-name-update-race-b",
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name: "Роль Общая После Гонки",
            permissions: ["tenant.users.read"]
          })
        }
      )
    ]);
    const statuses = [first.status, second.status].sort();
    const conflict = first.status === 409 ? first : second;
    const profiles = await app.request("/api/tenant/current/access-profiles", {
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie
      }
    });
    const profilesBody = await profiles.json() as {
      accessProfiles: Array<{ name: string }>;
    };

    expect(statuses).toEqual([200, 409]);
    await expect(conflict.json()).resolves.toEqual({
      error: "access_role_name_taken"
    });
    expect(
      profilesBody.accessProfiles.filter(
        (profile) => profile.name === "Роль Общая После Гонки"
      )
    ).toHaveLength(1);
  });

  it("keeps tenant security policy save idempotent under duplicate concurrent writes", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };
    const body = {
      securityPolicy: {
        twoFactorRequired: true,
        sessionTimeoutHours: 12,
        ssoSamlEnabled: false,
        domainAllowlist: ["KISS-PM.LOCAL", " kiss-pm.local ", "Example.TEST"]
      }
    };

    const [first, second] = await Promise.all([
      app.request("/api/tenant/current/security-policy", {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
      }),
      app.request("/api/tenant/current/security-policy", {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
      })
    ]);
    const readback = await app.request("/api/tenant/current/security-policy", {
      headers: { cookie }
    });
    const policyRows =
      await client`SELECT count(*)::text AS count FROM tenant_security_policies WHERE tenant_id = 'tenant-alpha'`;

    expect([first.status, second.status]).toEqual([200, 200]);
    await expect(first.json()).resolves.toEqual({
      securityPolicy: {
        twoFactorRequired: true,
        sessionTimeoutHours: 12,
        ssoSamlEnabled: false,
        domainAllowlist: ["kiss-pm.local", "example.test"]
      }
    });
    await expect(second.json()).resolves.toEqual({
      securityPolicy: {
        twoFactorRequired: true,
        sessionTimeoutHours: 12,
        ssoSamlEnabled: false,
        domainAllowlist: ["kiss-pm.local", "example.test"]
      }
    });
    await expect(readback.json()).resolves.toEqual({
      securityPolicy: {
        twoFactorRequired: true,
        sessionTimeoutHours: 12,
        ssoSamlEnabled: false,
        domainAllowlist: ["kiss-pm.local", "example.test"]
      }
    });
    expect(policyRows[0]?.count).toBe("1");
  });

  it("keeps repeated user deactivate and reactivate writes stable with readback", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };
    const createUser = await app.request("/api/workspace/users", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "user-repeat-status",
        email: "repeat-status@kiss-pm.local",
        name: "Повтор Статуса",
        accessProfileId: "access-profile-alpha-reader",
        password: "repeat12345"
      })
    });
    expect(createUser.status).toBe(201);

    const userLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "repeat-status@kiss-pm.local",
        password: "repeat12345"
      })
    });
    expect(userLogin.status).toBe(200);
    const userSessionToken = sessionTokenFromCookie(
      userLogin.headers.get("set-cookie") ?? ""
    );
    const sessionRepository = createPostgresTenantDataSource(createDatabase(client));
    await expect(
      sessionRepository.findSessionByTokenHash(hashSessionToken(userSessionToken))
    ).resolves.toMatchObject({
      tenantId: "tenant-alpha",
      userId: "user-repeat-status"
    });

    const inactiveBody = {
      email: "repeat-status@kiss-pm.local",
      name: "Повтор Статуса",
      accessProfileId: "access-profile-alpha-reader",
      status: "inactive"
    };
    const [firstDisable, secondDisable] = await Promise.all([
      app.request("/api/workspace/users/user-repeat-status", {
        method: "PATCH",
        headers,
        body: JSON.stringify(inactiveBody)
      }),
      app.request("/api/workspace/users/user-repeat-status", {
        method: "PATCH",
        headers,
        body: JSON.stringify(inactiveBody)
      })
    ]);
    const inactiveUsers = await app.request("/api/workspace/users", {
      headers: { cookie }
    });
    const inactiveLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "repeat-status@kiss-pm.local",
        password: "repeat12345"
      })
    });

    expect([firstDisable.status, secondDisable.status]).toEqual([200, 200]);
    await expect(
      sessionRepository.findSessionByTokenHash(hashSessionToken(userSessionToken))
    ).resolves.toBeUndefined();
    await expect(inactiveUsers.json()).resolves.toMatchObject({
      users: expect.arrayContaining([
        expect.objectContaining({
          id: "user-repeat-status",
          status: "inactive"
        })
      ])
    });
    expect(inactiveLogin.status).toBe(403);
    await expect(inactiveLogin.json()).resolves.toEqual({ error: "user_inactive" });

    const activeBody = { ...inactiveBody, status: "active" };
    const [firstReactivate, secondReactivate] = await Promise.all([
      app.request("/api/workspace/users/user-repeat-status", {
        method: "PATCH",
        headers,
        body: JSON.stringify(activeBody)
      }),
      app.request("/api/workspace/users/user-repeat-status", {
        method: "PATCH",
        headers,
        body: JSON.stringify(activeBody)
      })
    ]);
    const activeUsers = await app.request("/api/workspace/users", {
      headers: { cookie }
    });
    const activeLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "repeat-status@kiss-pm.local",
        password: "repeat12345"
      })
    });

    expect([firstReactivate.status, secondReactivate.status]).toEqual([200, 200]);
    await expect(activeUsers.json()).resolves.toMatchObject({
      users: expect.arrayContaining([
        expect.objectContaining({
          id: "user-repeat-status",
          status: "active"
        })
      ])
    });
    expect(activeLogin.status).toBe(200);
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
    const newEmailCookie = newEmailLogin.headers.get("set-cookie") ?? "";
    const productSessionToken = sessionTokenFromCookie(newEmailCookie);
    const sessionRepository = createPostgresTenantDataSource(createDatabase(client));
    const productSessionBeforeDisable =
      await sessionRepository.findSessionByTokenHash(
        hashSessionToken(productSessionToken)
      );
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
    const productSessionAfterDisable =
      await sessionRepository.findSessionByTokenHash(
        hashSessionToken(productSessionToken)
      );
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
    expect(productSessionBeforeDisable).toMatchObject({
      tenantId: "tenant-alpha",
      userId: "user-product-lead"
    });
    expect(disabledUser.status).toBe(200);
    expect(productSessionAfterDisable).toBeUndefined();
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
