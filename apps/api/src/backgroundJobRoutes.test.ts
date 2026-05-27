import type { AccessProfile } from "@kiss-pm/access-control";
import type { BackgroundJobRun, TenantUser } from "@kiss-pm/domain";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "./apiTypes";
import { registerBackgroundJobRoutes } from "./backgroundJobRoutes";

describe("background job routes", () => {
  it("allows operators to enqueue and inspect tenant jobs", async () => {
    const fixture = createFixture();
    const app = createApp(fixture);

    const enqueue = await app.request("/api/workspace/background-jobs/runs", {
      method: "POST",
      headers: {
        cookie: "kiss_pm_session=test",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        kind: "notification.dispatch",
        payload: { digest: "daily" },
        priority: 5
      })
    });

    expect(enqueue.status).toBe(201);
    await expect(enqueue.json()).resolves.toMatchObject({
      run: {
        kind: "notification.dispatch",
        status: "queued",
        payload: { digest: "daily" },
        priority: 5
      }
    });

    const list = await app.request("/api/workspace/background-jobs/runs?status=queued", {
      headers: { cookie: "kiss_pm_session=test" }
    });

    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      runs: [
        {
          kind: "notification.dispatch",
          status: "queued"
        }
      ]
    });
  });

  it("rejects users without background job permission", async () => {
    const fixture = createFixture({ permissions: [] });
    const app = createApp(fixture);

    const response = await app.request("/api/workspace/background-jobs/runs", {
      headers: { cookie: "kiss_pm_session=test" }
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
  });

  it("rejects unknown job kinds before persistence", async () => {
    const fixture = createFixture();
    const app = createApp(fixture);

    const response = await app.request("/api/workspace/background-jobs/runs", {
      method: "POST",
      headers: {
        cookie: "kiss_pm_session=test",
        "content-type": "application/json"
      },
      body: JSON.stringify({ kind: "shell.exec" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "background_job_kind_invalid" });
    expect(fixture.jobs).toHaveLength(0);
  });
});

type Fixture = {
  actor: TenantUser;
  profile: AccessProfile;
  jobs: BackgroundJobRun[];
};

function createFixture(input: { permissions?: string[] } = {}): Fixture {
  return {
    actor: {
      id: "user-alpha",
      tenantId: "tenant-alpha",
      name: "Анна",
      accessProfileId: "profile-alpha"
    },
    profile: {
      id: "profile-alpha",
      permissions: input.permissions ?? [
        "tenant.background_jobs.read",
        "tenant.background_jobs.manage"
      ]
    } as AccessProfile,
    jobs: []
  };
}

function createApp(fixture: Fixture) {
  const app = new Hono();
  registerBackgroundJobRoutes(app, {
    dataSource: createDataSource(fixture),
    getActorProfile: async () => fixture.profile,
    getSessionActorFromHeaders: async () => fixture.actor
  });
  return app;
}

function createDataSource(fixture: Fixture): ApiTenantDataSource {
  return {
    enqueueBackgroundJob: async (input) => {
      const now = new Date("2026-05-27T00:00:00.000Z");
      const job: BackgroundJobRun = {
        id: input.id,
        tenantId: input.tenantId,
        kind: input.kind,
        status: "queued",
        priority: input.priority ?? 0,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey ?? null,
        attempt: 0,
        maxAttempts: input.maxAttempts ?? 5,
        runAfter: input.runAfter ?? now,
        lockedBy: null,
        lockedAt: null,
        startedAt: null,
        finishedAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now
      };
      fixture.jobs.push(job);
      return job;
    },
    listBackgroundJobs: async (input) =>
      fixture.jobs.filter((job) =>
        job.tenantId === input.tenantId &&
        (!input.status || job.status === input.status)
      )
  } as ApiTenantDataSource;
}
