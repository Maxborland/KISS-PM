import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  type PostgresClient
} from "./index";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

describe("CRM opportunity pipeline transition persistence", () => {
  let client: PostgresClient;
  let dataSource: ReturnType<typeof createPostgresTenantDataSource>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    dataSource = createPostgresTenantDataSource(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, contacts, clients, project_types, deal_stages, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedBaseState();
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, contacts, clients, project_types, deal_stages, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("persists CRM pipeline state when updating an existing opportunity", async () => {
    await client`
      UPDATE opportunities
      SET
        crm_pipeline_id = NULL,
        crm_pipeline_stage_id = NULL,
        crm_pipeline_state_updated_at = NULL
      WHERE tenant_id = 'tenant-alpha' AND id = 'opportunity-alpha'
    `;

    const updated = await dataSource.updateOpportunity({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: null,
      primaryContactId: null,
      ownerUserId: null,
      projectTypeId: null,
      stageId: "deal-stage-legacy",
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-qualified",
      clientName: "Client",
      contactName: "Contact",
      title: "Opportunity updated",
      projectType: "Implementation",
      description: null,
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-08T00:00:00.000Z"),
      contractValue: 100_000,
      plannedHourlyRate: 5_000,
      plannedHours: 20,
      probability: 75,
      status: "new",
      templateId: null,
      customFieldValues: {},
      demand: []
    });

    expect(updated).toMatchObject({
      id: "opportunity-alpha",
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-qualified"
    });
    expect(updated?.crmPipelineStateUpdatedAt).toBeInstanceOf(Date);

    const [persisted] = await client`
      SELECT crm_pipeline_id, crm_pipeline_stage_id, crm_pipeline_state_updated_at
      FROM opportunities
      WHERE tenant_id = 'tenant-alpha' AND id = 'opportunity-alpha'
    `;
    expect(persisted).toMatchObject({
      crm_pipeline_id: "pipeline-sales",
      crm_pipeline_stage_id: "pipeline-stage-qualified"
    });
    expect(persisted?.crm_pipeline_state_updated_at).toBeTruthy();
  });

  it("preserves CRM pipeline state when an ordinary opportunity update omits it", async () => {
    const existing = await dataSource.findOpportunityById(
      "tenant-alpha",
      "opportunity-alpha"
    );

    const updated = await dataSource.updateOpportunity({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: null,
      primaryContactId: null,
      ownerUserId: null,
      projectTypeId: null,
      stageId: "deal-stage-legacy",
      clientName: "Client",
      contactName: "Contact",
      title: "Opportunity renamed",
      projectType: "Implementation",
      description: null,
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-08T00:00:00.000Z"),
      contractValue: 100_000,
      plannedHourlyRate: 5_000,
      plannedHours: 20,
      probability: 75,
      status: "new",
      templateId: null,
      customFieldValues: {},
      demand: []
    });

    expect(updated).toMatchObject({
      id: "opportunity-alpha",
      title: "Opportunity renamed",
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-intake"
    });
    expect(updated?.crmPipelineStateUpdatedAt?.toISOString()).toBe(
      existing?.crmPipelineStateUpdatedAt?.toISOString()
    );
  });

  it("atomically advances CRM pipeline state while preserving legacy deal stage", async () => {
    const transitioned = await dataSource.transitionOpportunityCrmPipelineStage({
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      pipelineId: "pipeline-sales",
      currentStageId: "pipeline-stage-intake",
      targetStageId: "pipeline-stage-qualified"
    });

    expect(transitioned).toMatchObject({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      stageId: "deal-stage-legacy",
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-qualified"
    });
    expect(transitioned?.crmPipelineStateUpdatedAt).toBeInstanceOf(Date);
  });

  it("rejects stale current state without changing the opportunity", async () => {
    await expect(
      dataSource.transitionOpportunityCrmPipelineStage({
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-alpha",
        pipelineId: "pipeline-sales",
        currentStageId: "pipeline-stage-qualified",
        targetStageId: "pipeline-stage-won"
      })
    ).resolves.toBeUndefined();

    await expect(
      dataSource.findOpportunityById("tenant-alpha", "opportunity-alpha")
    ).resolves.toMatchObject({
      crmPipelineStageId: "pipeline-stage-intake"
    });
  });

  it("keeps tenant scope and CRM stage foreign keys strict", async () => {
    await expect(
      dataSource.transitionOpportunityCrmPipelineStage({
        tenantId: "tenant-beta",
        opportunityId: "opportunity-alpha",
        pipelineId: "pipeline-sales",
        currentStageId: "pipeline-stage-intake",
        targetStageId: "pipeline-stage-qualified"
      })
    ).resolves.toBeUndefined();

    await expect(
      dataSource.transitionOpportunityCrmPipelineStage({
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-alpha",
        pipelineId: "pipeline-sales",
        currentStageId: "pipeline-stage-intake",
        targetStageId: "pipeline-stage-missing"
      })
    ).rejects.toThrow();
  });

  async function seedBaseState() {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES ('tenant-alpha', 'Alpha Bureau', now()), ('tenant-beta', 'Beta Bureau', now())
    `;
    await client`
      INSERT INTO deal_stages (id, tenant_id, name, sort_order, status, created_at, updated_at)
      VALUES ('deal-stage-legacy', 'tenant-alpha', 'Legacy', 10, 'active', now(), now())
    `;
    await client`
      INSERT INTO crm_pipelines (id, tenant_id, name, status, lifecycle_graph_metadata, created_at, updated_at)
      VALUES ('pipeline-sales', 'tenant-alpha', 'Sales', 'active', '{"pipelineId":"pipeline-sales","initialStageId":null,"finalStageIds":[],"stages":[],"transitions":[]}'::jsonb, now(), now())
    `;
    await client`
      INSERT INTO crm_pipeline_stages (id, tenant_id, pipeline_id, name, sort_order, status, lifecycle_state, is_final, created_at, updated_at)
      VALUES
        ('pipeline-stage-intake', 'tenant-alpha', 'pipeline-sales', 'Intake', 10, 'active', 'open', false, now(), now()),
        ('pipeline-stage-qualified', 'tenant-alpha', 'pipeline-sales', 'Qualified', 20, 'active', 'open', false, now(), now()),
        ('pipeline-stage-won', 'tenant-alpha', 'pipeline-sales', 'Won', 90, 'active', 'won_closed', true, now(), now())
    `;
    await client`
      INSERT INTO opportunities (
        id, tenant_id, stage_id, crm_pipeline_id, crm_pipeline_stage_id, crm_pipeline_state_updated_at,
        client_name, contact_name, title, project_type, planned_start, planned_finish,
        contract_value, planned_hourly_rate, planned_hours, probability, status,
        custom_field_values, created_at, updated_at
      ) VALUES (
        'opportunity-alpha', 'tenant-alpha', 'deal-stage-legacy', 'pipeline-sales', 'pipeline-stage-intake', now(),
        'Client', 'Contact', 'Opportunity', 'Implementation', now(), now() + interval '7 days',
        100000, 5000, 20, 60, 'new', '{}'::jsonb, now(), now()
      )
    `;
  }
});
