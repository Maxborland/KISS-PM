import { sql } from "drizzle-orm";
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

describe("PostgreSQL tenant data source", () => {
  let client: PostgresClient;
  let dataSource: ReturnType<typeof createPostgresTenantDataSource>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    dataSource = createPostgresTenantDataSource(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("lists users only inside the requested tenant", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;
    await client`
      INSERT INTO access_profiles (id, tenant_id, name, permissions, created_at)
      VALUES
        ('tenant-admin-alpha', 'tenant-alpha', 'Администратор', '["tenant.users.read"]'::jsonb, now()),
        ('tenant-admin-beta', 'tenant-beta', 'Администратор', '["tenant.users.read"]'::jsonb, now())
    `;
    await client`
      INSERT INTO tenant_users (id, tenant_id, access_profile_id, email, name, created_at)
      VALUES
        ('user-alpha-admin', 'tenant-alpha', 'tenant-admin-alpha', 'admin@kiss-pm.local', 'Анна Администратор', now()),
        ('user-beta-admin', 'tenant-beta', 'tenant-admin-beta', 'beta@kiss-pm.local', 'Борис Администратор', now())
    `;

    await expect(dataSource.listUsersByTenantId("tenant-alpha")).resolves.toEqual([
      {
        id: "user-alpha-admin",
        tenantId: "tenant-alpha",
        name: "Анна Администратор",
        accessProfileId: "tenant-admin-alpha"
      }
    ]);
  });

  it("persists audit events with mandatory trace fields", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES ('tenant-alpha', 'Альфа Проект', now())
    `;

    await dataSource.appendAuditEvent({
      id: "audit-1",
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      actionType: "tenant.user.listed",
      sourceSurfaceId: null,
      sourceWorkflow: "phase_1_3_test",
      sourceEntity: {
        type: "Tenant",
        id: "tenant-alpha"
      },
      input: {},
      beforeState: null,
      afterState: null,
      permissionResult: {
        allowed: true
      },
      executionResult: {
        status: "succeeded"
      },
      correlationId: "corr-1",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });

    const rows = await dataSource.db.execute(sql`
      SELECT tenant_id, actor_user_id, action_type, correlation_id
      FROM audit_events
      WHERE id = 'audit-1'
    `);

    expect(rows).toEqual([
      {
        tenant_id: "tenant-alpha",
        actor_user_id: "user-alpha-admin",
        action_type: "tenant.user.listed",
        correlation_id: "corr-1"
      }
    ]);
  });

  it("creates and reads access profiles inside one tenant", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;
    await dataSource.createAccessProfile({
      id: "access-profile-alpha-controller",
      tenantId: "tenant-alpha",
      name: "Контролер",
      permissions: ["tenant.users.read"]
    });

    await expect(dataSource.listAccessProfilesByTenantId("tenant-alpha")).resolves.toEqual([
      {
        id: "access-profile-alpha-controller",
        tenantId: "tenant-alpha",
        name: "Контролер",
        permissions: ["tenant.users.read"]
      }
    ]);
    await expect(dataSource.listAccessProfilesByTenantId("tenant-beta")).resolves.toEqual([]);
  });

  it("persists custom fields and project templates only inside one tenant", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;

    const field = await dataSource.createCustomFieldDefinition({
      id: "field-project-priority",
      tenantId: "tenant-alpha",
      systemKey: "project_priority",
      tenantLabel: "Приоритет проекта",
      targetEntity: "project",
      fieldType: "select",
      required: true,
      status: "active"
    });
    const template = await dataSource.createProjectTemplate({
      id: "template-implementation",
      tenantId: "tenant-alpha",
      systemKey: "implementation",
      tenantLabel: "Внедрение",
      description: "Базовый шаблон проекта внедрения",
      status: "draft"
    });

    expect(field).toMatchObject({
      id: "field-project-priority",
      tenantId: "tenant-alpha",
      systemKey: "project_priority",
      tenantLabel: "Приоритет проекта"
    });
    expect(template).toMatchObject({
      id: "template-implementation",
      tenantId: "tenant-alpha",
      systemKey: "implementation",
      tenantLabel: "Внедрение"
    });
    await expect(dataSource.listCustomFieldDefinitions("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listCustomFieldDefinitions("tenant-beta")).resolves.toEqual([]);
    await expect(dataSource.listProjectTemplates("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listProjectTemplates("tenant-beta")).resolves.toEqual([]);

    await expect(
      dataSource.createCustomFieldDefinition({
        id: "field-project-priority",
        tenantId: "tenant-beta",
        systemKey: "project_priority",
        tenantLabel: "Приоритет проекта",
        targetEntity: "project",
        fieldType: "select",
        required: false,
        status: "draft"
      })
    ).resolves.toMatchObject({
      id: "field-project-priority",
      tenantId: "tenant-beta"
    });

    await expect(
      dataSource.updateCustomFieldDefinition({
        ...field,
        tenantLabel: "Приоритет портфеля",
        required: false
      })
    ).resolves.toMatchObject({
      tenantLabel: "Приоритет портфеля",
      required: false
    });
    await expect(
      dataSource.updateProjectTemplate({
        ...template,
        status: "active",
        description: null
      })
    ).resolves.toMatchObject({
      status: "active",
      description: null
    });
  });

  it("persists opportunities with demand and active projects inside one tenant", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES
        ('tenant-alpha', 'Альфа Проект', now()),
        ('tenant-beta', 'Бета Проект', now())
    `;
    await client`
      INSERT INTO positions (id, tenant_id, name, created_at)
      VALUES
        ('position-engineer', 'tenant-alpha', 'Инженер', now()),
        ('position-analyst', 'tenant-alpha', 'Аналитик', now())
    `;

    const opportunity = await dataSource.createOpportunity({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      title: "Внедрение KISS PM",
      projectType: "implementation",
      description: "Первичный проект внедрения",
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
      contractValue: 960_000,
      plannedHourlyRate: 6_000,
      plannedHours: 160,
      probability: 80,
      status: "new",
      templateId: null,
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 40 }
      ]
    });
    const assessed = await dataSource.updateOpportunityFeasibility({
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      status: "ready_to_activate",
      feasibilityStatus: "ok",
      feasibilityResult: {
        status: "ok",
        rows: []
      }
    });
    const project = await dataSource.activateProjectFromOpportunity({
      id: "project-alpha",
      tenantId: "tenant-alpha",
      sourceOpportunityId: "opportunity-alpha",
      title: assessed.title,
      clientName: assessed.clientName,
      status: "active",
      plannedStart: assessed.plannedStart,
      plannedFinish: assessed.plannedFinish,
      contractValue: assessed.contractValue,
      plannedHours: assessed.plannedHours,
      templateId: assessed.templateId,
      demand: assessed.demand
    });

    expect(opportunity).toMatchObject({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      plannedHours: 160,
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 40 }
      ]
    });
    await expect(dataSource.listOpportunities("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listOpportunities("tenant-beta")).resolves.toEqual([]);
    expect(project).toMatchObject({
      id: "project-alpha",
      tenantId: "tenant-alpha",
      status: "active",
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 40 }
      ]
    });
    await expect(
      dataSource.activateProjectFromOpportunity({
        id: "project-alpha-copy",
        tenantId: "tenant-alpha",
        sourceOpportunityId: "opportunity-alpha",
        title: assessed.title,
        clientName: assessed.clientName,
        status: "active",
        plannedStart: assessed.plannedStart,
        plannedFinish: assessed.plannedFinish,
        contractValue: assessed.contractValue,
        plannedHours: assessed.plannedHours,
        templateId: assessed.templateId,
        demand: assessed.demand
      })
    ).rejects.toThrow("source_opportunity_already_activated");
    await expect(dataSource.listProjects("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listProjects("tenant-beta")).resolves.toEqual([]);
  });
});
