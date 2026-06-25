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

describe("Phase 3.1 CRM persistence", () => {
  let client: PostgresClient;
  let dataSource: ReturnType<typeof createPostgresTenantDataSource>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    dataSource = createPostgresTenantDataSource(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;
    await client`
      INSERT INTO positions (id, tenant_id, name, created_at)
      VALUES ('position-engineer', 'tenant-alpha', 'Инженер', now())
    `;
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("persists CRM entities and links them to opportunities inside one tenant", async () => {
    const clientRecord = await dataSource.createClient({
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка",
      description: "Ключевой клиент",
      status: "active"
    });
    const contact = await dataSource.createContact({
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: clientRecord.id,
      name: "Ирина Клиент",
      email: "irina@example.test",
      phone: "+7 913 000-00-00",
      telegram: "@irina",
      role: "Заказчик",
      status: "active"
    });
    const projectType = await dataSource.createProjectType({
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение",
      description: "Проект внедрения",
      status: "active"
    });
    const defaultPipeline = await dataSource.createCrmPipeline({
      id: "pipeline-default",
      tenantId: "tenant-alpha",
      name: "Основная воронка",
      description: null,
      isDefault: true,
      sortOrder: 1,
      status: "active",
      lifecycleGraphMetadata: {
        pipelineId: "pipeline-default",
        initialStageId: null,
        finalStageIds: [],
        stages: [],
        transitions: []
      }
    });
    const stage = await dataSource.createDealStage({
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
      pipelineId: defaultPipeline.id,
      name: "Новая",
      sortOrder: 10,
      status: "active"
    });
    const product = await dataSource.createProduct({
      id: "product-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение KISS PM",
      sku: "KISS-IMPL",
      type: "service",
      unit: "час",
      price: 6000,
      description: "Проектная услуга",
      status: "active"
    });
    const opportunity = await dataSource.createOpportunity({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: clientRecord.id,
      primaryContactId: contact.id,
      projectTypeId: projectType.id,
      stageId: stage.id,
      clientName: clientRecord.name,
      contactName: contact.name,
      title: "Внедрение KISS PM",
      projectType: projectType.name,
      description: "Первичный проект внедрения",
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
      contractValue: 960_000,
      plannedHourlyRate: 6_000,
      plannedHours: 160,
      probability: 80,
      status: "new",
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 120 }]
    });

    expect(opportunity).toMatchObject({
      id: "opportunity-alpha",
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      projectType: "Внедрение"
    });
    await expect(dataSource.listClients("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listClients("tenant-beta")).resolves.toEqual([]);
    await expect(dataSource.listContacts("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listProducts("tenant-alpha")).resolves.toEqual([
      expect.objectContaining({
        id: "product-implementation",
        name: "Внедрение KISS PM",
        sku: "KISS-IMPL",
        type: "service",
        price: 6000
      })
    ]);
    await expect(dataSource.listProducts("tenant-beta")).resolves.toEqual([]);
    await expect(
      dataSource.updateProduct({
        ...product,
        name: "Внедрение KISS PM расширенное",
        status: "archived"
      })
    ).resolves.toMatchObject({
      id: "product-implementation",
      name: "Внедрение KISS PM расширенное",
      status: "archived"
    });
    await expect(dataSource.listProjectTypes("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listDealStages("tenant-alpha")).resolves.toEqual([
      expect.objectContaining({ id: "deal-stage-new", sortOrder: 10 })
    ]);

    const nextStage = await dataSource.createDealStage({
      id: "deal-stage-qualified",
      tenantId: "tenant-alpha",
      pipelineId: defaultPipeline.id,
      name: "Квалификация",
      sortOrder: 20,
      status: "active"
    });
    await expect(
      dataSource.updateOpportunityStage({
        tenantId: "tenant-alpha",
        opportunityId: opportunity.id,
        stageId: nextStage.id
      })
    ).resolves.toMatchObject({
      id: "opportunity-alpha",
      stageId: "deal-stage-qualified"
    });
    await dataSource.finalizeOpportunity({
      tenantId: "tenant-alpha",
      opportunityId: opportunity.id,
      status: "lost_rejected"
    });
    await expect(
      dataSource.updateOpportunityStage({
        tenantId: "tenant-alpha",
        opportunityId: opportunity.id,
        stageId: stage.id
      })
    ).resolves.toBeUndefined();

    const otherClient = await dataSource.createClient({
      id: "client-other",
      tenantId: "tenant-alpha",
      name: "ООО Другой клиент",
      description: null,
      status: "active"
    });
    const otherContact = await dataSource.createContact({
      id: "contact-other",
      tenantId: "tenant-alpha",
      clientId: otherClient.id,
      name: "Олег Другой",
      email: null,
      phone: null,
      telegram: null,
      role: null,
      status: "active"
    });
    await expect(
      dataSource.createOpportunity({
        id: "opportunity-mismatched-contact",
        tenantId: "tenant-alpha",
        clientId: clientRecord.id,
        primaryContactId: otherContact.id,
        projectTypeId: projectType.id,
        stageId: stage.id,
        clientName: clientRecord.name,
        contactName: otherContact.name,
        title: "Некорректная связь контакта",
        projectType: projectType.name,
        description: null,
        plannedStart: new Date("2026-06-01T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
        contractValue: 120_000,
        plannedHourlyRate: 6_000,
        plannedHours: 20,
        probability: 40,
        status: "new",
        templateId: null,
        demand: [{ positionId: "position-engineer", requiredHours: 20 }]
      })
    ).rejects.toThrow();
  });

  it("persists CRM pipelines, stages, transition rules and automation definitions per tenant", async () => {
    const pipeline = await dataSource.createCrmPipeline({
      id: "pipeline-architecture-sales",
      tenantId: "tenant-alpha",
      name: "Architecture sales",
      description: null,
      isDefault: false,
      sortOrder: 1,
      status: "active",
      lifecycleGraphMetadata: {
        pipelineId: "pipeline-architecture-sales",
        initialStageId: null,
        finalStageIds: [],
        stages: [],
        transitions: []
      }
    });

    const firstStage = await dataSource.createCrmPipelineStage({
      id: "pipeline-stage-intake",
      tenantId: "tenant-alpha",
      pipelineId: pipeline.id,
      name: "Intake",
      sortOrder: 10,
      status: "active",
      lifecycleState: "open",
      isFinal: false
    });
    const wonStage = await dataSource.createCrmPipelineStage({
      id: "pipeline-stage-won",
      tenantId: "tenant-alpha",
      pipelineId: pipeline.id,
      name: "Won",
      sortOrder: 90,
      status: "active",
      lifecycleState: "won_closed",
      isFinal: true
    });
    const rule = await dataSource.createCrmPipelineTransitionRule({
      id: "pipeline-rule-intake-won",
      tenantId: "tenant-alpha",
      pipelineId: pipeline.id,
      fromStageId: firstStage.id,
      toStageId: wonStage.id,
      requiredPermission: "tenant.opportunities.manage",
      requiredFields: ["contractValue", "plannedFinish"],
      requireReason: true,
      requireFeasibilityOk: true,
      minProbability: 50,
      guardNote: null,
      status: "active"
    });
    const automation = await dataSource.createCrmPipelineStageAutomationDefinition({
      id: "pipeline-automation-won-task",
      tenantId: "tenant-alpha",
      pipelineId: pipeline.id,
      stageId: wonStage.id,
      trigger: "stage_entered",
      actionType: "create_task",
      actionConfig: { title: "Prepare project handoff" },
      status: "active"
    });

    await expect(dataSource.listCrmPipelines("tenant-alpha")).resolves.toEqual([
      expect.objectContaining({ id: pipeline.id, name: "Architecture sales" })
    ]);
    await expect(dataSource.listCrmPipelines("tenant-beta")).resolves.toEqual([]);
    await expect(
      dataSource.findCrmPipelineById("tenant-alpha", pipeline.id)
    ).resolves.toMatchObject({ id: pipeline.id });
    await expect(
      dataSource.findCrmPipelineById("tenant-beta", pipeline.id)
    ).resolves.toBeUndefined();
    await expect(dataSource.listCrmPipelineStages("tenant-alpha", pipeline.id)).resolves.toEqual([
      expect.objectContaining({ id: firstStage.id, sortOrder: 10 }),
      expect.objectContaining({ id: wonStage.id, isFinal: true })
    ]);
    await expect(
      dataSource.listCrmPipelineTransitionRules("tenant-alpha", pipeline.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: rule.id,
        requiredFields: ["contractValue", "plannedFinish"]
      })
    ]);
    await expect(
      dataSource.listCrmPipelineStageAutomationDefinitions("tenant-alpha", pipeline.id)
    ).resolves.toEqual([
      expect.objectContaining({
        id: automation.id,
        actionConfig: { title: "Prepare project handoff" }
      })
    ]);

    await expect(
      dataSource.updateCrmPipelineStage({
        ...firstStage,
        name: "Initial intake",
        status: "archived"
      })
    ).resolves.toMatchObject({
      id: firstStage.id,
      name: "Initial intake",
      status: "archived"
    });
    await expect(
      dataSource.updateCrmPipelineTransitionRule({
        ...rule,
        requireReason: false,
        status: "archived"
      })
    ).resolves.toMatchObject({ id: rule.id, requireReason: false, status: "archived" });
    await expect(
      dataSource.updateCrmPipelineStageAutomationDefinition({
        ...automation,
        actionConfig: { title: "Prepare project handoff", priority: "high" },
        status: "archived"
      })
    ).resolves.toMatchObject({
      id: automation.id,
      actionConfig: { title: "Prepare project handoff", priority: "high" },
      status: "archived"
    });
    await expect(
      dataSource.updateCrmPipeline({
        ...pipeline,
        name: "Architecture sales v2",
        status: "archived"
      })
    ).resolves.toMatchObject({
      id: pipeline.id,
      name: "Architecture sales v2",
      status: "archived"
    });
  });
});
