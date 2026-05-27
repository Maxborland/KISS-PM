import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  type PostgresClient
} from "./connection";
import { createBackgroundJobRepository } from "./backgroundJobRepository";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

describe("background job repository", () => {
  let client: PostgresClient;
  let repository: ReturnType<typeof createBackgroundJobRepository>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    repository = createBackgroundJobRepository(createDatabase(client));
  });

  beforeEach(async () => {
    await client`TRUNCATE background_job_events, background_job_runs, background_job_schedules, tenants RESTART IDENTITY CASCADE`;
    await client`
      INSERT INTO tenants (id, name, created_at)
      VALUES ('tenant-alpha', 'Альфа', now())
    `;
  });

  afterAll(async () => {
    await client`TRUNCATE background_job_events, background_job_runs, background_job_schedules, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("reuses an idempotent job without creating duplicate enqueue events", async () => {
    const first = await repository.enqueueBackgroundJob({
      id: "background-job-first",
      tenantId: "tenant-alpha",
      kind: "notification.dispatch",
      payload: { digest: "daily" },
      idempotencyKey: "digest:daily:2026-05-27"
    });
    const second = await repository.enqueueBackgroundJob({
      id: "background-job-second",
      tenantId: "tenant-alpha",
      kind: "notification.dispatch",
      payload: { digest: "daily" },
      idempotencyKey: "digest:daily:2026-05-27"
    });
    const events = await repository.listBackgroundJobEvents({
      tenantId: "tenant-alpha",
      jobId: first.id,
      limit: 10
    });

    expect(second.id).toBe(first.id);
    expect(events.map((event) => event.eventType)).toEqual(["enqueued"]);
  });

  it("recovers stale running jobs through retry scheduling before claiming new work", async () => {
    await repository.enqueueBackgroundJob({
      id: "background-job-stale",
      tenantId: "tenant-alpha",
      kind: "notification.dispatch",
      payload: { digest: "daily" },
      maxAttempts: 2,
      runAfter: new Date("2026-05-27T00:00:00.000Z")
    });
    const claimed = await repository.claimNextBackgroundJob({
      workerId: "worker-a",
      now: new Date("2026-05-27T00:00:00.000Z"),
      kinds: ["notification.dispatch"]
    });
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempt).toBe(1);

    const recoveredOnly = await repository.claimNextBackgroundJob({
      workerId: "worker-b",
      now: new Date("2026-05-27T00:20:00.000Z"),
      kinds: ["notification.dispatch"],
      leaseTimeoutMs: 60_000
    });
    const queued = await repository.listBackgroundJobs({
      tenantId: "tenant-alpha",
      status: "queued",
      limit: 10
    });
    const events = await repository.listBackgroundJobEvents({
      tenantId: "tenant-alpha",
      jobId: "background-job-stale",
      limit: 10
    });

    expect(recoveredOnly).toBeUndefined();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      id: "background-job-stale",
      status: "queued",
      lockedBy: null,
      lockedAt: null,
      lastError: "background_job_lease_expired"
    });
    expect(queued[0]?.runAfter.toISOString()).toBe("2026-05-27T00:21:00.000Z");
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "claimed",
      "enqueued",
      "retry_scheduled"
    ]);

    const reclaimed = await repository.claimNextBackgroundJob({
      workerId: "worker-b",
      now: new Date("2026-05-27T00:21:00.000Z"),
      kinds: ["notification.dispatch"],
      leaseTimeoutMs: 60_000
    });
    expect(reclaimed).toMatchObject({
      id: "background-job-stale",
      status: "running",
      attempt: 2,
      lockedBy: "worker-b"
    });
  });
});
