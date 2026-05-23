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
    }),
    {
      id: "access-profile-org-reader",
      tenantId: "tenant-alpha",
      name: "Читатель оргструктуры",
      permissions: ["tenant.org_structure.read"]
    }
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
    },
    {
      id: "user-org-reader",
      tenantId: "tenant-alpha",
      email: "org-reader@kiss-pm.local",
      name: "Читатель",
      accessProfileId: "access-profile-org-reader",
      positionId: "pos-dev",
      password: "local-reader-password"
    }
  ]
};

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    },
    body: JSON.stringify({ email, password })
  });
  expect(login.status).toBe(200);
  return login.headers.get("set-cookie") ?? "";
}

describe("org structure routes (db)", () => {
  let client: PostgresClient;
  let adminCookie: string;
  let readerCookie: string;

  beforeAll(async () => {
    client = createPostgresClient(databaseUrl);
    const db = createDatabase(client);
    await seedTenantDataset(db, dataset);
    const dataSource = createPostgresTenantDataSource(db);
    const app = createApp({ dataSource });
    adminCookie = await login(app, "admin@kiss-pm.local", "local-admin-password");
    readerCookie = await login(app, "org-reader@kiss-pm.local", "local-reader-password");
  });

  afterAll(async () => {
    await client.end();
  });

  it("reads and replaces org structure with audit", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const initial = await app.request("/api/tenant/current/org-structure", {
      headers: { cookie: adminCookie }
    });
    expect(initial.status).toBe(200);

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie: adminCookie,
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
      headers: { cookie: adminCookie }
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
        cookie: adminCookie,
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

  it("rejects duplicate user placement in one track", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie: adminCookie,
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
            },
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
    expect(put.status).toBe(400);
    const body = (await put.json()) as { error: string };
    expect(body.error).toBe("tenant_org_placement_duplicate_user");
  });

  it("rejects unknown positionId", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie: adminCookie,
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
              positionId: "missing-position"
            }
          ]
        },
        project: { nodes: [], placements: [] }
      })
    });
    expect(put.status).toBe(400);
    const body = (await put.json()) as { error: string };
    expect(body.error).toBe("tenant_org_placement_invalid_position");
  });

  it("rejects placement when department belongs to another direction", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie: adminCookie,
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
              id: "dir-2",
              nodeType: "direction",
              name: "Продажи",
              parentId: null,
              sortOrder: 1
            },
            {
              id: "dept-2",
              nodeType: "department",
              name: "Sales",
              parentId: "dir-2",
              sortOrder: 0
            }
          ],
          placements: [
            {
              userId: "user-alpha-admin",
              directionId: "dir-1",
              departmentId: "dept-2",
              positionId: "pos-dev"
            }
          ]
        },
        project: { nodes: [], placements: [] }
      })
    });
    expect(put.status).toBe(400);
    const body = (await put.json()) as { error: string };
    expect(body.error).toBe("tenant_org_placement_invalid_department");
  });

  it("allows read but denies manage for org reader", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const read = await app.request("/api/tenant/current/org-structure", {
      headers: { cookie: readerCookie }
    });
    expect(read.status).toBe(200);

    const put = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        cookie: readerCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        functional: { nodes: [], placements: [] },
        project: { nodes: [], placements: [] }
      })
    });
    expect(put.status).toBe(403);
  });
});
