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
});
