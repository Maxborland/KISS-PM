import type { BackgroundJobRun } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import { createLocalStorageProvider } from "../storageProvider";
import {
  enqueueDueBackgroundJobSchedules,
  runBackgroundJobWorkerTick
} from "./backgroundJobWorker";
import { createDefaultBackgroundJobRegistry } from "./jobHandlers";

describe("background job worker", () => {
  it("claims a queued job, runs the handler and completes it", async () => {
    const job = backgroundJob("storage.asset_cleanup");
    const events: string[] = [];
    const dataSource: ApiTenantDataSource = {
      claimNextBackgroundJob: async () => job,
      completeBackgroundJob: async () => {
        events.push("completed");
        return { ...job, status: "succeeded" };
      },
      failBackgroundJob: async () => {
        events.push("failed");
        return { ...job, status: "queued" };
      },
      listArchivedFileAssetsForCleanup: async () => [],
      markFileAssetPurged: async () => undefined
    } as unknown as ApiTenantDataSource;

    const result = await runBackgroundJobWorkerTick({
      dataSource,
      registry: createDefaultBackgroundJobRegistry(),
      storageProvider: createLocalStorageProvider({ root: "C:/tmp/kiss-pm-worker-test" }),
      workerId: "worker-test",
      now: new Date("2026-05-27T00:00:00.000Z")
    });

    expect(result.status).toBe("succeeded");
    expect(events).toEqual(["completed"]);
  });

  it("turns handler failures into retry/dead transitions through persistence", async () => {
    const job = backgroundJob("capacity.cache_warmup", { monthIso: "not-a-month" });
    const events: string[] = [];
    const dataSource: ApiTenantDataSource = {
      claimNextBackgroundJob: async () => job,
      completeBackgroundJob: async () => {
        events.push("completed");
        return { ...job, status: "succeeded" };
      },
      failBackgroundJob: async (_input: Parameters<NonNullable<ApiTenantDataSource["failBackgroundJob"]>>[0]) => {
        events.push("failed");
        return { ...job, status: "queued" };
      }
    } as unknown as ApiTenantDataSource;

    const result = await runBackgroundJobWorkerTick({
      dataSource,
      registry: createDefaultBackgroundJobRegistry(),
      workerId: "worker-test",
      now: new Date("2026-05-27T00:00:00.000Z")
    });

    expect(result).toMatchObject({
      status: "failed",
      error: "capacity_warmup_month_invalid"
    });
    expect(events).toEqual(["failed"]);
  });

  it("enqueues due schedules with idempotency tied to schedule key and due instant", async () => {
    const enqueued: string[] = [];
    const dataSource: ApiTenantDataSource = {
      listDueBackgroundJobSchedules: async () => [
        {
          id: "schedule-1",
          tenantId: "tenant-alpha",
          kind: "notification.dispatch",
          scheduleKey: "digest:daily",
          payload: { digest: "daily" },
          intervalSeconds: 86_400,
          enabled: true,
          nextRunAt: new Date("2026-05-27T00:00:00.000Z"),
          lastEnqueuedAt: null,
          createdAt: new Date("2026-05-26T00:00:00.000Z"),
          updatedAt: new Date("2026-05-26T00:00:00.000Z")
        }
      ],
      enqueueBackgroundJob: async (input: Parameters<NonNullable<ApiTenantDataSource["enqueueBackgroundJob"]>>[0]) => {
        enqueued.push(input.idempotencyKey ?? "");
        return backgroundJob(input.kind, input.payload);
      },
      markBackgroundJobScheduleEnqueued: async () => undefined
    } as unknown as ApiTenantDataSource;

    await expect(enqueueDueBackgroundJobSchedules({
      dataSource,
      now: new Date("2026-05-27T00:00:01.000Z")
    })).resolves.toEqual({ enqueued: 1 });
    expect(enqueued).toEqual(["digest:daily:2026-05-27T00:00:00.000Z"]);
  });
});

function backgroundJob(
  kind: BackgroundJobRun["kind"],
  payload: Record<string, unknown> = {}
): BackgroundJobRun {
  const now = new Date("2026-05-27T00:00:00.000Z");
  return {
    id: "background-job-test",
    tenantId: "tenant-alpha",
    kind,
    status: "running",
    priority: 0,
    payload,
    idempotencyKey: null,
    attempt: 1,
    maxAttempts: 5,
    runAfter: now,
    lockedBy: "worker-test",
    lockedAt: now,
    startedAt: now,
    finishedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now
  };
}
