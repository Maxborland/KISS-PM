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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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
    const stage = await dataSource.createDealStage({
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
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
});
