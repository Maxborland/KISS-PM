import type { BackgroundJobRun } from "@kiss-pm/domain";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import { createLocalStorageProvider } from "../storageProvider";
import {
  createSerializedBackgroundJobPoller,
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

  it("redacts raw handler errors before persistence", async () => {
    const job = backgroundJob("storage.asset_cleanup");
    let persistedError: string | undefined;
    const dataSource: ApiTenantDataSource = {
      claimNextBackgroundJob: async () => job,
      completeBackgroundJob: async () => ({ ...job, status: "succeeded" }),
      failBackgroundJob: async (input: Parameters<NonNullable<ApiTenantDataSource["failBackgroundJob"]>>[0]) => {
        persistedError = input.error;
        return { ...job, status: "queued", lastError: input.error };
      }
    } as unknown as ApiTenantDataSource;

    const result = await runBackgroundJobWorkerTick({
      dataSource,
      registry: {
        "storage.asset_cleanup": async () => {
          throw new Error("ENOENT C:\\storage\\tenant-alpha\\private-object-key");
        }
      },
      workerId: "worker-test",
      now: new Date("2026-05-27T00:00:00.000Z")
    });

    expect(result).toMatchObject({
      status: "failed",
      error: "background_job_failed"
    });
    expect(persistedError).toBe("background_job_failed");
  });

  it("uses completion time for terminal job timestamps", async () => {
    const startedAt = new Date("2026-05-27T00:00:00.000Z");
    const finishedAt = new Date("2026-05-27T00:05:00.000Z");
    const job = backgroundJob("notification.dispatch");
    let persistedFinishedAt: Date | undefined;
    const dataSource: ApiTenantDataSource = {
      claimNextBackgroundJob: async () => job,
      completeBackgroundJob: async (input: Parameters<NonNullable<ApiTenantDataSource["completeBackgroundJob"]>>[0]) => {
        persistedFinishedAt = input.finishedAt;
        return { ...job, status: "succeeded", finishedAt: input.finishedAt };
      },
      failBackgroundJob: async () => undefined
    } as unknown as ApiTenantDataSource;
    const clockValues = [startedAt, finishedAt];

    await expect(runBackgroundJobWorkerTick({
      dataSource,
      registry: {
        "notification.dispatch": async () => ({ message: "done" })
      },
      workerId: "worker-test",
      clock: () => clockValues.shift() ?? finishedAt
    })).resolves.toMatchObject({ status: "succeeded" });
    expect(persistedFinishedAt?.toISOString()).toBe("2026-05-27T00:05:00.000Z");
  });

  it("does not claim jobs when the worker registry is empty", async () => {
    let claimed = false;
    const dataSource: ApiTenantDataSource = {
      claimNextBackgroundJob: async () => {
        claimed = true;
        return backgroundJob("notification.dispatch");
      },
      completeBackgroundJob: async () => undefined,
      failBackgroundJob: async () => undefined
    } as unknown as ApiTenantDataSource;

    await expect(runBackgroundJobWorkerTick({
      dataSource,
      registry: {},
      workerId: "worker-test",
      now: new Date("2026-05-27T00:00:00.000Z")
    })).resolves.toEqual({ status: "idle" });
    expect(claimed).toBe(false);
  });

  it("serializes poller ticks so overlapping intervals are skipped", async () => {
    let releaseFirstTick!: () => void;
    let scheduleReads = 0;
    const dataSource: ApiTenantDataSource = {
      ...createIdleSchedulerDataSource(),
      listDueBackgroundJobSchedules: async () => {
        scheduleReads += 1;
        await new Promise<void>((resolve) => {
          releaseFirstTick = resolve;
        });
        return [];
      }
    } as ApiTenantDataSource;
    const poller = createSerializedBackgroundJobPoller({
      dataSource,
      registry: createDefaultBackgroundJobRegistry(),
      workerId: "worker-test"
    });

    const firstTick = poller();
    await Promise.resolve();
    await expect(poller()).resolves.toBe("skipped");
    releaseFirstTick();
    await expect(firstTick).resolves.toBe("ran");
    expect(scheduleReads).toBe(1);
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

function createIdleSchedulerDataSource(): ApiTenantDataSource {
  return {
    listDueBackgroundJobSchedules: async () => [],
    enqueueBackgroundJob: async (input: Parameters<NonNullable<ApiTenantDataSource["enqueueBackgroundJob"]>>[0]) =>
      backgroundJob(input.kind, input.payload),
    markBackgroundJobScheduleEnqueued: async () => undefined,
    claimNextBackgroundJob: async () => undefined,
    completeBackgroundJob: async () => undefined,
    failBackgroundJob: async () => undefined
  } as unknown as ApiTenantDataSource;
}

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
