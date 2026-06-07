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

const pipelinePermissions = [
  "tenant.crm_pipelines.read",
  "tenant.crm_pipelines.manage",
  "tenant.crm_pipeline_rules.manage",
  "tenant.crm_pipeline_automations.manage"
] as const;

const dataset: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Alpha Bureau" },
    { id: "tenant-beta", name: "Beta Bureau" }
  ],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Pipeline admin",
      permissions: [
        ...pipelinePermissions,
        "tenant.deal_stages.read",
        "tenant.deal_stages.manage",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Pipeline admin",
      permissions: [...pipelinePermissions, "tenant.audit_events.read"]
    },
    {
      id: "access-profile-alpha-reader",
      tenantId: "tenant-alpha",
      name: "Pipeline reader",
      permissions: ["tenant.crm_pipelines.read", "tenant.audit_events.read"]
    }
  ],
  positions: [],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@alpha.test",
      name: "Alpha Admin",
      accessProfileId: "access-profile-alpha-admin",
      password: "admin12345"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "admin@beta.test",
      name: "Beta Admin",
      accessProfileId: "access-profile-beta-admin",
      password: "admin12345"
    },
    {
      id: "user-alpha-reader",
      tenantId: "tenant-alpha",
      email: "reader@alpha.test",
      name: "Alpha Reader",
      accessProfileId: "access-profile-alpha-reader",
      password: "reader12345"
    }
  ]
};

describe("CRM pipeline API", () => {
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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-06-06T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("manages pipeline stages, transition rules and automations without breaking legacy deal stages", async () => {
    const cookie = await loginAs("admin@alpha.test", "admin12345");
    const headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    };

    const pipelineResponse = await app.request("/api/workspace/crm/pipelines", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "pipeline-architecture-sales", name: "Architecture sales" })
    });
    expect(pipelineResponse.status).toBe(201);
    await expect(pipelineResponse.json()).resolves.toMatchObject({
      pipeline: {
        id: "pipeline-architecture-sales",
        status: "active",
        lifecycleGraphMetadata: {
          pipelineId: "pipeline-architecture-sales",
          initialStageId: null,
          finalStageIds: [],
          stages: [],
          transitions: []
        }
      }
    });

    const intakeStageResponse = await app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture-sales/stages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "pipeline-stage-intake", name: "Intake", sortOrder: 10 })
      }
    );
    const qualifiedStageResponse = await app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture-sales/stages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "pipeline-stage-qualified", name: "Qualified", sortOrder: 20 })
      }
    );
    const wonStageResponse = await app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture-sales/stages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "pipeline-stage-won",
          name: "Won",
          sortOrder: 90,
          lifecycleState: "won_closed",
          isFinal: true
        })
      }
    );
    expect(intakeStageResponse.status).toBe(201);
    expect(qualifiedStageResponse.status).toBe(201);
    expect(wonStageResponse.status).toBe(201);

    const ruleResponse = await app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture-sales/transition-rules",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "pipeline-rule-intake-won",
          fromStageId: "pipeline-stage-intake",
          toStageId: "pipeline-stage-won",
          requiredPermission: "tenant.opportunities.manage",
          requiredFields: ["contractValue"],
          requireReason: true
        })
      }
    );
    expect(ruleResponse.status).toBe(201);

    const automationResponse = await app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture-sales/automations",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: "pipeline-automation-won-task",
          stageId: "pipeline-stage-won",
          trigger: "stage_entered",
          actionType: "create_task",
          actionConfig: { title: "Prepare project handoff" }
        })
      }
    );
    expect(automationResponse.status).toBe(201);

    const archivedStageResponse = await app.request(
      "/api/workspace/crm/pipelines/pipeline-architecture-sales/stages/pipeline-stage-intake",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "Initial intake", sortOrder: 10, status: "archived" })
      }
    );
    expect(archivedStageResponse.status).toBe(200);
    await expect(archivedStageResponse.json()).resolves.toMatchObject({
      stage: { id: "pipeline-stage-intake", name: "Initial intake", status: "archived" }
    });

    const pipelinesList = await app.request("/api/workspace/crm/pipelines", {
      headers: { cookie }
    });
    expect(pipelinesList.status).toBe(200);
    await expect(pipelinesList.json()).resolves.toMatchObject({
      pipelines: [
        {
          id: "pipeline-architecture-sales",
          lifecycleGraphMetadata: {
            initialStageId: "pipeline-stage-qualified",
            finalStageIds: ["pipeline-stage-won"],
            transitions: [
              {
                ruleId: "pipeline-rule-intake-won",
                fromStageId: "pipeline-stage-intake",
                toStageId: "pipeline-stage-won"
              }
            ]
          }
        }
      ]
    });

    const legacyStageResponse = await app.request("/api/workspace/deal-stages", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "deal-stage-legacy", name: "Legacy intake", sortOrder: 10 })
    });
    expect(legacyStageResponse.status).toBe(201);
    const legacyListResponse = await app.request("/api/workspace/deal-stages", {
      headers: { cookie }
    });
    expect(legacyListResponse.status).toBe(200);
    await expect(legacyListResponse.json()).resolves.toMatchObject({
      dealStages: [{ id: "deal-stage-legacy", name: "Legacy intake" }]
    });

    const auditRows = await client`
      SELECT action_type
      FROM audit_events
      WHERE tenant_id = 'tenant-alpha'
      ORDER BY created_at ASC
    `;
    expect(auditRows.map((row) => row.action_type)).toEqual(
      expect.arrayContaining([
        "crm_pipeline.created",
        "crm_pipeline_stage.created",
        "crm_pipeline_transition_rule.created",
        "crm_pipeline_stage_automation.created",
        "crm_pipeline_stage.updated",
        "deal_stage.created"
      ])
    );
  });

  it("denies forbidden pipeline mutations with audit evidence", async () => {
    const cookie = await loginAs("reader@alpha.test", "reader12345");
    const response = await app.request("/api/workspace/crm/pipelines", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({ id: "pipeline-forbidden", name: "Forbidden" })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    const auditRows = await client`
      SELECT action_type, execution_result
      FROM audit_events
      WHERE tenant_id = 'tenant-alpha'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(auditRows).toEqual([
      expect.objectContaining({
        action_type: "crm_pipeline.create_denied",
        execution_result: expect.objectContaining({
          status: "denied",
          error: "permission_missing"
        })
      })
    ]);
  });

  it("keeps pipeline lists tenant scoped", async () => {
    const alphaCookie = await loginAs("admin@alpha.test", "admin12345");
    const betaCookie = await loginAs("admin@beta.test", "admin12345");

    await app.request("/api/workspace/crm/pipelines", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: alphaCookie
      },
      body: JSON.stringify({ id: "pipeline-alpha", name: "Alpha pipeline" })
    });
    await app.request("/api/workspace/crm/pipelines", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: betaCookie
      },
      body: JSON.stringify({ id: "pipeline-beta", name: "Beta pipeline" })
    });

    const alphaList = await app.request("/api/workspace/crm/pipelines", {
      headers: { cookie: alphaCookie }
    });
    const betaList = await app.request("/api/workspace/crm/pipelines", {
      headers: { cookie: betaCookie }
    });

    expect(alphaList.status).toBe(200);
    expect(betaList.status).toBe(200);
    await expect(alphaList.json()).resolves.toMatchObject({
      pipelines: [expect.objectContaining({ id: "pipeline-alpha" })]
    });
    await expect(betaList.json()).resolves.toMatchObject({
      pipelines: [expect.objectContaining({ id: "pipeline-beta" })]
    });
  });
});
