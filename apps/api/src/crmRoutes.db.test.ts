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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-18T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
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

});
