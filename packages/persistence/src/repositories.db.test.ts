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
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

describe("PostgreSQL tenant data source", () => {
  let client: PostgresClient;
  let dataSource: ReturnType<typeof createPostgresTenantDataSource>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    dataSource = createPostgresTenantDataSource(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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
    const clientRecord = await dataSource.createClient({
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка",
      description: null,
      status: "active"
    });
    const contact = await dataSource.createContact({
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: clientRecord.id,
      name: "Ирина Клиент",
      email: null,
      phone: null,
      telegram: null,
      role: null,
      status: "active"
    });
    const projectType = await dataSource.createProjectType({
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение",
      description: null,
      status: "active"
    });
    const stage = await dataSource.createDealStage({
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
      name: "Новая",
      sortOrder: 10,
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
      customFieldValues: {
        "field-opportunity-priority": "Высокий"
      },
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
    expect(assessed).toBeDefined();
    const project = await dataSource.createProjectDraftFromOpportunity({
      id: "project-alpha",
      tenantId: "tenant-alpha",
      sourceOpportunityId: "opportunity-alpha",
      clientId: assessed!.clientId,
      projectTypeId: assessed!.projectTypeId,
      title: assessed!.title,
      clientName: assessed!.clientName,
      status: "draft",
      plannedStart: assessed!.plannedStart,
      plannedFinish: assessed!.plannedFinish,
      contractValue: assessed!.contractValue,
      plannedHours: assessed!.plannedHours,
      templateId: assessed!.templateId,
      demand: assessed!.demand
    });

    expect(opportunity).toMatchObject({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      plannedHours: 160,
      customFieldValues: {
        "field-opportunity-priority": "Высокий"
      },
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
      status: "draft",
      activatedAt: null,
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 40 }
      ]
    });
    await expect(
      dataSource.findOpportunityById("tenant-alpha", "opportunity-alpha")
    ).resolves.toMatchObject({ status: "ready_to_activate" });

    const activatedProject = await dataSource.activateProjectDraft({
      tenantId: "tenant-alpha",
      projectId: "project-alpha"
    });

    expect(activatedProject).toMatchObject({
      id: "project-alpha",
      tenantId: "tenant-alpha",
      status: "active",
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 40 }
      ]
    });
    expect(activatedProject.activatedAt).toBeInstanceOf(Date);
    await expect(
      dataSource.findOpportunityById("tenant-alpha", "opportunity-alpha")
    ).resolves.toMatchObject({ status: "won_closed" });

    await expect(
      dataSource.createProjectDraftFromOpportunity({
        id: "project-alpha-copy",
        tenantId: "tenant-alpha",
        sourceOpportunityId: "opportunity-alpha",
        clientId: assessed!.clientId,
        projectTypeId: assessed!.projectTypeId,
        title: assessed!.title,
        clientName: assessed!.clientName,
        status: "draft",
        plannedStart: assessed!.plannedStart,
        plannedFinish: assessed!.plannedFinish,
        contractValue: assessed!.contractValue,
        plannedHours: assessed!.plannedHours,
        templateId: assessed!.templateId,
        demand: assessed!.demand
      })
    ).rejects.toThrow("source_opportunity_not_draftable");
    await expect(
      dataSource.activateProjectDraft({
        tenantId: "tenant-alpha",
        projectId: "project-alpha"
      })
    ).rejects.toThrow("project_draft_not_activatable");
    await expect(dataSource.listProjects("tenant-alpha")).resolves.toHaveLength(1);
    await expect(dataSource.listProjects("tenant-beta")).resolves.toEqual([]);
  });

  it("ensures one active workspace inbox project and keeps closed inbox history", async () => {
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES ('tenant-alpha', 'Альфа Проект', now())
    `;

    const firstInbox = await dataSource.ensureWorkspaceInboxProject({
      tenantId: "tenant-alpha",
      plannedStart: new Date("2026-07-02T00:00:00.000Z"),
      plannedFinish: new Date("2026-07-03T00:00:00.000Z")
    });
    const widenedInbox = await dataSource.ensureWorkspaceInboxProject({
      tenantId: "tenant-alpha",
      plannedStart: new Date("2026-06-15T00:00:00.000Z"),
      plannedFinish: new Date("2026-08-11T00:00:00.000Z")
    });

    expect(widenedInbox).toMatchObject({
      id: firstInbox.id,
      sourceType: "workspace_inbox",
      sourceOpportunityId: null,
      status: "active"
    });
    expect(widenedInbox.plannedStart.toISOString()).toContain("2026-06-15");
    expect(widenedInbox.plannedFinish.toISOString()).toContain("2026-08-11");

    await client`
      UPDATE projects
      SET status = 'closed'
      WHERE tenant_id = 'tenant-alpha'
        AND id = ${firstInbox.id}
    `;
    const reopenedInbox = await dataSource.ensureWorkspaceInboxProject({
      tenantId: "tenant-alpha",
      plannedStart: new Date("2026-09-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-09-02T00:00:00.000Z")
    });
    await client`
      UPDATE projects
      SET status = 'cancelled'
      WHERE tenant_id = 'tenant-alpha'
        AND id = ${reopenedInbox.id}
    `;
    const recreatedAfterCancelledInbox = await dataSource.ensureWorkspaceInboxProject({
      tenantId: "tenant-alpha",
      plannedStart: new Date("2026-10-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-10-02T00:00:00.000Z")
    });
    const inboxRows = await client`
      SELECT id, status
      FROM projects
      WHERE tenant_id = 'tenant-alpha'
        AND source_type = 'workspace_inbox'
      ORDER BY created_at, id
    `;

    expect(reopenedInbox.id).not.toBe(firstInbox.id);
    expect(recreatedAfterCancelledInbox.id).not.toBe(reopenedInbox.id);
    expect(inboxRows).toHaveLength(3);
    expect(inboxRows.filter((row) => row.status === "active")).toHaveLength(1);
  });
});
