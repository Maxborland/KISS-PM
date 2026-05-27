import { backgroundJobKinds, type BackgroundJobKind, type BackgroundJobRun } from "@kiss-pm/domain";
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

const GENERIC_BACKGROUND_JOB_ERROR = "background_job_failed";
const SAFE_BACKGROUND_JOB_ERROR_CODES = new Set([
  GENERIC_BACKGROUND_JOB_ERROR,
  "background_jobs_not_configured",
  "capacity_warmup_failed",
  "capacity_warmup_month_invalid",
  "storage_cleanup_not_configured"
]);

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

  const kinds = Object.keys(input.registry) as BackgroundJobKind[];
  if (kinds.length === 0) return { status: "idle" };

  const job = await input.dataSource.claimNextBackgroundJob({
    workerId: input.workerId,
    now,
    kinds
  });
  if (!job) return { status: "idle" };

  const handler = input.registry[job.kind];
  if (!handler) {
    const error = `background_job_handler_missing:${job.kind}`;
    await input.dataSource.failBackgroundJob({
      tenantId: job.tenantId,
      jobId: job.id,
      failedAt: now,
      error,
      workerId: input.workerId
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
      finishedAt: now,
      workerId: input.workerId
    };
    if (result?.message) completeInput.message = result.message;
    if (result?.metadata) completeInput.metadata = result.metadata;
    await input.dataSource.completeBackgroundJob(completeInput);
    return { status: "succeeded", job };
  } catch (error) {
    const message = sanitizeBackgroundJobError(error);
    await input.dataSource.failBackgroundJob({
      tenantId: job.tenantId,
      jobId: job.id,
      failedAt: now,
      error: message,
      workerId: input.workerId
    });
    return { status: "failed", job, error: message };
  }
}

export function sanitizeBackgroundJobError(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC_BACKGROUND_JOB_ERROR;
  const message = error.message.trim();
  if (SAFE_BACKGROUND_JOB_ERROR_CODES.has(message)) return message;
  const missingHandlerPrefix = "background_job_handler_missing:";
  if (message.startsWith(missingHandlerPrefix)) {
    const kind = message.slice(missingHandlerPrefix.length);
    if (backgroundJobKinds.includes(kind as BackgroundJobKind)) return message;
  }
  return GENERIC_BACKGROUND_JOB_ERROR;
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
