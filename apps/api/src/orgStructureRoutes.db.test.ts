import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const dataset: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа" }],
  accessProfiles: [
    createTenantAdminSeedProfile({
      id: "access-profile-admin",
      tenantId: "tenant-alpha"
    })
  ],
  positions: [{ id: "pos-dev", tenantId: "tenant-alpha", name: "Разработчик", description: null }],
  clients: [],
  projectTypes: [],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Админ",
      accessProfileId: "access-profile-admin",
      positionId: "pos-dev",
      password: "local-admin-password"
    }
  ]
};

describe("org structure routes (db)", () => {
  let client: PostgresClient;
  let cookie: string;

  beforeAll(async () => {
    client = createPostgresClient(databaseUrl);
    const db = createDatabase(client);
    await seedTenantDataset(db, dataset);
    const dataSource = createPostgresTenantDataSource(db);
    const app = createApp({ dataSource });

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        email: "admin@kiss-pm.local",
        password: "local-admin-password"
      })
    });
    expect(login.status).toBe(200);
    cookie = login.headers.get("set-cookie") ?? "";
  });

  afterAll(async () => {
    await client.end();
  });

  it("reads and replaces org structure with audit", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const initial = await app.request("/api/tenant/current/org-structure", {
      headers: { cookie }
    });
    expect(initial.status).toBe(200);

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        functional: {
          nodes: [
            {
              id: "dir-1",
              nodeType: "direction",
              name: "Инженерия",
              parentId: null,
              sortOrder: 0
            },
            {
              id: "dept-1",
              nodeType: "department",
              name: "Backend",
              parentId: "dir-1",
              sortOrder: 0
            }
          ],
          placements: [
            {
              userId: "user-alpha-admin",
              directionId: "dir-1",
              departmentId: "dept-1",
              positionId: "pos-dev"
            }
          ]
        },
        project: { nodes: [], placements: [] }
      })
    });
    expect(put.status).toBe(200);
    const saved = (await put.json()) as {
      orgStructure: { functional: { nodes: Array<{ id: string }>; placements: Array<{ userId: string }> } };
    };
    expect(saved.orgStructure.functional.nodes).toHaveLength(2);
    expect(saved.orgStructure.functional.placements[0]?.userId).toBe("user-alpha-admin");

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });
    expect(audit.status).toBe(200);
    const body = (await audit.json()) as { auditEvents: Array<{ actionType: string }> };
    expect(body.auditEvents.map((event) => event.actionType)).toContain(
      "tenant.org_structure.updated"
    );
  });

  it("rejects invalid functional placement", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        functional: {
          nodes: [
            {
              id: "dir-1",
              nodeType: "direction",
              name: "Инженерия",
              parentId: null,
              sortOrder: 0
            }
          ],
          placements: [
            {
              userId: "user-alpha-admin",
              directionId: "dir-1",
              departmentId: "missing-dept",
              positionId: "pos-dev"
            }
          ]
        },
        project: { nodes: [], placements: [] }
      })
    });
    expect(put.status).toBe(400);
  });
});
