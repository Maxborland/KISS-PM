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

  it("bulk response reflects the edited items' year, not the current year", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });
    const editedYear = new Date().getUTCFullYear() + 1;

    const bulk = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({
        exceptions: [
          { id: "holiday-next-year", date: `${editedYear}-01-01`, workingMinutes: 0, reason: "Следующий год" }
        ]
      })
    });
    expect(bulk.status).toBe(200);
    const view = (await bulk.json()) as { year: number; exceptions: Array<{ id: string }> };
    expect(view.year).toBe(editedYear);
    expect(view.exceptions.some((item) => item.id === "holiday-next-year")).toBe(true);
  });

  it("PATCH updates the base weekly mode with audit (6-day / 12h)", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const patch = await app.request("/api/tenant/current/production-calendar", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({ workingWeekdays: [1, 2, 3, 4, 5, 6], workingMinutesPerDay: 720 })
    });
    expect(patch.status).toBe(200);

    const read = await app.request("/api/tenant/current/production-calendar?year=2026", {
      headers: { cookie }
    });
    expect(read.status).toBe(200);
    const body = (await read.json()) as { workingWeekdays: number[]; workingMinutesPerDay: number };
    expect(body.workingWeekdays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(body.workingMinutesPerDay).toBe(720);

    const audit = await app.request("/api/tenant/current/audit-events", { headers: { cookie } });
    const auditBody = (await audit.json()) as { auditEvents: Array<{ actionType: string }> };
    expect(auditBody.auditEvents.map((event) => event.actionType))
      .toContain("tenant.production_calendar.base_mode_updated");
  });

  it("rejects malformed base mode input (empty weekdays / bad minutes)", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const emptyWeekdays = await app.request("/api/tenant/current/production-calendar", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({ workingWeekdays: [], workingMinutesPerDay: 480 })
    });
    expect(emptyWeekdays.status).toBe(400);
    expect(await emptyWeekdays.json()).toEqual({ error: "production_calendar_invalid" });

    const badMinutes = await app.request("/api/tenant/current/production-calendar", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({ workingWeekdays: [1, 2, 3], workingMinutesPerDay: 0 })
    });
    expect(badMinutes.status).toBe(400);
    expect(await badMinutes.json()).toEqual({ error: "production_calendar_invalid" });

    const duplicateDay = await app.request("/api/tenant/current/production-calendar", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({ workingWeekdays: [1, 1, 2], workingMinutesPerDay: 480 })
    });
    expect(duplicateDay.status).toBe(400);
    expect(await duplicateDay.json()).toEqual({ error: "production_calendar_invalid" });
  });

  it("deletes an exception with audit; invalid id → 400, missing → 404", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const create = await app.request("/api/tenant/current/production-calendar/bulk", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({
        exceptions: [
          { id: "holiday-to-delete", date: "2026-06-12", workingMinutes: 0, reason: "Ошибочный праздник" }
        ]
      })
    });
    expect(create.status).toBe(200);

    const badId = await app.request("/api/tenant/current/production-calendar/exceptions/bad%2Fid", {
      method: "DELETE",
      headers: { cookie, "x-kiss-pm-action": "same-origin" }
    });
    expect(badId.status).toBe(400);
    expect(await badId.json()).toEqual({ error: "production_calendar_invalid" });

    const missing = await app.request("/api/tenant/current/production-calendar/exceptions/holiday-absent-x", {
      method: "DELETE",
      headers: { cookie, "x-kiss-pm-action": "same-origin" }
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "production_calendar_exception_not_found" });

    const del = await app.request("/api/tenant/current/production-calendar/exceptions/holiday-to-delete", {
      method: "DELETE",
      headers: { cookie, "x-kiss-pm-action": "same-origin" }
    });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });

    const read = await app.request("/api/tenant/current/production-calendar?year=2026", {
      headers: { cookie }
    });
    const body = (await read.json()) as { exceptions: Array<{ id: string }> };
    expect(body.exceptions.some((item) => item.id === "holiday-to-delete")).toBe(false);

    const audit = await app.request("/api/tenant/current/audit-events", { headers: { cookie } });
    const auditBody = (await audit.json()) as { auditEvents: Array<{ actionType: string }> };
    expect(auditBody.auditEvents.map((event) => event.actionType))
      .toContain("tenant.production_calendar.exception_deleted");
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
