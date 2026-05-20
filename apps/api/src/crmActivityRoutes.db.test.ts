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
        "tenant.positions.read",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-alpha-opportunity-reader",
      tenantId: "tenant-alpha",
      name: "CRM наблюдатель",
      permissions: ["tenant.opportunities.read"]
    },
    {
      id: "access-profile-alpha-no-crm",
      tenantId: "tenant-alpha",
      name: "Без CRM",
      permissions: ["tenant.users.read"]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
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
        "tenant.positions.read",
        "tenant.audit_events.read"
      ]
    }
  ],
  positions: [
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" },
    { id: "position-beta-engineer", tenantId: "tenant-beta", name: "Инженер" }
  ],
  clients: [
    {
      id: "client-alpha",
      tenantId: "tenant-alpha",
      name: "ООО Альфа"
    },
    {
      id: "client-beta",
      tenantId: "tenant-beta",
      name: "ООО Бета"
    }
  ],
  contacts: [
    {
      id: "contact-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      name: "Ирина Альфа"
    },
    {
      id: "contact-beta",
      tenantId: "tenant-beta",
      clientId: "client-beta",
      name: "Иван Бета"
    }
  ],
  products: [
    {
      id: "product-alpha",
      tenantId: "tenant-alpha",
      name: "Внедрение KISS PM",
      type: "service",
      unit: "час",
      price: 6000
    }
  ],
  projectTypes: [
    {
      id: "project-type-alpha",
      tenantId: "tenant-alpha",
      name: "Внедрение"
    },
    {
      id: "project-type-beta",
      tenantId: "tenant-beta",
      name: "Внедрение"
    }
  ],
  dealStages: [
    {
      id: "deal-stage-alpha-new",
      tenantId: "tenant-alpha",
      name: "Новая",
      sortOrder: 10
    },
    {
      id: "deal-stage-alpha-qualified",
      tenantId: "tenant-alpha",
      name: "Квалификация",
      sortOrder: 20
    },
    {
      id: "deal-stage-beta-new",
      tenantId: "tenant-beta",
      name: "Новая",
      sortOrder: 10
    }
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
      id: "user-alpha-opportunity-reader",
      tenantId: "tenant-alpha",
      email: "reader@kiss-pm.local",
      name: "Роман Наблюдатель",
      accessProfileId: "access-profile-alpha-opportunity-reader",
      password: "reader12345"
    },
    {
      id: "user-alpha-no-crm",
      tenantId: "tenant-alpha",
      email: "no-crm@kiss-pm.local",
      name: "Нина Без CRM",
      accessProfileId: "access-profile-alpha-no-crm",
      password: "no-crm12345"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      name: "Борис Бета",
      accessProfileId: "access-profile-beta-admin",
      positionId: "position-beta-engineer",
      password: "beta12345"
    }
  ]
};

describe("CRM activity API", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client)),
      enableDevTenantRoutes: true
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, crm_activities, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, products, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-20T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, crm_activities, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, products, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("creates comments and tasks, completes a task and exposes scoped feed", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createAlphaOpportunity(cookie, "opportunity-alpha");

    const comment = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/comments",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ body: "Команда подтвердила ресурсное окно" })
      }
    );
    expect(comment.status).toBe(201);
    await expect(comment.json()).resolves.toMatchObject({
      activity: {
        entityType: "opportunity",
        entityId: "opportunity-alpha",
        type: "comment",
        title: null,
        body: "Команда подтвердила ресурсное окно",
        status: null,
        authorUserId: "user-alpha-admin"
      }
    });

    const task = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/tasks",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({
          title: "Подготовить КП",
          body: "Сверить нагрузку инженера",
          dueDate: "2026-06-01",
          assigneeUserId: "user-alpha-admin"
        })
      }
    );
    expect(task.status).toBe(201);
    const taskPayload = (await task.json()) as { activity: { id: string } };

    const complete = await app.request(
      `/api/workspace/crm/opportunity/opportunity-alpha/tasks/${taskPayload.activity.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ status: "done" })
      }
    );
    expect(complete.status).toBe(200);
    await expect(complete.json()).resolves.toMatchObject({
      activity: {
        id: taskPayload.activity.id,
        type: "task",
        status: "done"
      }
    });

    const feed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/activity",
      { headers: { cookie } }
    );
    expect(feed.status).toBe(200);
    const feedPayload = await feed.json();
    expect(feedPayload).toMatchObject({
      canReadRawAudit: true,
      activities: expect.arrayContaining([
        expect.objectContaining({ type: "comment", body: "Команда подтвердила ресурсное окно" }),
        expect.objectContaining({ type: "task", title: "Подготовить КП", status: "done" })
      ]),
      systemEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "crm_activity.opportunity.comment.created" }),
        expect.objectContaining({ actionType: "crm_activity.opportunity.task.created" }),
        expect.objectContaining({ actionType: "crm_activity.opportunity.task.completed" })
      ]),
      auditEvents: expect.arrayContaining([
        expect.objectContaining({ actionType: "crm_activity.opportunity.task.completed" })
      ])
    });
    expect(feedPayload.systemEvents[0]).not.toHaveProperty("input");
    expect(feedPayload.systemEvents[0]).not.toHaveProperty("beforeState");
    expect(feedPayload.systemEvents[0]).not.toHaveProperty("afterState");
  });

  it("filters activity and audit projection by opportunity and tenant", async () => {
    const alphaCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const betaCookie = await loginAs("beta@kiss-pm.local", "beta12345");
    await createAlphaOpportunity(alphaCookie, "opportunity-alpha");
    await createAlphaOpportunity(alphaCookie, "opportunity-neighbor");
    await createBetaOpportunity(betaCookie, "opportunity-beta");

    const alphaComment = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/comments",
      {
        method: "POST",
        headers: jsonHeaders(alphaCookie),
        body: JSON.stringify({ body: "Комментарий альфа" })
      }
    );
    expect(alphaComment.status).toBe(201);
    const neighborComment = await app.request(
      "/api/workspace/crm/opportunity/opportunity-neighbor/comments",
      {
        method: "POST",
        headers: jsonHeaders(alphaCookie),
        body: JSON.stringify({ body: "Комментарий соседней сделки" })
      }
    );
    expect(neighborComment.status).toBe(201);
    const betaComment = await app.request(
      "/api/workspace/crm/opportunity/opportunity-beta/comments",
      {
        method: "POST",
        headers: jsonHeaders(betaCookie),
        body: JSON.stringify({ body: "Комментарий бета" })
      }
    );
    expect(betaComment.status).toBe(201);

    const feed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/activity",
      { headers: { cookie: alphaCookie } }
    );
    expect(feed.status).toBe(200);
    const feedPayload = await feed.json();
    expect(feedPayload.activities).toEqual([
      expect.objectContaining({
        entityType: "opportunity",
        entityId: "opportunity-alpha",
        body: "Комментарий альфа"
      })
    ]);
    expect(feedPayload.systemEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: "crm_activity.opportunity.comment.created" })
      ])
    );
    expect(JSON.stringify(feedPayload)).not.toContain("Комментарий соседней сделки");
    expect(JSON.stringify(feedPayload)).not.toContain("Комментарий бета");

    const crossTenant = await app.request(
      "/api/workspace/crm/opportunity/opportunity-beta/activity",
      { headers: { cookie: alphaCookie } }
    );
    expect(crossTenant.status).toBe(404);
  });

  it("persists real activity for client, contact and product detail workspaces", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const clientComment = await app.request(
      "/api/workspace/crm/client/client-alpha/comments",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ body: "Клиент подтвердил контактное лицо" })
      }
    );
    expect(clientComment.status).toBe(201);

    const contactTask = await app.request(
      "/api/workspace/crm/contact/contact-alpha/tasks",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ title: "Уточнить ожидания ЛПР" })
      }
    );
    expect(contactTask.status).toBe(201);

    const productFile = await app.request(
      "/api/workspace/crm/product/product-alpha/files",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({
          title: "Описание услуги",
          fileUrl: "https://example.test/service.pdf",
          fileSizeBytes: 4096,
          mimeType: "application/pdf"
        })
      }
    );
    expect(productFile.status).toBe(201);

    const [clientFeed, contactFeed, productFeed] = await Promise.all([
      app.request("/api/workspace/crm/client/client-alpha/activity", {
        headers: { cookie }
      }),
      app.request("/api/workspace/crm/contact/contact-alpha/activity", {
        headers: { cookie }
      }),
      app.request("/api/workspace/crm/product/product-alpha/activity", {
        headers: { cookie }
      })
    ]);
    expect(clientFeed.status).toBe(200);
    expect(contactFeed.status).toBe(200);
    expect(productFeed.status).toBe(200);

    await expect(clientFeed.json()).resolves.toMatchObject({
      activities: [
        expect.objectContaining({
          entityType: "client",
          entityId: "client-alpha",
          type: "comment",
          body: "Клиент подтвердил контактное лицо"
        })
      ]
    });
    await expect(contactFeed.json()).resolves.toMatchObject({
      activities: [
        expect.objectContaining({
          entityType: "contact",
          entityId: "contact-alpha",
          type: "task",
          title: "Уточнить ожидания ЛПР"
        })
      ]
    });
    await expect(productFeed.json()).resolves.toMatchObject({
      activities: [
        expect.objectContaining({
          entityType: "product",
          entityId: "product-alpha",
          type: "file",
          fileUrl: "https://example.test/service.pdf"
        })
      ]
    });
  });

  it("hides raw audit without audit permission and denies restricted mutations", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("reader@kiss-pm.local", "reader12345");
    const noCrmCookie = await loginAs("no-crm@kiss-pm.local", "no-crm12345");
    await createAlphaOpportunity(adminCookie, "opportunity-alpha");

    const deniedComment = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/comments",
      {
        method: "POST",
        headers: jsonHeaders(readerCookie),
        body: JSON.stringify({ body: "Нельзя писать без manage" })
      }
    );
    expect(deniedComment.status).toBe(403);

    const readerFeed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/activity",
      { headers: { cookie: readerCookie } }
    );
    expect(readerFeed.status).toBe(200);
    const readerPayload = await readerFeed.json();
    expect(readerPayload).toMatchObject({
      canReadRawAudit: false,
      auditEvents: null
    });
    expect(
      readerPayload.systemEvents.some(
        (event: { actionType: string }) =>
          event.actionType === "crm_activity.mutation_denied"
      )
    ).toBe(false);

    const adminFeed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/activity",
      { headers: { cookie: adminCookie } }
    );
    expect(adminFeed.status).toBe(200);
    await expect(adminFeed.json()).resolves.toMatchObject({
      canReadRawAudit: true,
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "crm_activity.mutation_denied",
          executionResult: expect.objectContaining({ status: "denied" })
        })
      ])
    });

    const noCrmFeed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/activity",
      { headers: { cookie: noCrmCookie } }
    );
    expect(noCrmFeed.status).toBe(403);
  });

  it("does not append duplicate task transition audit for no-op status updates", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createAlphaOpportunity(cookie, "opportunity-alpha");

    const task = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/tasks",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ title: "Подготовить КП" })
      }
    );
    expect(task.status).toBe(201);
    const taskPayload = (await task.json()) as { activity: { id: string } };

    const completions = await Promise.all([
      app.request(
        `/api/workspace/crm/opportunity/opportunity-alpha/tasks/${taskPayload.activity.id}`,
        {
          method: "PATCH",
          headers: jsonHeaders(cookie),
          body: JSON.stringify({ status: "done" })
        }
      ),
      app.request(
        `/api/workspace/crm/opportunity/opportunity-alpha/tasks/${taskPayload.activity.id}`,
        {
          method: "PATCH",
          headers: jsonHeaders(cookie),
          body: JSON.stringify({ status: "done" })
        }
      )
    ]);
    for (const complete of completions) {
      expect(complete.status).toBe(200);
    }

    const feed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-alpha/activity",
      { headers: { cookie } }
    );
    expect(feed.status).toBe(200);
    const feedPayload = await feed.json();
    expect(
      feedPayload.auditEvents.filter(
        (event: { actionType: string }) =>
          event.actionType === "crm_activity.opportunity.task.completed"
      )
    ).toHaveLength(1);
  });

  it("blocks comments, task creation and task transitions after opportunity finalization", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createAlphaOpportunity(cookie, "opportunity-final");

    const task = await app.request(
      "/api/workspace/crm/opportunity/opportunity-final/tasks",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ title: "Подготовить резюме закрытия" })
      }
    );
    expect(task.status).toBe(201);
    const taskPayload = (await task.json()) as { activity: { id: string } };

    const finalized = await app.request(
      "/api/workspace/opportunities/opportunity-final/finalize",
      {
        method: "PATCH",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({
          status: "lost_rejected",
          reason: "Клиент отказался от запуска проекта"
        })
      }
    );
    expect(finalized.status).toBe(200);

    const lockedComment = await app.request(
      "/api/workspace/crm/opportunity/opportunity-final/comments",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ body: "Пост-фактум комментарий" })
      }
    );
    const lockedTask = await app.request(
      "/api/workspace/crm/opportunity/opportunity-final/tasks",
      {
        method: "POST",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ title: "Пост-фактум задача" })
      }
    );
    const lockedTransition = await app.request(
      `/api/workspace/crm/opportunity/opportunity-final/tasks/${taskPayload.activity.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(cookie),
        body: JSON.stringify({ status: "done" })
      }
    );

    for (const response of [lockedComment, lockedTask, lockedTransition]) {
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "crm_activity_locked"
      });
    }

    const feed = await app.request(
      "/api/workspace/crm/opportunity/opportunity-final/activity",
      { headers: { cookie } }
    );
    expect(feed.status).toBe(200);
    const feedPayload = await feed.json();
    expect(feedPayload.activities).toHaveLength(1);
    expect(feedPayload.activities[0]).toMatchObject({
      id: taskPayload.activity.id,
      status: "todo",
      title: "Подготовить резюме закрытия"
    });
    expect(JSON.stringify(feedPayload)).not.toContain("Пост-фактум");
  });

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  async function createAlphaOpportunity(cookie: string, id: string) {
    return createOpportunity(cookie, {
      id,
      clientId: "client-alpha",
      primaryContactId: "contact-alpha",
      projectTypeId: "project-type-alpha",
      stageId: "deal-stage-alpha-new",
      title: `Контур внедрения ${id}`,
      demand: [{ positionId: "position-engineer", requiredHours: 120 }]
    });
  }

  async function createBetaOpportunity(cookie: string, id: string) {
    return createOpportunity(cookie, {
      id,
      clientId: "client-beta",
      primaryContactId: "contact-beta",
      projectTypeId: "project-type-beta",
      stageId: "deal-stage-beta-new",
      title: `Контур внедрения ${id}`,
      demand: [{ positionId: "position-beta-engineer", requiredHours: 80 }]
    });
  }

  async function createOpportunity(
    cookie: string,
    input: {
      id: string;
      clientId: string;
      primaryContactId: string;
      projectTypeId: string;
      stageId: string;
      title: string;
      demand: Array<{ positionId: string; requiredHours: number }>;
    }
  ) {
    const response = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        ...input,
        description: "Сделка для проверки activity workspace",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-12",
        contractValue: 960000,
        plannedHourlyRate: 6000,
        probability: 80,
        templateId: null
      })
    });
    expect(response.status).toBe(201);
  }
});

function jsonHeaders(cookie: string) {
  return {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin",
    cookie
  };
}
