import type { BackgroundJobKind, BackgroundJobRun } from "@kiss-pm/domain";
import { randomUUID } from "node:crypto";

import type { ApiTenantDataSource } from "../apiTypes";
import type { StorageProvider } from "../storageProvider";

export type BackgroundJobHandlerResult = {
  message?: string;
  metadata?: Record<string, unknown>;
};

export type BackgroundJobHandler = (
  job: BackgroundJobRun,
  context: BackgroundJobHandlerContext
) => Promise<BackgroundJobHandlerResult | void>;

export type BackgroundJobHandlerContext = {
  dataSource: ApiTenantDataSource;
  storageProvider?: StorageProvider;
  now: Date;
};

export type BackgroundJobRegistry = Partial<Record<BackgroundJobKind, BackgroundJobHandler>>;

export async function runBackgroundJobWorkerTick(input: {
  dataSource: ApiTenantDataSource;
  registry: BackgroundJobRegistry;
  storageProvider?: StorageProvider;
  workerId: string;
  now?: Date;
}): Promise<
  | { status: "idle" }
  | { status: "succeeded"; job: BackgroundJobRun }
  | { status: "failed"; job: BackgroundJobRun; error: string }
> {
  const now = input.now ?? new Date();
  if (
    !input.dataSource.claimNextBackgroundJob ||
    !input.dataSource.completeBackgroundJob ||
    !input.dataSource.failBackgroundJob
  ) {
    throw new Error("background_jobs_not_configured");
  }

  const job = await input.dataSource.claimNextBackgroundJob({
    workerId: input.workerId,
    now,
    kinds: Object.keys(input.registry) as BackgroundJobKind[]
  });
  if (!job) return { status: "idle" };

  const handler = input.registry[job.kind];
  if (!handler) {
    const error = `background_job_handler_missing:${job.kind}`;
    await input.dataSource.failBackgroundJob({
      tenantId: job.tenantId,
      jobId: job.id,
      failedAt: now,
      error
    });
    return { status: "failed", job, error };
  }

  try {
    const context: BackgroundJobHandlerContext = {
      dataSource: input.dataSource,
      now
    };
    if (input.storageProvider) context.storageProvider = input.storageProvider;
    const result = await handler(job, context);
    const completeInput: Parameters<NonNullable<ApiTenantDataSource["completeBackgroundJob"]>>[0] = {
      tenantId: job.tenantId,
      jobId: job.id,
      finishedAt: now
    };
    if (result?.message) completeInput.message = result.message;
    if (result?.metadata) completeInput.metadata = result.metadata;
    await input.dataSource.completeBackgroundJob(completeInput);
    return { status: "succeeded", job };
  } catch (error) {
    const message = error instanceof Error ? error.message : "background_job_failed";
    await input.dataSource.failBackgroundJob({
      tenantId: job.tenantId,
      jobId: job.id,
      failedAt: now,
      error: message
    });
    return { status: "failed", job, error: message };
  }
}

export async function enqueueDueBackgroundJobSchedules(input: {
  dataSource: ApiTenantDataSource;
  now?: Date;
  limit?: number;
}): Promise<{ enqueued: number }> {
  const now = input.now ?? new Date();
  if (
    !input.dataSource.listDueBackgroundJobSchedules ||
    !input.dataSource.enqueueBackgroundJob ||
    !input.dataSource.markBackgroundJobScheduleEnqueued
  ) {
    throw new Error("background_jobs_not_configured");
  }

  const schedules = await input.dataSource.listDueBackgroundJobSchedules({
    now,
    limit: input.limit ?? 50
  });
  let enqueued = 0;
  for (const schedule of schedules) {
    await input.dataSource.enqueueBackgroundJob({
      id: `background-job-${randomUUID()}`,
      tenantId: schedule.tenantId,
      kind: schedule.kind,
      payload: schedule.payload,
      idempotencyKey: `${schedule.scheduleKey}:${schedule.nextRunAt.toISOString()}`,
      runAfter: now
    });
    await input.dataSource.markBackgroundJobScheduleEnqueued({
      tenantId: schedule.tenantId,
      scheduleId: schedule.id,
      enqueuedAt: now
    });
    enqueued += 1;
  }
  return { enqueued };
}
