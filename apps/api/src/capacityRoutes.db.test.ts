import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const dataset: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    createTenantAdminSeedProfile({
      id: "access-profile-admin",
      tenantId: "tenant-alpha"
    }),
    {
      id: "access-profile-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      name: "Наблюдатель плана без ресурсов",
      permissions: ["tenant.projects.read", "tenant.project_plan.read"]
    }
  ],
  positions: [{ id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }],
  clients: [{ id: "client-romashka", tenantId: "tenant-alpha", name: "ООО Ромашка" }],
  projectTypes: [
    { id: "project-type-implementation", tenantId: "tenant-alpha", name: "Внедрение" }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-admin",
      positionId: "position-engineer",
      password: "admin12345"
    },
    {
      id: "user-alpha-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      email: "plan-reader-no-resources@kiss-pm.local",
      name: "Никита Без Ресурсов",
      accessProfileId: "access-profile-plan-reader-no-resources",
      positionId: "position-engineer",
      password: "reader12345"
    }
  ]
};

describe("capacity API routes", () => {
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
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, projects, opportunities, contacts, clients, project_types, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-21T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it("returns 403 for tree without project_resources.read", async () => {
    const cookie = await loginAs("plan-reader-no-resources@kiss-pm.local", "reader12345");
    const response = await app.request("/api/workspace/capacity/tree?monthIso=2026-05", {
      headers: { cookie }
    });
    expect(response.status).toBe(403);
  });

  it("returns org capacity tree for admin", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request("/api/workspace/capacity/tree?monthIso=2026-05", {
      headers: { cookie }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { monthIso: string; hierarchyMode?: string };
    expect(body.monthIso).toBe("2026-05");
    expect(body.hierarchyMode).toBe("org");
  });

  it("returns capacity summary for admin", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request("/api/workspace/capacity/summary?monthIso=2026-05", {
      headers: { cookie }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      monthIso: string;
      buckets: { low: number; mid: number; high: number };
      overloadProjectIds: string[];
    };
    expect(body.monthIso).toBe("2026-05");
    expect(body.buckets).toEqual(
      expect.objectContaining({ low: expect.any(Number), mid: expect.any(Number), high: expect.any(Number) })
    );
    expect(Array.isArray(body.overloadProjectIds)).toBe(true);
  });
});
