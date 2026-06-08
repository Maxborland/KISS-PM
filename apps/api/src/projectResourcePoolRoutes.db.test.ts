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
import type { ApiTenantDataSource } from "./apiTypes";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const projectResourcePoolApiSeed: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Tenant Alpha" },
    { id: "tenant-beta", name: "Tenant Beta" }
  ],
  accessProfiles: [
    {
      id: "access-profile-admin",
      tenantId: "tenant-alpha",
      name: "Admin",
      permissions: [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.opportunities.read",
        "tenant.opportunities.manage",
        "tenant.project_activation.manage",
        "tenant.project_resources.read",
        "tenant.project_resources.manage",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-resource-reader",
      tenantId: "tenant-alpha",
      name: "Resource reader",
      permissions: ["tenant.project_resources.read"]
    },
    { id: "access-profile-denied", tenantId: "tenant-alpha", name: "Denied", permissions: [] },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Beta Admin",
      permissions: ["tenant.project_resources.read", "tenant.project_resources.manage"]
    }
  ],
  positions: [
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Engineer" },
    { id: "position-beta", tenantId: "tenant-beta", name: "Beta Engineer" }
  ],
  clients: [{ id: "client-alpha", tenantId: "tenant-alpha", name: "Client Alpha" }],
  projectTypes: [{ id: "project-type-alpha", tenantId: "tenant-alpha", name: "Implementation" }],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Admin",
      accessProfileId: "access-profile-admin",
      positionId: "position-engineer",
      password: "admin12345"
    },
    {
      id: "user-alpha-resource",
      tenantId: "tenant-alpha",
      email: "resource@kiss-pm.local",
      name: "Resource",
      accessProfileId: "access-profile-resource-reader",
      positionId: "position-engineer",
      password: "resource12345"
    },
    {
      id: "user-alpha-denied",
      tenantId: "tenant-alpha",
      email: "denied@kiss-pm.local",
      name: "Denied",
      accessProfileId: "access-profile-denied",
      password: "denied12345"
    },
    {
      id: "user-alpha-inactive",
      tenantId: "tenant-alpha",
      email: "inactive@kiss-pm.local",
      name: "Inactive",
      accessProfileId: "access-profile-resource-reader",
      positionId: "position-engineer",
      status: "inactive",
      password: "inactive12345"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      name: "Beta Admin",
      accessProfileId: "access-profile-beta-admin",
      positionId: "position-beta",
      password: "beta12345"
    }
  ]
};

describe("project resource pool API routes", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({ dataSource: createPostgresTenantDataSource(createDatabase(client)) });
  });

  beforeEach(async () => {
    await client`TRUNCATE project_resource_pool_members, audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      projectResourcePoolApiSeed,
      new Date("2026-05-19T00:00:00.000Z")
    );
    await createActiveProject(client);
  });

  afterAll(async () => {
    await client`TRUNCATE project_resource_pool_members, audit_events, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("replaces and reads the active project resource pool", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const replace = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        members: [
          { userId: "user-alpha-admin", role: "project_manager" },
          { userId: "user-alpha-resource", role: "resource" }
        ]
      })
    });

    expect(replace.status).toBe(200);
    await expect(replace.json()).resolves.toMatchObject({
      resourcePool: {
        projectId: "project-alpha",
        members: [
          { userId: "user-alpha-admin", role: "project_manager" },
          { userId: "user-alpha-resource", role: "resource" }
        ]
      }
    });

    const readerCookie = await loginAs("resource@kiss-pm.local", "resource12345");
    const read = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      headers: { cookie: readerCookie }
    });

    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      resourcePool: {
        projectId: "project-alpha",
        members: [
          { userId: "user-alpha-admin", role: "project_manager" },
          { userId: "user-alpha-resource", role: "resource" }
        ]
      }
    });

    const [auditEvent] = await client`
      SELECT action_type, source_entity, input, before_state, after_state
      FROM audit_events
      WHERE tenant_id = 'tenant-alpha'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(auditEvent).toBeDefined();
    if (!auditEvent) throw new Error("resource_pool_audit_event_missing");
    expect(auditEvent.action_type).toBe("project.resource_pool_replaced");
    expect(auditEvent.source_entity).toEqual({ type: "Project", id: "project-alpha" });
    expect(auditEvent.before_state).toEqual({ members: [] });
    expect(auditEvent.after_state).toMatchObject({
      members: [
        { userId: "user-alpha-admin", role: "project_manager" },
        { userId: "user-alpha-resource", role: "resource" }
      ]
    });
  });

  it("rejects duplicate, missing, cross-tenant, and inactive users before replacing", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await replacePool(adminCookie, [{ userId: "user-alpha-admin", role: "project_manager" }]);

    await expect(
      replacePool(adminCookie, [
        { userId: "user-alpha-admin", role: "project_manager" },
        { userId: "user-alpha-admin", role: "observer" }
      ])
    ).resolves.toEqual({ status: 400, body: { error: "duplicate_resource_pool_user" } });
    await expect(
      replacePool(adminCookie, [{ userId: "user-alpha-missing", role: "resource" }])
    ).resolves.toEqual({ status: 400, body: { error: "resource_pool_user_not_found" } });
    await expect(
      replacePool(adminCookie, [{ userId: "user-beta-admin", role: "resource" }])
    ).resolves.toEqual({ status: 400, body: { error: "resource_pool_user_not_found" } });
    await expect(
      replacePool(adminCookie, [{ userId: "user-alpha-inactive", role: "resource" }])
    ).resolves.toEqual({ status: 400, body: { error: "resource_pool_user_inactive" } });

    const read = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      headers: { cookie: adminCookie }
    });
    await expect(read.json()).resolves.toMatchObject({
      resourcePool: { members: [{ userId: "user-alpha-admin", role: "project_manager" }] }
    });
  });

  it("allows reads on paused projects but only manages active projects", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await replacePool(adminCookie, [{ userId: "user-alpha-resource", role: "resource" }]);
    await client`UPDATE projects SET status = 'paused' WHERE tenant_id = 'tenant-alpha' AND id = 'project-alpha'`;

    const read = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      headers: { cookie: adminCookie }
    });
    const replace = await replacePool(adminCookie, [
      { userId: "user-alpha-resource", role: "observer" }
    ]);

    expect(read.status).toBe(200);
    expect(replace).toEqual({ status: 409, body: { error: "project_not_active" } });
  });

  it("re-checks active project status under the resource planning lifecycle lock before replacing", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await replacePool(adminCookie, [{ userId: "user-alpha-admin", role: "project_manager" }]);

    const lifecycleInterleaving = createResourcePoolLifecycleInterleavingApp();
    const replace = await lifecycleInterleaving.app.request(
      "/api/workspace/projects/project-alpha/resource-pool",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          members: [{ userId: "user-alpha-resource", role: "resource" }]
        })
      }
    );

    expect(lifecycleInterleaving.didApplyLifecycleMutation()).toBe(true);
    expect(replace.status).toBe(409);
    await expect(replace.json()).resolves.toEqual({ error: "project_not_active" });

    const read = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      headers: { cookie: adminCookie }
    });
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      resourcePool: { members: [{ userId: "user-alpha-admin", role: "project_manager" }] }
    });
  });
  it("hides draft, closed, and cancelled projects from resource pool reads and writes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");

    for (const status of ["draft", "closed", "cancelled"] as const) {
      await client`UPDATE projects SET status = ${status} WHERE tenant_id = 'tenant-alpha' AND id = 'project-alpha'`;

      const read = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
        headers: { cookie: adminCookie }
      });
      const replace = await replacePool(adminCookie, [
        { userId: "user-alpha-resource", role: "resource" }
      ]);

      expect(read.status).toBe(404);
      expect(replace).toEqual({ status: 409, body: { error: "project_not_active" } });
    }
  });

  it("enforces resource pool permissions", async () => {
    const deniedCookie = await loginAs("denied@kiss-pm.local", "denied12345");

    const read = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      headers: { cookie: deniedCookie }
    });
    const replace = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: deniedCookie
      },
      body: JSON.stringify({ members: [] })
    });

    expect(read.status).toBe(403);
    expect(replace.status).toBe(403);
  });

  async function replacePool(cookie: string, members: Array<{ userId: string; role: string }>) {
    const response = await app.request("/api/workspace/projects/project-alpha/resource-pool", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({ members })
    });

    return { status: response.status, body: await response.json() };
  }

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  function createResourcePoolLifecycleInterleavingApp() {
    const baseDataSource = createPostgresTenantDataSource(createDatabase(client));
    let lifecycleMutationApplied = false;
    const dataSource: ApiTenantDataSource = {
      ...baseDataSource,
      async withTransaction(operation) {
        if (!baseDataSource.withTransaction) throw new Error("transaction_not_configured");

        return baseDataSource.withTransaction(async (transactionDataSource) =>
          operation({
            ...transactionDataSource,
            async lockTenantResourcePlanning(tenantId) {
              if (!lifecycleMutationApplied) {
                lifecycleMutationApplied = true;
                await client`
                  UPDATE projects
                  SET status = 'paused'
                  WHERE tenant_id = ${tenantId} AND id = 'project-alpha'
                `;
              }
              await transactionDataSource.lockTenantResourcePlanning?.(tenantId);
            }
          })
        );
      }
    };

    return { app: createApp({ dataSource }), didApplyLifecycleMutation: () => lifecycleMutationApplied };
  }});

async function createActiveProject(client: PostgresClient) {
  const dataSource = createPostgresTenantDataSource(createDatabase(client));
  const opportunity = await dataSource.createOpportunity({
    id: "opportunity-alpha",
    tenantId: "tenant-alpha",
    clientId: "client-alpha",
    primaryContactId: null,
    projectTypeId: "project-type-alpha",
    stageId: null,
    clientName: "Client Alpha",
    contactName: "Contact Alpha",
    title: "Project Alpha",
    projectType: "Implementation",
    description: null,
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 1000000,
    plannedHourlyRate: 5000,
    plannedHours: 200,
    probability: 80,
    status: "ready_to_activate",
    templateId: null,
    demand: [{ positionId: "position-engineer", requiredHours: 80 }]
  });
  const draft = await dataSource.createProjectDraftFromOpportunity({
    id: "project-alpha",
    tenantId: "tenant-alpha",
    sourceOpportunityId: opportunity.id,
    clientId: opportunity.clientId,
    projectTypeId: opportunity.projectTypeId,
    title: opportunity.title,
    clientName: opportunity.clientName,
    status: "draft",
    plannedStart: opportunity.plannedStart,
    plannedFinish: opportunity.plannedFinish,
    contractValue: opportunity.contractValue,
    plannedHours: opportunity.plannedHours,
    templateId: null,
    demand: opportunity.demand
  });
  await dataSource.activateProjectDraft({ tenantId: "tenant-alpha", projectId: draft.id });
}
