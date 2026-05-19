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

const dataset: SeedTenantDataset = {
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
        "tenant.clients.read",
        "tenant.clients.manage",
        "tenant.contacts.read",
        "tenant.contacts.manage",
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
        "tenant.positions.read",
        "tenant.audit_events.read"
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
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "local-admin-password"
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

describe("Phase 3.1 CRM API", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client)),
      enableDevTenantRoutes: true
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-18T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("creates CRM foundation entities, creates a linked deal, opens detail and moves it across stages", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const clientResponse = await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "client-romashka",
        name: "ООО Ромашка",
        description: "Ключевой клиент"
      })
    });
    const contactResponse = await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-irina",
        clientId: "client-romashka",
        name: "Ирина Клиент",
        email: "irina@example.test",
        phone: "+7 913 000-00-00",
        telegram: "@irina",
        role: "Заказчик"
      })
    });
    const projectTypeResponse = await app.request("/api/workspace/project-types", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "project-type-implementation",
        name: "Внедрение",
        description: "Проект внедрения"
      })
    });
    const firstStageResponse = await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "deal-stage-new",
        name: "Новая",
        sortOrder: 10
      })
    });
    const secondStageResponse = await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "deal-stage-qualified",
        name: "Квалификация",
        sortOrder: 20
      })
    });

    expect(clientResponse.status).toBe(201);
    expect(contactResponse.status).toBe(201);
    expect(projectTypeResponse.status).toBe(201);
    expect(firstStageResponse.status).toBe(201);
    expect(secondStageResponse.status).toBe(201);

    const opportunityResponse = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "opportunity-alpha",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Внедрение KISS PM",
        description: "Первичный проект внедрения",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 960000,
        plannedHourlyRate: 6000,
        probability: 80,
        templateId: null,
        demand: [{ positionId: "position-engineer", requiredHours: 120 }]
      })
    });
    expect(opportunityResponse.status).toBe(201);
    await expect(opportunityResponse.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-alpha",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        clientName: "ООО Ромашка",
        contactName: "Ирина Клиент",
        projectType: "Внедрение"
      }
    });

    const detail = await app.request("/api/workspace/opportunities/opportunity-alpha", {
      headers: { "x-kiss-pm-action": "same-origin", cookie }
    });
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-alpha",
        clientName: "ООО Ромашка",
        contactName: "Ирина Клиент",
        projectType: "Внедрение"
      }
    });

    const stageUpdate = await app.request(
      "/api/workspace/opportunities/opportunity-alpha/stage",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageId: "deal-stage-qualified" })
      }
    );
    expect(stageUpdate.status).toBe(200);
    await expect(stageUpdate.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-alpha",
        stageId: "deal-stage-qualified"
      }
    });

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { "x-kiss-pm-action": "same-origin", cookie }
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "client.created" }),
        expect.objectContaining({ actionType: "contact.created" }),
        expect.objectContaining({ actionType: "project_type.created" }),
        expect.objectContaining({ actionType: "deal_stage.created" }),
        expect.objectContaining({ actionType: "opportunity.created" }),
        expect.objectContaining({ actionType: "opportunity.stage_updated" })
      ])
    });
  });

  it("denies CRM foundation mutations for users without Phase 3.1 permissions", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "local-reader-password");
    const clientResponse = await app.request("/api/workspace/clients", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "client-denied",
        name: "Нельзя создать"
      })
    });
    const contactResponse = await app.request("/api/workspace/contacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "contact-denied",
        clientId: "client-denied",
        name: "Нельзя создать"
      })
    });
    const projectTypeResponse = await app.request("/api/workspace/project-types", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "project-type-denied",
        name: "Нельзя создать"
      })
    });
    const dealStageResponse = await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "deal-stage-denied",
        name: "Нельзя создать",
        sortOrder: 10
      })
    });
    const auditEvents = await createPostgresTenantDataSource(
      createDatabase(client)
    ).listAuditEventsByTenantId("tenant-alpha");

    expect(clientResponse.status).toBe(403);
    expect(contactResponse.status).toBe(403);
    expect(projectTypeResponse.status).toBe(403);
    expect(dealStageResponse.status).toBe(403);
    await expect(clientResponse.json()).resolves.toEqual({ error: "permission_missing" });
    await expect(contactResponse.json()).resolves.toEqual({ error: "permission_missing" });
    await expect(projectTypeResponse.json()).resolves.toEqual({
      error: "permission_missing"
    });
    await expect(dealStageResponse.json()).resolves.toEqual({
      error: "permission_missing"
    });
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: "client.create_denied" }),
        expect.objectContaining({ actionType: "contact.create_denied" }),
        expect.objectContaining({ actionType: "project_type.create_denied" }),
        expect.objectContaining({ actionType: "deal_stage.create_denied" })
      ])
    );
  });

  it("rejects oversized CRM/intake JSON payloads before parser validation", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const largeDescription = "x".repeat(70_000);
    const clientResponse = await app.request("/api/workspace/clients", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "client-too-large",
        name: "Слишком большой payload",
        description: largeDescription
      })
    });
    const opportunityResponse = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "opportunity-too-large",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Слишком большая сделка",
        description: largeDescription,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 960000,
        plannedHourlyRate: 6000,
        probability: 80,
        demand: [{ positionId: "position-engineer", requiredHours: 120 }]
      })
    });

    expect(clientResponse.status).toBe(413);
    await expect(clientResponse.json()).resolves.toEqual({
      error: "payload_too_large"
    });
    expect(opportunityResponse.status).toBe(413);
    await expect(opportunityResponse.json()).resolves.toEqual({
      error: "payload_too_large"
    });
  });

  it("rejects malformed JSON before activating a project with generated defaults", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "client-romashka",
        name: "ООО Ромашка"
      })
    });
    await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-irina",
        clientId: "client-romashka",
        name: "Ирина Клиент"
      })
    });
    await app.request("/api/workspace/project-types", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "project-type-implementation",
        name: "Внедрение"
      })
    });
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "deal-stage-new",
        name: "Новая",
        sortOrder: 10
      })
    });
    await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "opportunity-invalid-json-activation",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Проверка invalid JSON",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 960000,
        plannedHourlyRate: 6000,
        probability: 80,
        demand: [{ positionId: "position-engineer", requiredHours: 120 }]
      })
    });
    await app.request(
      "/api/workspace/opportunities/opportunity-invalid-json-activation/feasibility",
      {
        method: "POST",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie
        }
      }
    );

    const activation = await app.request(
      "/api/workspace/opportunities/opportunity-invalid-json-activation/activate",
      {
        method: "POST",
        headers,
        body: "{"
      }
    );
    const projects = await app.request("/api/workspace/projects", {
      headers: { cookie }
    });

    expect(activation.status).toBe(400);
    await expect(activation.json()).resolves.toEqual({ error: "invalid_json" });
    await expect(projects.json()).resolves.toEqual({ projects: [] });
  });
});
