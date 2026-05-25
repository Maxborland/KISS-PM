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
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const dataset: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа" }],
  accessProfiles: [
    createTenantAdminSeedProfile({
      id: "access-profile-admin",
      tenantId: "tenant-alpha"
    })
  ],
  positions: [],
  clients: [],
  projectTypes: [],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Админ",
      accessProfileId: "access-profile-admin",
      positionId: null,
      password: "admin12345"
    }
  ]
};

describe("production calendar routes (db)", () => {
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
        password: "admin12345"
      })
    });
    expect(login.status).toBe(200);
    cookie = login.headers.get("set-cookie") ?? "";
  });

  afterAll(async () => {
    await client.end();
  });

  it("reads and bulk-updates tenant production calendar", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const bulk = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        exceptions: [
          {
            id: "holiday-2026-01-01",
            date: "2026-01-01",
            workingMinutes: 0,
            reason: "Новый год"
          }
        ]
      })
    });
    expect(bulk.status).toBe(200);

    const read = await app.request("/api/tenant/current/production-calendar?year=2026", {
      headers: { cookie }
    });
    expect(read.status).toBe(200);
    const body = (await read.json()) as {
      calendarId: string;
      exceptions: Array<{ date: string; reason: string | null }>;
    };
    expect(body.calendarId).toBe("tenant-default");
    expect(body.exceptions.some((item) => item.date === "2026-01-01")).toBe(true);
  });
});
