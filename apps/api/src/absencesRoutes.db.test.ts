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
    const body = (await audit.json()) as { auditEvents: Array<{ actionType: string }> };
    const actionTypes = body.auditEvents.map((event) => event.actionType);
    expect(actionTypes).toContain("tenant.absence.created");
    expect(actionTypes).toContain("tenant.absence.deleted");
  });

  it("rejects malformed absence user identifiers before repository mutation/read", async () => {
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
        userId: "bad/user",
        type: "vacation",
        dateFrom: "2026-06-10",
        dateTo: "2026-06-12"
      })
    });
    expect(create.status).toBe(400);
    await expect(create.json()).resolves.toEqual({ error: "invalid_user_id" });

    const list = await app.request(
      "/api/tenant/current/absences?fromDate=2026-06-01&toDate=2026-06-30&userId=bad%2Fuser",
      { headers: { cookie } }
    );
    expect(list.status).toBe(400);
    await expect(list.json()).resolves.toEqual({ error: "invalid_user_id" });
  });

  it("rejects invalid absence dates and oversized reason before persistence", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });

    const impossibleDate = await app.request("/api/tenant/current/absences", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        userId: "user-alpha-admin",
        type: "vacation",
        dateFrom: "2026-02-31",
        dateTo: "2026-03-02"
      })
    });
    expect(impossibleDate.status).toBe(400);
    await expect(impossibleDate.json()).resolves.toEqual({
      error: "resource_absence_invalid"
    });

    const oversizedReason = await app.request("/api/tenant/current/absences", {
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
        reason: "x".repeat(501)
      })
    });
    expect(oversizedReason.status).toBe(400);
    await expect(oversizedReason.json()).resolves.toEqual({
      error: "resource_absence_invalid"
    });

    const unsafeReason = await app.request("/api/tenant/current/absences", {
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
        reason: "unsafe\nreason"
      })
    });
    expect(unsafeReason.status).toBe(400);
    await expect(unsafeReason.json()).resolves.toEqual({
      error: "resource_absence_invalid"
    });

    const invalidListDate = await app.request(
      "/api/tenant/current/absences?fromDate=2026-02-31&toDate=2026-03-05",
      { headers: { cookie } }
    );
    expect(invalidListDate.status).toBe(400);
    await expect(invalidListDate.json()).resolves.toEqual({
      error: "resource_absence_invalid_range"
    });

    const oversizedListRange = await app.request(
      "/api/tenant/current/absences?fromDate=2026-01-01&toDate=2027-12-31",
      { headers: { cookie } }
    );
    expect(oversizedListRange.status).toBe(400);
    await expect(oversizedListRange.json()).resolves.toEqual({
      error: "resource_absence_invalid_range"
    });
  });

  it("denies read without permission", async () => {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const app = createApp({ dataSource });
    const response = await app.request(
      "/api/tenant/current/absences?fromDate=2026-06-01&toDate=2026-06-30"
    );
    expect(response.status).toBe(401);
  });

  it("rolls back absence creation and deletion when audit write fails", async () => {
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
    const failingApp = createApp({ dataSource: failingAuditDataSource });

    const failedCreate = await failingApp.request("/api/tenant/current/absences", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        userId: "user-alpha-admin",
        type: "vacation",
        dateFrom: "2026-08-01",
        dateTo: "2026-08-02",
        reason: "Rollback create"
      })
    });
    expect(failedCreate.status).toBe(500);
    expect(await failedCreate.json()).toEqual({ error: "internal_error" });

    const readApp = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
    const afterFailedCreate = await readApp.request(
      "/api/tenant/current/absences?fromDate=2026-08-01&toDate=2026-08-31",
      { headers: { cookie } }
    );
    expect(afterFailedCreate.status).toBe(200);
    const afterFailedCreateBody = (await afterFailedCreate.json()) as {
      absences: Array<{ reason: string | null }>;
    };
    expect(afterFailedCreateBody.absences).not.toContainEqual(
      expect.objectContaining({ reason: "Rollback create" })
    );

    const normalApp = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
    const create = await normalApp.request("/api/tenant/current/absences", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({
        userId: "user-alpha-admin",
        type: "vacation",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-02",
        reason: "Rollback delete"
      })
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { absence: { id: string } };

    const failedDelete = await failingApp.request(
      `/api/tenant/current/absences/${created.absence.id}`,
      {
        method: "DELETE",
        headers: { cookie, "x-kiss-pm-action": "same-origin" }
      }
    );
    expect(failedDelete.status).toBe(500);
    expect(await failedDelete.json()).toEqual({ error: "internal_error" });

    const afterFailedDelete = await readApp.request(
      "/api/tenant/current/absences?fromDate=2026-09-01&toDate=2026-09-30",
      { headers: { cookie } }
    );
    expect(afterFailedDelete.status).toBe(200);
    const afterFailedDeleteBody = (await afterFailedDelete.json()) as {
      absences: Array<{ id: string }>;
    };
    expect(afterFailedDeleteBody.absences).toContainEqual(
      expect.objectContaining({ id: created.absence.id })
    );
  });
});
