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
      password: "admin12345"
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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-18T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("creates CRM foundation entities, creates a linked deal, opens detail and moves it across stages", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
    const productResponse = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-implementation",
        name: "Внедрение KISS PM",
        sku: "KISS-IMPL",
        type: "service",
        unit: "час",
        price: 6000,
        description: "Проектная услуга"
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
    expect(productResponse.status).toBe(201);
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

    const unrelatedOpportunityResponse = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "opportunity-unrelated",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-new",
        title: "Соседняя сделка",
        description: "Нужна для проверки opportunity-scoped ленты событий",
        plannedStart: "2026-07-01",
        plannedFinish: "2026-07-12",
        contractValue: 600000,
        plannedHourlyRate: 6000,
        probability: 50,
        templateId: null,
        demand: [{ positionId: "position-engineer", requiredHours: 100 }]
      })
    });
    expect(unrelatedOpportunityResponse.status).toBe(201);
    const unrelatedStageUpdate = await app.request(
      "/api/workspace/opportunities/opportunity-unrelated/stage",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageId: "deal-stage-qualified" })
      }
    );
    expect(unrelatedStageUpdate.status).toBe(200);

    const opportunityUpdate = await app.request(
      "/api/workspace/opportunities/opportunity-alpha",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          clientId: "client-romashka",
          primaryContactId: "contact-irina",
          projectTypeId: "project-type-implementation",
          stageId: "deal-stage-qualified",
          title: "Внедрение KISS PM обновлено",
          description: "Обновленная приемка",
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-12",
          contractValue: 1_200_000,
          plannedHourlyRate: 6_000,
          probability: 90,
          templateId: null,
          demand: [{ positionId: "position-engineer", requiredHours: 200 }]
        })
      }
    );
    expect(opportunityUpdate.status).toBe(200);
    await expect(opportunityUpdate.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-alpha",
        title: "Внедрение KISS PM обновлено",
        plannedHours: 200,
        contractValue: 1_200_000,
        plannedHourlyRate: 6_000,
        demand: [{ positionId: "position-engineer", requiredHours: 200 }],
        feasibilityStatus: null
      }
    });

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { "x-kiss-pm-action": "same-origin", cookie }
    });
    expect(audit.status).toBe(200);
    const auditBody = await audit.json();
    expect(auditBody).toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "client.created" }),
        expect.objectContaining({ actionType: "contact.created" }),
        expect.objectContaining({ actionType: "product.created" }),
        expect.objectContaining({ actionType: "project_type.created" }),
        expect.objectContaining({ actionType: "deal_stage.created" }),
        expect.objectContaining({ actionType: "opportunity.created" }),
        expect.objectContaining({
          actionType: "opportunity.stage_updated",
          sourceEntity: { type: "Opportunity", id: "opportunity-alpha" },
          input: expect.objectContaining({
            opportunityId: "opportunity-alpha",
            stageId: "deal-stage-qualified"
          })
        }),
        expect.objectContaining({ actionType: "opportunity.updated" })
      ])
    });
    const alphaEvents = filterAuditEventsForOpportunity(
      auditBody.auditEvents,
      "opportunity-alpha"
    );
    const unrelatedEvents = filterAuditEventsForOpportunity(
      auditBody.auditEvents,
      "opportunity-unrelated"
    );
    expect(alphaEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "opportunity.stage_updated",
          sourceEntity: { type: "Opportunity", id: "opportunity-alpha" }
        })
      ])
    );
    expect(alphaEvents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceEntity: { type: "Opportunity", id: "opportunity-unrelated" }
        })
      ])
    );
    expect(unrelatedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "opportunity.stage_updated",
          sourceEntity: { type: "Opportunity", id: "opportunity-unrelated" }
        })
      ])
    );
  });

  it("updates CRM foundation entities with tenant-scoped audit trail", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
        name: "ООО Ромашка",
        description: "Ключевой клиент"
      })
    });
    await app.request("/api/workspace/contacts", {
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
    await app.request("/api/workspace/project-types", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "project-type-implementation",
        name: "Внедрение",
        description: "Проект внедрения"
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

    const clientUpdate = await app.request("/api/workspace/clients/client-romashka", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "ООО Ромашка обновлено",
        description: "Обновленное описание",
        status: "active"
      })
    });
    const contactUpdate = await app.request("/api/workspace/contacts/contact-irina", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        clientId: "client-romashka",
        name: "Ирина Обновленная",
        email: "irina.updated@example.test",
        phone: "+7 913 111-11-11",
        telegram: "@irina_updated",
        role: "Спонсор",
        status: "archived"
      })
    });
    const productCreate = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-implementation",
        name: "Внедрение KISS PM",
        sku: "KISS-IMPL",
        type: "service",
        unit: "час",
        price: 6000
      })
    });
    const productUpdate = await app.request(
      "/api/workspace/products/product-implementation",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "Внедрение KISS PM расширенное",
          sku: "KISS-IMPL-PLUS",
          type: "service",
          unit: "час",
          price: 7000,
          description: "Расширенная услуга",
          status: "archived"
        })
      }
    );
    const projectTypeUpdate = await app.request(
      "/api/workspace/project-types/project-type-implementation",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "Внедрение обновлено",
          description: "Обновленный тип",
          status: "archived"
        })
      }
    );
    const stageUpdate = await app.request("/api/workspace/deal-stages/deal-stage-new", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Новая обновленная",
        sortOrder: 30,
        status: "archived"
      })
    });
    const invalidContactUpdate = await app.request("/api/workspace/contacts/contact-irina", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        clientId: "client-missing",
        name: "Ирина Обновленная",
        status: "active"
      })
    });

    expect(clientUpdate.status).toBe(200);
    expect(contactUpdate.status).toBe(200);
    expect(productCreate.status).toBe(201);
    expect(productUpdate.status).toBe(200);
    expect(projectTypeUpdate.status).toBe(200);
    expect(stageUpdate.status).toBe(200);
    expect(invalidContactUpdate.status).toBe(404);
    await expect(clientUpdate.json()).resolves.toMatchObject({
      client: {
        id: "client-romashka",
        name: "ООО Ромашка обновлено",
        status: "active"
      }
    });
    await expect(contactUpdate.json()).resolves.toMatchObject({
      contact: {
        id: "contact-irina",
        name: "Ирина Обновленная",
        role: "Спонсор",
        status: "archived"
      }
    });
    await expect(productUpdate.json()).resolves.toMatchObject({
      product: {
        id: "product-implementation",
        name: "Внедрение KISS PM расширенное",
        sku: "KISS-IMPL-PLUS",
        price: 7000,
        status: "archived"
      }
    });
    await expect(projectTypeUpdate.json()).resolves.toMatchObject({
      projectType: {
        id: "project-type-implementation",
        name: "Внедрение обновлено",
        status: "archived"
      }
    });
    await expect(stageUpdate.json()).resolves.toMatchObject({
      dealStage: {
        id: "deal-stage-new",
        name: "Новая обновленная",
        sortOrder: 30,
        status: "archived"
      }
    });

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { "x-kiss-pm-action": "same-origin", cookie }
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "client.updated",
          beforeState: expect.objectContaining({ name: "ООО Ромашка" }),
          afterState: expect.objectContaining({ name: "ООО Ромашка обновлено" })
        }),
        expect.objectContaining({ actionType: "contact.updated" }),
        expect.objectContaining({ actionType: "product.updated" }),
        expect.objectContaining({ actionType: "project_type.updated" }),
        expect.objectContaining({ actionType: "deal_stage.updated" })
      ])
    });
  });

  it("allows editing a contact on its archived current client but rejects reassignment to archived clients", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "client-current",
        name: "Текущий клиент"
      })
    });
    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "client-archived-target",
        name: "Архивный клиент"
      })
    });
    await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-current-client",
        clientId: "client-current",
        name: "Контакт текущего клиента"
      })
    });
    await app.request("/api/workspace/clients/client-current", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Текущий клиент",
        description: null,
        status: "archived"
      })
    });
    await app.request("/api/workspace/clients/client-archived-target", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Архивный клиент",
        description: null,
        status: "archived"
      })
    });

    const sameClientUpdate = await app.request(
      "/api/workspace/contacts/contact-current-client",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          clientId: "client-current",
          name: "Контакт архивированного клиента",
          email: null,
          phone: null,
          telegram: null,
          role: "Исторический контакт",
          status: "archived"
        })
      }
    );
    const reassignmentToArchivedClient = await app.request(
      "/api/workspace/contacts/contact-current-client",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          clientId: "client-archived-target",
          name: "Контакт архивированного клиента",
          status: "archived"
        })
      }
    );

    expect(sameClientUpdate.status).toBe(200);
    await expect(sameClientUpdate.json()).resolves.toMatchObject({
      contact: {
        id: "contact-current-client",
        clientId: "client-current",
        status: "archived"
      }
    });
    expect(reassignmentToArchivedClient.status).toBe(404);
    await expect(reassignmentToArchivedClient.json()).resolves.toEqual({
      error: "client_not_found"
    });
  });

  it("denies CRM foundation mutations for users without Phase 3.1 permissions", async () => {
    const cookie = await loginAs("reader@kiss-pm.local", "reader12345");
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
    const productResponse = await app.request("/api/workspace/products", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: "product-denied",
        name: "Нельзя создать",
        type: "service",
        unit: "час",
        price: 6000
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
    const clientUpdateResponse = await app.request("/api/workspace/clients/client-denied", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        name: "Нельзя изменить",
        status: "archived"
      })
    });
    const contactUpdateResponse = await app.request("/api/workspace/contacts/contact-denied", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        clientId: "client-denied",
        name: "Нельзя изменить",
        status: "archived"
      })
    });
    const productUpdateResponse = await app.request(
      "/api/workspace/products/product-denied",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          name: "Нельзя изменить",
          type: "service",
          unit: "час",
          price: 6000,
          status: "archived"
        })
      }
    );
    const projectTypeUpdateResponse = await app.request(
      "/api/workspace/project-types/project-type-denied",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          name: "Нельзя изменить",
          status: "archived"
        })
      }
    );
    const dealStageUpdateResponse = await app.request(
      "/api/workspace/deal-stages/deal-stage-denied",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          name: "Нельзя изменить",
          sortOrder: 20,
          status: "archived"
        })
      }
    );
    const auditEvents = await createPostgresTenantDataSource(
      createDatabase(client)
    ).listAuditEventsByTenantId("tenant-alpha");

    expect(clientResponse.status).toBe(403);
    expect(contactResponse.status).toBe(403);
    expect(productResponse.status).toBe(403);
    expect(projectTypeResponse.status).toBe(403);
    expect(dealStageResponse.status).toBe(403);
    expect(clientUpdateResponse.status).toBe(403);
    expect(contactUpdateResponse.status).toBe(403);
    expect(productUpdateResponse.status).toBe(403);
    expect(projectTypeUpdateResponse.status).toBe(403);
    expect(dealStageUpdateResponse.status).toBe(403);
    await expect(clientResponse.json()).resolves.toEqual({ error: "permission_missing" });
    await expect(contactResponse.json()).resolves.toEqual({ error: "permission_missing" });
    await expect(productResponse.json()).resolves.toEqual({ error: "permission_missing" });
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
        expect.objectContaining({ actionType: "product.create_denied" }),
        expect.objectContaining({ actionType: "project_type.create_denied" }),
        expect.objectContaining({ actionType: "deal_stage.create_denied" }),
        expect.objectContaining({ actionType: "client.update_denied" }),
        expect.objectContaining({ actionType: "contact.update_denied" }),
        expect.objectContaining({ actionType: "product.update_denied" }),
        expect.objectContaining({ actionType: "project_type.update_denied" }),
        expect.objectContaining({ actionType: "deal_stage.update_denied" })
      ])
    );
  });

  it("rejects oversized CRM/intake JSON payloads before parser validation", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
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

function filterAuditEventsForOpportunity(
  auditEvents: Array<{ sourceEntity?: Record<string, unknown> }>,
  opportunityId: string
) {
  return auditEvents.filter(
    (event) =>
      event.sourceEntity?.type === "Opportunity" &&
      event.sourceEntity.id === opportunityId
  );
}
