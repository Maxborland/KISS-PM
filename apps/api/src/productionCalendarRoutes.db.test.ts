import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type KissPmDatabase,
  type PostgresClient,
  type PostgresTenantDataSource,
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
        password: "local-admin-password"
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

  it("rejects malformed production calendar query and bulk input", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const badYear = await app.request("/api/tenant/current/production-calendar?year=2026abc", {
      headers: { cookie }
    });
    expect(badYear.status).toBe(400);
    expect(await badYear.json()).toEqual({ error: "production_calendar_invalid" });

    const invalidDate = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        exceptions: [
          {
            id: "holiday-invalid-date",
            date: "2026-02-31",
            workingMinutes: 0
          }
        ]
      })
    });
    expect(invalidDate.status).toBe(400);
    expect(await invalidDate.json()).toEqual({ error: "production_calendar_invalid" });

    const invalidResource = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        exceptions: [
          {
            id: "holiday-invalid-resource",
            date: "2026-03-01",
            workingMinutes: 480,
            resourceId: "bad/user"
          }
        ]
      })
    });
    expect(invalidResource.status).toBe(400);
    expect(await invalidResource.json()).toEqual({ error: "production_calendar_invalid" });

    const unsafeReason = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        exceptions: [
          {
            id: "holiday-unsafe-reason",
            date: "2026-03-02",
            workingMinutes: 0,
            reason: "unsafe\nreason"
          }
        ]
      })
    });
    expect(unsafeReason.status).toBe(400);
    expect(await unsafeReason.json()).toEqual({ error: "production_calendar_invalid" });
  });

  it("rolls back production calendar updates when audit write fails", async () => {
    const db = createDatabase(client);
    const baseDataSource = createPostgresTenantDataSource(db);
    const failingAuditDataSource: PostgresTenantDataSource = {
      ...baseDataSource,
      async appendAuditEvent() {
        throw new Error("audit_write_failed");
      },
      async withTransaction(operation) {
        return db.transaction((transaction) =>
          operation({
            ...createPostgresTenantDataSource(
              transaction as unknown as KissPmDatabase
            ),
            async appendAuditEvent() {
              throw new Error("audit_write_failed");
            }
          })
        );
      }
    };
    const app = createApp({ dataSource: failingAuditDataSource });

    const response = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        exceptions: [
          {
            id: "holiday-audit-rollback",
            date: "2026-04-01",
            workingMinutes: 0,
            reason: "Rollback check"
          }
        ]
      })
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal_error" });

    const readApp = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
    const read = await readApp.request("/api/tenant/current/production-calendar?year=2026", {
      headers: { cookie }
    });
    expect(read.status).toBe(200);
    const body = (await read.json()) as {
      exceptions: Array<{ id: string; date: string }>;
    };
    expect(body.exceptions).not.toContainEqual(
      expect.objectContaining({ id: "holiday-audit-rollback" })
    );
  });
});
