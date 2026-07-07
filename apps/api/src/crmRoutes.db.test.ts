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

  it("returns one created opportunity and one 409 conflict for concurrent duplicate opportunity ids", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-opportunity-race", name: "Клиент race opportunity" })
    });
    await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-opportunity-race",
        clientId: "client-opportunity-race",
        name: "Контакт race opportunity"
      })
    });
    await app.request("/api/workspace/project-types", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "project-type-opportunity-race", name: "Race implementation" })
    });
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-opportunity-race", name: "Race stage", sortOrder: 10 })
    });

    const opportunityBody = {
      id: "opportunity-race-duplicate",
      clientId: "client-opportunity-race",
      primaryContactId: "contact-opportunity-race",
      projectTypeId: "project-type-opportunity-race",
      stageId: "deal-stage-opportunity-race",
      title: "Race opportunity",
      description: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-12",
      contractValue: 960000,
      plannedHourlyRate: 6000,
      probability: 80,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 120 }]
    };

    const responses = await Promise.all([
      app.request("/api/workspace/opportunities", {
        method: "POST",
        headers,
        body: JSON.stringify(opportunityBody)
      }),
      app.request("/api/workspace/opportunities", {
        method: "POST",
        headers,
        body: JSON.stringify(opportunityBody)
      })
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const conflict = responses.find((response) => response.status === 409);
    expect(conflict).toBeDefined();
    await expect(conflict!.json()).resolves.toEqual({ error: "opportunity_id_taken" });
    const opportunityRows = await client`
      SELECT count(*)::int AS count
      FROM opportunities
      WHERE tenant_id = 'tenant-alpha'
        AND id = 'opportunity-race-duplicate'
    `;
    expect(Number(opportunityRows[0]?.count ?? 0)).toBe(1);
  });
  it("keeps opportunity stage and pipeline writes idempotent and race-safe", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-opportunity-write-risk", name: "Клиент write risk" })
    });
    await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-opportunity-write-risk",
        clientId: "client-opportunity-write-risk",
        name: "Контакт write risk"
      })
    });
    await app.request("/api/workspace/project-types", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "project-type-opportunity-write-risk", name: "Write risk" })
    });

    const firstStageResponse = await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-risk-a", name: "Risk A", sortOrder: 10 })
    });
    const firstStageBody = (await firstStageResponse.json()) as {
      dealStage: { pipelineId: string };
    };
    const defaultPipelineId = firstStageBody.dealStage.pipelineId;
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-risk-b", name: "Risk B", sortOrder: 20 })
    });
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-risk-c", name: "Risk C", sortOrder: 30 })
    });
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-risk-d", name: "Risk D", sortOrder: 40 })
    });
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-risk-archived", name: "Risk archived", sortOrder: 50 })
    });
    await app.request("/api/workspace/deal-stages/deal-stage-risk-archived", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Risk archived",
        sortOrder: 50,
        status: "archived"
      })
    });
    await app.request("/api/workspace/pipelines", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "pipeline-opportunity-write-risk-target",
        name: "Write risk target",
        sortOrder: 20
      })
    });
    await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "deal-stage-risk-target",
        pipelineId: "pipeline-opportunity-write-risk-target",
        name: "Risk target",
        sortOrder: 10
      })
    });

    const opportunityBody = {
      clientId: "client-opportunity-write-risk",
      primaryContactId: "contact-opportunity-write-risk",
      projectTypeId: "project-type-opportunity-write-risk",
      description: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-12",
      contractValue: 960000,
      plannedHourlyRate: 6000,
      probability: 80,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 120 }]
    };

    const missingStageCreate = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...opportunityBody,
        id: "opportunity-risk-missing-stage",
        stageId: "deal-stage-risk-missing",
        title: "Missing stage"
      })
    });
    expect(missingStageCreate.status).toBe(404);
    await expect(missingStageCreate.json()).resolves.toEqual({
      error: "deal_stage_not_found"
    });
    const archivedStageCreate = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...opportunityBody,
        id: "opportunity-risk-archived-stage",
        stageId: "deal-stage-risk-archived",
        title: "Archived stage"
      })
    });
    expect(archivedStageCreate.status).toBe(404);
    await expect(archivedStageCreate.json()).resolves.toEqual({
      error: "deal_stage_not_found"
    });

    const duplicateTitleResponses = await Promise.all([
      app.request("/api/workspace/opportunities", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...opportunityBody,
          id: "opportunity-risk-title-a",
          stageId: "deal-stage-risk-a",
          title: "Duplicate title allowed"
        })
      }),
      app.request("/api/workspace/opportunities", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...opportunityBody,
          id: "opportunity-risk-title-b",
          stageId: "deal-stage-risk-a",
          title: "Duplicate title allowed"
        })
      })
    ]);
    expect(duplicateTitleResponses.map((response) => response.status).sort()).toEqual([
      201,
      201
    ]);
    const duplicateTitleRows = await client`
      SELECT count(*)::int AS count
      FROM opportunities
      WHERE tenant_id = 'tenant-alpha'
        AND title = 'Duplicate title allowed'
    `;
    expect(Number(duplicateTitleRows[0]?.count ?? 0)).toBe(2);

    const opportunityResponse = await app.request("/api/workspace/opportunities", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...opportunityBody,
        id: "opportunity-risk-stage-pipeline",
        stageId: "deal-stage-risk-a",
        title: "Stage pipeline race"
      })
    });
    expect(opportunityResponse.status).toBe(201);
    await expect(opportunityResponse.json()).resolves.toMatchObject({
      opportunity: {
        id: "opportunity-risk-stage-pipeline",
        stageId: "deal-stage-risk-a",
        pipelineId: defaultPipelineId
      }
    });

    const missingStageMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/stage",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageId: "deal-stage-risk-missing" })
      }
    );
    const archivedStageMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/stage",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageId: "deal-stage-risk-archived" })
      }
    );
    expect(missingStageMove.status).toBe(404);
    await expect(missingStageMove.json()).resolves.toEqual({
      error: "deal_stage_not_found"
    });
    expect(archivedStageMove.status).toBe(404);
    await expect(archivedStageMove.json()).resolves.toEqual({
      error: "deal_stage_not_found"
    });

    const firstStageMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/stage",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageId: "deal-stage-risk-b" })
      }
    );
    expect(firstStageMove.status).toBe(200);
    await expect(firstStageMove.json()).resolves.toMatchObject({
      opportunity: { stageId: "deal-stage-risk-b", pipelineId: defaultPipelineId }
    });
    expect(await countOpportunityAuditEvents("opportunity.stage_updated")).toBe(1);

    const duplicateStageMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/stage",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stageId: "deal-stage-risk-b" })
      }
    );
    expect(duplicateStageMove.status).toBe(200);
    await expect(duplicateStageMove.json()).resolves.toMatchObject({
      opportunity: { stageId: "deal-stage-risk-b", pipelineId: defaultPipelineId }
    });
    expect(await countOpportunityAuditEvents("opportunity.stage_updated")).toBe(1);

    const concurrentStageMoves = await Promise.all(
      ["deal-stage-risk-c", "deal-stage-risk-d"].map(async (stageId) => {
        const response = await app.request(
          "/api/workspace/opportunities/opportunity-risk-stage-pipeline/stage",
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({ stageId })
          }
        );
        return { status: response.status, body: await response.json() };
      })
    );
    expect(concurrentStageMoves.map((result) => result.status).sort()).toEqual([
      200,
      200
    ]);
    expect(
      concurrentStageMoves.map((result) => result.body.opportunity.stageId).sort()
    ).toEqual(["deal-stage-risk-c", "deal-stage-risk-d"]);
    const stageReadback = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline",
      { headers: { "x-kiss-pm-action": "same-origin", cookie } }
    );
    expect(stageReadback.status).toBe(200);
    const stageReadbackBody = await stageReadback.json();
    expect(["deal-stage-risk-c", "deal-stage-risk-d"]).toContain(
      stageReadbackBody.opportunity.stageId
    );
    expect(stageReadbackBody.opportunity.pipelineId).toBe(defaultPipelineId);
    expect(await countOpportunityAuditEvents("opportunity.stage_updated")).toBe(3);

    const missingPipelineMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/pipeline",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          pipelineId: "pipeline-opportunity-write-risk-missing",
          stageId: "deal-stage-risk-target"
        })
      }
    );
    expect(missingPipelineMove.status).toBe(404);
    await expect(missingPipelineMove.json()).resolves.toEqual({
      error: "pipeline_not_found"
    });
    const wrongStagePipelineMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/pipeline",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          pipelineId: "pipeline-opportunity-write-risk-target",
          stageId: "deal-stage-risk-a"
        })
      }
    );
    expect(wrongStagePipelineMove.status).toBe(409);
    await expect(wrongStagePipelineMove.json()).resolves.toEqual({
      error: "stage_not_in_pipeline"
    });
    expect(await countOpportunityAuditEvents("opportunity.pipeline_changed")).toBe(0);

    const pipelineMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/pipeline",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          pipelineId: "pipeline-opportunity-write-risk-target",
          stageId: "deal-stage-risk-target"
        })
      }
    );
    expect(pipelineMove.status).toBe(200);
    await expect(pipelineMove.json()).resolves.toMatchObject({
      opportunity: {
        stageId: "deal-stage-risk-target",
        pipelineId: "pipeline-opportunity-write-risk-target"
      }
    });
    expect(await countOpportunityAuditEvents("opportunity.pipeline_changed")).toBe(1);

    const duplicatePipelineMove = await app.request(
      "/api/workspace/opportunities/opportunity-risk-stage-pipeline/pipeline",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          pipelineId: "pipeline-opportunity-write-risk-target",
          stageId: "deal-stage-risk-target"
        })
      }
    );
    expect(duplicatePipelineMove.status).toBe(200);
    await expect(duplicatePipelineMove.json()).resolves.toMatchObject({
      opportunity: {
        stageId: "deal-stage-risk-target",
        pipelineId: "pipeline-opportunity-write-risk-target"
      }
    });
    expect(await countOpportunityAuditEvents("opportunity.pipeline_changed")).toBe(1);

    const invalidOpportunityRows = await client`
      SELECT count(*)::int AS count
      FROM opportunities
      WHERE tenant_id = 'tenant-alpha'
        AND id IN ('opportunity-risk-missing-stage', 'opportunity-risk-archived-stage')
    `;
    expect(Number(invalidOpportunityRows[0]?.count ?? 0)).toBe(0);
    expect(
      await countOpportunityAuditEvents(
        "opportunity.created",
        "opportunity-risk-missing-stage"
      )
    ).toBe(0);
    expect(
      await countOpportunityAuditEvents(
        "opportunity.created",
        "opportunity-risk-archived-stage"
      )
    ).toBe(0);

    async function countOpportunityAuditEvents(
      actionType: string,
      opportunityId = "opportunity-risk-stage-pipeline"
    ) {
      const rows = await client`
        SELECT count(*)::int AS count
        FROM audit_events
        WHERE tenant_id = 'tenant-alpha'
          AND action_type = ${actionType}
          AND source_entity ->> 'type' = 'Opportunity'
          AND source_entity ->> 'id' = ${opportunityId}
      `;
      return Number(rows[0]?.count ?? 0);
    }
  });
  // Регресс BUG-CRM-01: дубликат SKU/имени продукта должен давать 409, а не 500.
  it("returns 409 (not 500) when creating a product with a duplicate SKU or name", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const first = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-dup-a",
        name: "Продукт А",
        sku: "DUP-SKU",
        type: "service",
        unit: "час",
        price: 1000
      })
    });
    expect(first.status).toBe(201);

    const dupSku = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-dup-b",
        name: "Продукт Б",
        sku: "DUP-SKU",
        type: "service",
        unit: "час",
        price: 2000
      })
    });
    expect(dupSku.status).toBe(409);
    await expect(dupSku.json()).resolves.toEqual({ error: "product_sku_taken" });

    const dupName = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-dup-c",
        name: "Продукт А",
        sku: "OTHER-SKU",
        type: "service",
        unit: "час",
        price: 3000
      })
    });
    expect(dupName.status).toBe(409);
    await expect(dupName.json()).resolves.toEqual({ error: "product_name_taken" });
  });

  it("returns 409 when creating or updating clients with a duplicate name", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const first = await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-name-a", name: "Клиент дубль" })
    });
    const duplicateCreate = await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-name-b", name: "Клиент дубль" })
    });
    const second = await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-name-c", name: "Клиент уникальный" })
    });
    const duplicateUpdate = await app.request("/api/workspace/clients/client-name-c", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Клиент дубль", status: "active" })
    });

    expect(first.status).toBe(201);
    expect(duplicateCreate.status).toBe(409);
    await expect(duplicateCreate.json()).resolves.toEqual({ error: "client_name_taken" });
    expect(second.status).toBe(201);
    expect(duplicateUpdate.status).toBe(409);
    await expect(duplicateUpdate.json()).resolves.toEqual({ error: "client_name_taken" });
  });

  it("returns 409 when updating a product to a duplicate SKU or name", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const first = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-update-a",
        name: "Продукт А",
        sku: "SKU-A",
        type: "service",
        unit: "час",
        price: 1000
      })
    });
    const second = await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-update-b",
        name: "Продукт Б",
        sku: "SKU-B",
        type: "service",
        unit: "час",
        price: 2000
      })
    });
    const duplicateSku = await app.request("/api/workspace/products/product-update-b", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Продукт Б обновленный",
        sku: "SKU-A",
        type: "service",
        unit: "час",
        price: 2500,
        status: "active"
      })
    });
    const duplicateName = await app.request("/api/workspace/products/product-update-b", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Продукт А",
        sku: "SKU-B-UPDATED",
        type: "service",
        unit: "час",
        price: 2500,
        status: "active"
      })
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(duplicateSku.status).toBe(409);
    await expect(duplicateSku.json()).resolves.toEqual({ error: "product_sku_taken" });
    expect(duplicateName.status).toBe(409);
    await expect(duplicateName.json()).resolves.toEqual({ error: "product_name_taken" });
  });
  it("keeps client name writes conflict-safe under concurrent create and update", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const concurrentCreates = await Promise.all([
      app.request("/api/workspace/clients", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "client-race-create-a", name: "Клиент race name" })
      }),
      app.request("/api/workspace/clients", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "client-race-create-b", name: "Клиент race name" })
      })
    ]);
    expect(concurrentCreates.map((response) => response.status).sort()).toEqual([201, 409]);
    const createConflict = concurrentCreates.find((response) => response.status === 409);
    expect(createConflict).toBeDefined();
    await expect(createConflict!.json()).resolves.toEqual({ error: "client_name_taken" });
    const createRows = await client`
      SELECT count(*)::int AS count
      FROM clients
      WHERE tenant_id = 'tenant-alpha'
        AND name = 'Клиент race name'
    `;
    expect(Number(createRows[0]?.count ?? 0)).toBe(1);

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-race-update-a", name: "Клиент race update A" })
    });
    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-race-update-b", name: "Клиент race update B" })
    });

    const concurrentUpdates = await Promise.all([
      app.request("/api/workspace/clients/client-race-update-a", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "Клиент shared update", status: "active" })
      }),
      app.request("/api/workspace/clients/client-race-update-b", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "Клиент shared update", status: "active" })
      })
    ]);
    expect(concurrentUpdates.map((response) => response.status).sort()).toEqual([200, 409]);
    const updateConflict = concurrentUpdates.find((response) => response.status === 409);
    expect(updateConflict).toBeDefined();
    await expect(updateConflict!.json()).resolves.toEqual({ error: "client_name_taken" });
    const updateRows = await client`
      SELECT count(*)::int AS count
      FROM clients
      WHERE tenant_id = 'tenant-alpha'
        AND name = 'Клиент shared update'
    `;
    expect(Number(updateRows[0]?.count ?? 0)).toBe(1);
  });

  it("keeps product SKU and name writes conflict-safe under concurrent create and update", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const concurrentSkuCreates = await Promise.all([
      app.request("/api/workspace/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "product-race-sku-create-a",
          name: "Продукт race SKU A",
          sku: "RACE-SKU",
          type: "service",
          unit: "час",
          price: 1000
        })
      }),
      app.request("/api/workspace/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "product-race-sku-create-b",
          name: "Продукт race SKU B",
          sku: "RACE-SKU",
          type: "service",
          unit: "час",
          price: 2000
        })
      })
    ]);
    expect(concurrentSkuCreates.map((response) => response.status).sort()).toEqual([201, 409]);
    const skuCreateConflict = concurrentSkuCreates.find((response) => response.status === 409);
    expect(skuCreateConflict).toBeDefined();
    await expect(skuCreateConflict!.json()).resolves.toEqual({ error: "product_sku_taken" });
    const skuCreateRows = await client`
      SELECT count(*)::int AS count
      FROM products
      WHERE tenant_id = 'tenant-alpha'
        AND sku = 'RACE-SKU'
    `;
    expect(Number(skuCreateRows[0]?.count ?? 0)).toBe(1);

    const concurrentNameCreates = await Promise.all([
      app.request("/api/workspace/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "product-race-name-create-a",
          name: "Продукт race name",
          sku: "RACE-NAME-A",
          type: "service",
          unit: "час",
          price: 1000
        })
      }),
      app.request("/api/workspace/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "product-race-name-create-b",
          name: "Продукт race name",
          sku: "RACE-NAME-B",
          type: "service",
          unit: "час",
          price: 2000
        })
      })
    ]);
    expect(concurrentNameCreates.map((response) => response.status).sort()).toEqual([201, 409]);
    const nameCreateConflict = concurrentNameCreates.find((response) => response.status === 409);
    expect(nameCreateConflict).toBeDefined();
    await expect(nameCreateConflict!.json()).resolves.toEqual({ error: "product_name_taken" });
    const nameCreateRows = await client`
      SELECT count(*)::int AS count
      FROM products
      WHERE tenant_id = 'tenant-alpha'
        AND name = 'Продукт race name'
    `;
    expect(Number(nameCreateRows[0]?.count ?? 0)).toBe(1);

    await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-race-update-a",
        name: "Продукт race update A",
        sku: "RACE-UPDATE-A",
        type: "service",
        unit: "час",
        price: 1000
      })
    });
    await app.request("/api/workspace/products", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "product-race-update-b",
        name: "Продукт race update B",
        sku: "RACE-UPDATE-B",
        type: "service",
        unit: "час",
        price: 2000
      })
    });

    const concurrentSkuUpdates = await Promise.all([
      app.request("/api/workspace/products/product-race-update-a", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "Продукт race update A",
          sku: "RACE-UPDATE-SHARED",
          type: "service",
          unit: "час",
          price: 1000,
          status: "active"
        })
      }),
      app.request("/api/workspace/products/product-race-update-b", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "Продукт race update B",
          sku: "RACE-UPDATE-SHARED",
          type: "service",
          unit: "час",
          price: 2000,
          status: "active"
        })
      })
    ]);
    expect(concurrentSkuUpdates.map((response) => response.status).sort()).toEqual([200, 409]);
    const skuUpdateConflict = concurrentSkuUpdates.find((response) => response.status === 409);
    expect(skuUpdateConflict).toBeDefined();
    await expect(skuUpdateConflict!.json()).resolves.toEqual({ error: "product_sku_taken" });
    const skuUpdateRows = await client`
      SELECT count(*)::int AS count
      FROM products
      WHERE tenant_id = 'tenant-alpha'
        AND sku = 'RACE-UPDATE-SHARED'
    `;
    expect(Number(skuUpdateRows[0]?.count ?? 0)).toBe(1);

    const concurrentNameUpdates = await Promise.all([
      app.request("/api/workspace/products/product-race-update-a", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "Продукт shared update",
          sku: "RACE-UPDATE-A-NAME",
          type: "service",
          unit: "час",
          price: 1000,
          status: "active"
        })
      }),
      app.request("/api/workspace/products/product-race-update-b", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "Продукт shared update",
          sku: "RACE-UPDATE-B-NAME",
          type: "service",
          unit: "час",
          price: 2000,
          status: "active"
        })
      })
    ]);
    expect(concurrentNameUpdates.map((response) => response.status).sort()).toEqual([200, 409]);
    const nameUpdateConflict = concurrentNameUpdates.find((response) => response.status === 409);
    expect(nameUpdateConflict).toBeDefined();
    await expect(nameUpdateConflict!.json()).resolves.toEqual({ error: "product_name_taken" });
    const nameUpdateRows = await client`
      SELECT count(*)::int AS count
      FROM products
      WHERE tenant_id = 'tenant-alpha'
        AND name = 'Продукт shared update'
    `;
    expect(Number(nameUpdateRows[0]?.count ?? 0)).toBe(1);
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

  it("rejects duplicate contact emails on create and update with 409", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-dup-email", name: "Клиент дублей" })
    });
    const first = await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "contact-email-first", clientId: "client-dup-email", name: "Первый", email: "Dup@Example.test" })
    });
    const second = await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "contact-email-second", clientId: "client-dup-email", name: "Второй", email: "other@example.test" })
    });
    const duplicateCreate = await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "contact-email-duplicate", clientId: "client-dup-email", name: "Дубль", email: "dup@example.test" })
    });
    const duplicateUpdate = await app.request("/api/workspace/contacts/contact-email-second", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ clientId: "client-dup-email", name: "Второй", email: "dup@example.test", status: "active" })
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(duplicateCreate.status).toBe(409);
    await expect(duplicateCreate.json()).resolves.toEqual({ error: "contact_email_taken" });
    expect(duplicateUpdate.status).toBe(409);
    await expect(duplicateUpdate.json()).resolves.toEqual({ error: "contact_email_taken" });
  });

  it("keeps contact email writes conflict-safe under concurrent create and update", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    await app.request("/api/workspace/clients", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "client-contact-race", name: "Клиент race contacts" })
    });

    const concurrentCreates = await Promise.all([
      app.request("/api/workspace/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "contact-race-create-a",
          clientId: "client-contact-race",
          name: "Race create A",
          email: "race@example.test"
        })
      }),
      app.request("/api/workspace/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "contact-race-create-b",
          clientId: "client-contact-race",
          name: "Race create B",
          email: "race@example.test"
        })
      })
    ]);
    expect(concurrentCreates.map((response) => response.status).sort()).toEqual([201, 409]);
    const createConflict = concurrentCreates.find((response) => response.status === 409);
    expect(createConflict).toBeDefined();
    await expect(createConflict!.json()).resolves.toEqual({ error: "contact_email_taken" });
    const createRows = await client`
      SELECT count(*)::int AS count
      FROM contacts
      WHERE tenant_id = 'tenant-alpha'
        AND lower(email) = 'race@example.test'
    `;
    expect(Number(createRows[0]?.count ?? 0)).toBe(1);

    await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-race-update-a",
        clientId: "client-contact-race",
        name: "Race update A",
        email: "update-a@example.test"
      })
    });
    await app.request("/api/workspace/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "contact-race-update-b",
        clientId: "client-contact-race",
        name: "Race update B",
        email: "update-b@example.test"
      })
    });

    const concurrentUpdates = await Promise.all([
      app.request("/api/workspace/contacts/contact-race-update-a", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          clientId: "client-contact-race",
          name: "Race update A",
          email: "shared-update@example.test",
          status: "active"
        })
      }),
      app.request("/api/workspace/contacts/contact-race-update-b", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          clientId: "client-contact-race",
          name: "Race update B",
          email: "shared-update@example.test",
          status: "active"
        })
      })
    ]);
    expect(concurrentUpdates.map((response) => response.status).sort()).toEqual([200, 409]);
    const updateConflict = concurrentUpdates.find((response) => response.status === 409);
    expect(updateConflict).toBeDefined();
    await expect(updateConflict!.json()).resolves.toEqual({ error: "contact_email_taken" });
    const updateRows = await client`
      SELECT count(*)::int AS count
      FROM contacts
      WHERE tenant_id = 'tenant-alpha'
        AND lower(email) = 'shared-update@example.test'
    `;
    expect(Number(updateRows[0]?.count ?? 0)).toBe(1);
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
