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
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

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
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка"
    }
  ],
  contacts: [
    {
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      name: "Ирина Клиент"
    }
  ],
  products: [
    {
      id: "product-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение KISS PM",
      sku: "KISS-IMPL",
      type: "service",
      unit: "час",
      price: 6000
    }
  ],
  projectTypes: [
    {
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение"
    }
  ],
  dealStages: [
    {
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
      name: "Новая",
      sortOrder: 10
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
      password: "admin12345"
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
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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
        (SELECT count(*)::int FROM clients) AS clients,
        (SELECT count(*)::int FROM contacts) AS contacts,
        (SELECT count(*)::int FROM products) AS products,
        (SELECT count(*)::int FROM project_types) AS project_types,
        (SELECT count(*)::int FROM deal_stages) AS deal_stages,
        (SELECT count(*)::int FROM tenant_users) AS tenant_users,
        (SELECT count(*)::int FROM user_credentials) AS user_credentials
    `);

    expect(rows).toEqual([
      {
        tenants: 2,
        access_profiles: 2,
        positions: 1,
        clients: 1,
        contacts: 1,
        products: 1,
        project_types: 1,
        deal_stages: 1,
        tenant_users: 2,
        user_credentials: 1
      }
    ]);
  });
});
