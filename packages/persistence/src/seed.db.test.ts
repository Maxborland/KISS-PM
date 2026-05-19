import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const seedDataset: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Альфа Проект" },
    { id: "tenant-beta", name: "Бета Проект" }
  ],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: ["tenant.users.read"]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Администратор",
      permissions: ["tenant.users.read"]
    }
  ],
  positions: [
    {
      id: "position-project-manager",
      tenantId: "tenant-alpha",
      name: "Руководитель проекта"
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-project-manager",
      password: "local-admin-password"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "beta@kiss-pm.local",
      name: "Борис Администратор",
      accessProfileId: "access-profile-beta-admin"
    }
  ]
};

describe("dev tenant seed", () => {
  let client: PostgresClient;
  let db: ReturnType<typeof createDatabase>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    db = createDatabase(client);
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("seeds tenants, access profiles and users idempotently", async () => {
    await seedTenantDataset(db, seedDataset, new Date("2026-05-18T00:00:00.000Z"));
    await seedTenantDataset(db, seedDataset, new Date("2026-05-19T00:00:00.000Z"));

    const rows = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM tenants) AS tenants,
        (SELECT count(*)::int FROM access_profiles) AS access_profiles,
        (SELECT count(*)::int FROM positions) AS positions,
        (SELECT count(*)::int FROM tenant_users) AS tenant_users,
        (SELECT count(*)::int FROM user_credentials) AS user_credentials
    `);

    expect(rows).toEqual([
      {
        tenants: 2,
        access_profiles: 2,
        positions: 1,
        tenant_users: 2,
        user_credentials: 1
      }
    ]);
  });
});
