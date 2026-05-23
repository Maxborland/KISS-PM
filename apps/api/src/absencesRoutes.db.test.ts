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
      password: "local-admin-password"
    }
  ]
};

describe("absences routes (db)", () => {
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

  it("creates, lists and deletes absences with audit", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const create = await app.request("/api/tenant/current/absences", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        userId: "user-alpha-admin",
        type: "vacation",
        dateFrom: "2026-06-10",
        dateTo: "2026-06-12",
        reason: "Отпуск"
      })
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { absence: { id: string } };

    const list = await app.request(
      "/api/tenant/current/absences?fromDate=2026-06-01&toDate=2026-06-30",
      { headers: { cookie } }
    );
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { absences: Array<{ id: string }> };
    expect(listed.absences.some((item) => item.id === created.absence.id)).toBe(true);

    const del = await app.request(`/api/tenant/current/absences/${created.absence.id}`, {
      method: "DELETE",
      headers: { cookie, "x-kiss-pm-action": "same-origin" }
    });
    expect(del.status).toBe(200);

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });
    expect(audit.status).toBe(200);
    const events = (await audit.json()) as { events: Array<{ actionType: string }> };
    const actionTypes = events.events.map((event) => event.actionType);
    expect(actionTypes).toContain("tenant.absence.created");
    expect(actionTypes).toContain("tenant.absence.deleted");
  });

  it("denies read without permission", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });
    const response = await app.request(
      "/api/tenant/current/absences?fromDate=2026-06-01&toDate=2026-06-30"
    );
    expect(response.status).toBe(401);
  });
});
