import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  nextBackgroundJobFailureState,
  type BackgroundJobEvent,
  type BackgroundJobEventType,
  type BackgroundJobKind,
  type BackgroundJobRun,
  type BackgroundJobSchedule,
  type BackgroundJobStatus,
  type TenantId
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  backgroundJobEvents,
  backgroundJobRuns,
  backgroundJobSchedules,
  fileAssets
} from "./schema";
import type { FileAssetRecord } from "./attachmentRepository";

const DEFAULT_BACKGROUND_JOB_LEASE_TIMEOUT_MS = 15 * 60_000;
const BACKGROUND_JOB_LEASE_EXPIRED_ERROR = "background_job_lease_expired";

export type BackgroundJobRunInput = {
  id: string;
  tenantId: TenantId;
  kind: BackgroundJobKind;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  priority?: number;
  maxAttempts?: number;
  runAfter?: Date;
};

export type BackgroundJobScheduleInput = {
  id: string;
  tenantId: TenantId;
  kind: BackgroundJobKind;
  scheduleKey: string;
  payload: Record<string, unknown>;
  intervalSeconds: number;
  enabled: boolean;
  nextRunAt: Date;
};

export type BackgroundJobRepository = {
  enqueueBackgroundJob(input: BackgroundJobRunInput): Promise<BackgroundJobRun>;
  claimNextBackgroundJob(input: {
    workerId: string;
    now: Date;
    kinds?: BackgroundJobKind[];
    leaseTimeoutMs?: number;
  }): Promise<BackgroundJobRun | undefined>;
  completeBackgroundJob(input: {
    tenantId: TenantId;
    jobId: string;
    finishedAt: Date;
    workerId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BackgroundJobRun | undefined>;
  failBackgroundJob(input: {
    tenantId: TenantId;
    jobId: string;
    failedAt: Date;
    error: string;
    workerId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BackgroundJobRun | undefined>;
  listBackgroundJobs(input: {
    tenantId: TenantId;
    status?: BackgroundJobStatus | null;
    limit: number;
  }): Promise<BackgroundJobRun[]>;
  listBackgroundJobEvents(input: {
    tenantId: TenantId;
    jobId: string;
    limit: number;
  }): Promise<BackgroundJobEvent[]>;
  upsertBackgroundJobSchedule(input: BackgroundJobScheduleInput): Promise<BackgroundJobSchedule>;
  listDueBackgroundJobSchedules(input: {
    now: Date;
    limit: number;
  }): Promise<BackgroundJobSchedule[]>;
  markBackgroundJobScheduleEnqueued(input: {
    tenantId: TenantId;
    scheduleId: string;
    enqueuedAt: Date;
  }): Promise<BackgroundJobSchedule | undefined>;
  listArchivedFileAssetsForCleanup(input: {
    tenantId: TenantId;
    archivedBefore: Date;
    limit: number;
  }): Promise<FileAssetRecord[]>;
  markFileAssetPurged(input: {
    tenantId: TenantId;
    assetId: string;
    purgedAt: Date;
  }): Promise<FileAssetRecord | undefined>;
};

export function createBackgroundJobRepository(db: KissPmDatabase): BackgroundJobRepository {
  async function recordEvent(input: {
    tenantId: TenantId;
    jobId: string;
    eventType: BackgroundJobEventType;
    message: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }) {
    await db.insert(backgroundJobEvents).values({
      id: `background-job-event-${randomUUID()}`,
      tenantId: input.tenantId,
      jobId: input.jobId,
      eventType: input.eventType,
      message: input.message,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt
    });
  }

  return {
    async enqueueBackgroundJob(input) {
      const now = new Date();
      let insert = db
        .insert(backgroundJobRuns)
        .values({
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
          createdAt: now,
          updatedAt: now
        })
        .$dynamic();
      if (input.idempotencyKey) {
        insert = insert.onConflictDoNothing({
          target: [backgroundJobRuns.tenantId, backgroundJobRuns.idempotencyKey]
        });
      }
      const [row] = await insert.returning();
      if (!row && input.idempotencyKey) {
        const existing = await findJobByIdempotencyKey(input.tenantId, input.idempotencyKey);
        if (existing) return mapBackgroundJobRun(existing);
      }
      if (!row) throw new Error("Background job insert returned no row");
      await recordEvent({
        tenantId: input.tenantId,
        jobId: input.id,
        eventType: "enqueued",
        message: "Job enqueued",
        createdAt: now
      });
      return mapBackgroundJobRun(row);
    },
    async claimNextBackgroundJob(input) {
      const recoveryInput: {
        now: Date;
        kinds?: BackgroundJobKind[];
        leaseTimeoutMs: number;
      } = {
        now: input.now,
        leaseTimeoutMs: input.leaseTimeoutMs ?? DEFAULT_BACKGROUND_JOB_LEASE_TIMEOUT_MS
      };
      if (input.kinds) recoveryInput.kinds = input.kinds;
      await recoverExpiredBackgroundJobLeases(recoveryInput);
      const filters = [
        eq(backgroundJobRuns.status, "queued"),
        lte(backgroundJobRuns.runAfter, input.now)
      ];
      if (input.kinds?.length) {
        filters.push(inArray(backgroundJobRuns.kind, input.kinds));
      }
      const [candidate] = await db
        .select()
        .from(backgroundJobRuns)
        .where(and(...filters))
        .orderBy(
          desc(backgroundJobRuns.priority),
          asc(backgroundJobRuns.runAfter),
          asc(backgroundJobRuns.createdAt),
          asc(backgroundJobRuns.id)
        )
        .limit(1);
      if (!candidate) return undefined;

      const [row] = await db
        .update(backgroundJobRuns)
        .set({
          status: "running",
          attempt: candidate.attempt + 1,
          lockedBy: input.workerId,
          lockedAt: input.now,
          startedAt: input.now,
          updatedAt: input.now,
          lastError: null
        })
        .where(
          and(
            eq(backgroundJobRuns.tenantId, candidate.tenantId),
            eq(backgroundJobRuns.id, candidate.id),
            eq(backgroundJobRuns.status, "queued")
          )
        )
        .returning();
      if (!row) return undefined;
      await recordEvent({
        tenantId: row.tenantId,
        jobId: row.id,
        eventType: "claimed",
        message: "Job claimed",
        metadata: { workerId: input.workerId, attempt: row.attempt },
        createdAt: input.now
      });
      return mapBackgroundJobRun(row);
    },
    async completeBackgroundJob(input) {
      const filters = [
        eq(backgroundJobRuns.tenantId, input.tenantId),
        eq(backgroundJobRuns.id, input.jobId),
        eq(backgroundJobRuns.status, "running")
      ];
      if (input.workerId) filters.push(eq(backgroundJobRuns.lockedBy, input.workerId));
      const [row] = await db
        .update(backgroundJobRuns)
        .set({
          status: "succeeded",
          finishedAt: input.finishedAt,
          lockedBy: null,
          lockedAt: null,
          updatedAt: input.finishedAt,
          lastError: null
        })
        .where(and(...filters))
        .returning();
      if (!row) return undefined;
      await recordEvent({
        tenantId: input.tenantId,
        jobId: input.jobId,
        eventType: "succeeded",
        message: input.message ?? "Job succeeded",
        ...(input.metadata ? { metadata: input.metadata } : {}),
        createdAt: input.finishedAt
      });
      return mapBackgroundJobRun(row);
    },
    async failBackgroundJob(input) {
      const filters = [
        eq(backgroundJobRuns.tenantId, input.tenantId),
        eq(backgroundJobRuns.id, input.jobId),
        eq(backgroundJobRuns.status, "running")
      ];
      if (input.workerId) filters.push(eq(backgroundJobRuns.lockedBy, input.workerId));
      const [current] = await db
        .select()
        .from(backgroundJobRuns)
        .where(and(...filters))
        .limit(1);
      if (!current) return undefined;
      const next = nextBackgroundJobFailureState({
        attempt: current.attempt,
        maxAttempts: current.maxAttempts,
        failedAt: input.failedAt
      });
      const [row] = await db
        .update(backgroundJobRuns)
        .set({
          status: next.status,
          runAfter: next.runAfter,
          lockedBy: null,
          lockedAt: null,
          finishedAt: next.status === "dead" ? input.failedAt : null,
          updatedAt: input.failedAt,
          lastError: input.error
        })
        .where(and(...filters))
        .returning();
      if (!row) return undefined;
      await recordEvent({
        tenantId: input.tenantId,
        jobId: input.jobId,
        eventType: next.status === "dead" ? "dead" : "retry_scheduled",
        message: input.error,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        createdAt: input.failedAt
      });
      return mapBackgroundJobRun(row);
    },
    async listBackgroundJobs(input) {
      const filters = [eq(backgroundJobRuns.tenantId, input.tenantId)];
      if (input.status) filters.push(eq(backgroundJobRuns.status, input.status));
      const rows = await db
        .select()
        .from(backgroundJobRuns)
        .where(and(...filters))
        .orderBy(desc(backgroundJobRuns.createdAt), desc(backgroundJobRuns.id))
        .limit(input.limit);
      return rows.map(mapBackgroundJobRun);
    },
    async listBackgroundJobEvents(input) {
      const rows = await db
        .select()
        .from(backgroundJobEvents)
        .where(
          and(
            eq(backgroundJobEvents.tenantId, input.tenantId),
            eq(backgroundJobEvents.jobId, input.jobId)
          )
        )
        .orderBy(desc(backgroundJobEvents.createdAt), desc(backgroundJobEvents.id))
        .limit(input.limit);
      return rows.map(mapBackgroundJobEvent);
    },
    async upsertBackgroundJobSchedule(input) {
      const now = new Date();
      const [row] = await db
        .insert(backgroundJobSchedules)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          kind: input.kind,
          scheduleKey: input.scheduleKey,
          payload: input.payload,
          intervalSeconds: input.intervalSeconds,
          enabled: input.enabled,
          nextRunAt: input.nextRunAt,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: [backgroundJobSchedules.tenantId, backgroundJobSchedules.scheduleKey],
          set: {
            kind: input.kind,
            payload: input.payload,
            intervalSeconds: input.intervalSeconds,
            enabled: input.enabled,
            nextRunAt: input.nextRunAt,
            updatedAt: now
          }
        })
        .returning();
      if (!row) throw new Error("Background job schedule upsert returned no row");
      return mapBackgroundJobSchedule(row);
    },
    async listDueBackgroundJobSchedules(input) {
      const rows = await db
        .select()
        .from(backgroundJobSchedules)
        .where(
          and(
            eq(backgroundJobSchedules.enabled, true),
            lte(backgroundJobSchedules.nextRunAt, input.now)
          )
        )
        .orderBy(asc(backgroundJobSchedules.nextRunAt), asc(backgroundJobSchedules.id))
        .limit(input.limit);
      return rows.map(mapBackgroundJobSchedule);
    },
    async markBackgroundJobScheduleEnqueued(input) {
      const [schedule] = await db
        .select()
        .from(backgroundJobSchedules)
        .where(
          and(
            eq(backgroundJobSchedules.tenantId, input.tenantId),
            eq(backgroundJobSchedules.id, input.scheduleId)
          )
        )
        .limit(1);
      if (!schedule) return undefined;
      const nextRunAt = new Date(input.enqueuedAt.getTime() + schedule.intervalSeconds * 1000);
      const [row] = await db
        .update(backgroundJobSchedules)
        .set({
          lastEnqueuedAt: input.enqueuedAt,
          nextRunAt,
          updatedAt: input.enqueuedAt
        })
        .where(
          and(
            eq(backgroundJobSchedules.tenantId, input.tenantId),
            eq(backgroundJobSchedules.id, input.scheduleId)
          )
        )
        .returning();
      return row ? mapBackgroundJobSchedule(row) : undefined;
    },
    async listArchivedFileAssetsForCleanup(input) {
      const rows = await db
        .select()
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.tenantId, input.tenantId),
            eq(fileAssets.status, "archived"),
            lte(fileAssets.archivedAt, input.archivedBefore),
            isNull(fileAssets.purgedAt)
          )
        )
        .orderBy(asc(fileAssets.archivedAt), asc(fileAssets.id))
        .limit(input.limit);
      return rows.map(mapFileAssetForJobs);
    },
    async markFileAssetPurged(input) {
      const [row] = await db
        .update(fileAssets)
        .set({ purgedAt: input.purgedAt })
        .where(
          and(
            eq(fileAssets.tenantId, input.tenantId),
            eq(fileAssets.id, input.assetId),
            isNull(fileAssets.purgedAt),
            or(eq(fileAssets.status, "archived"), eq(fileAssets.status, "failed"))
          )
        )
        .returning();
      return row ? mapFileAssetForJobs(row) : undefined;
    }
  };

  async function findJobByIdempotencyKey(tenantId: TenantId, idempotencyKey: string) {
    const [existing] = await db
      .select()
      .from(backgroundJobRuns)
      .where(
        and(
          eq(backgroundJobRuns.tenantId, tenantId),
          eq(backgroundJobRuns.idempotencyKey, idempotencyKey)
        )
      )
      .limit(1);
    return existing;
  }

  async function recoverExpiredBackgroundJobLeases(input: {
    now: Date;
    kinds?: BackgroundJobKind[];
    leaseTimeoutMs: number;
  }) {
    const staleBefore = new Date(input.now.getTime() - input.leaseTimeoutMs);
    const filters = [
      eq(backgroundJobRuns.status, "running"),
      lte(backgroundJobRuns.lockedAt, staleBefore)
    ];
    if (input.kinds?.length) filters.push(inArray(backgroundJobRuns.kind, input.kinds));
    const staleRows = await db
      .select()
      .from(backgroundJobRuns)
      .where(and(...filters))
      .orderBy(asc(backgroundJobRuns.lockedAt), asc(backgroundJobRuns.id));

    for (const staleRow of staleRows) {
      if (!staleRow.lockedAt) continue;
      const next = nextBackgroundJobFailureState({
        attempt: staleRow.attempt,
        maxAttempts: staleRow.maxAttempts,
        failedAt: input.now
      });
      const [row] = await db
        .update(backgroundJobRuns)
        .set({
          status: next.status,
          runAfter: next.runAfter,
          lockedBy: null,
          lockedAt: null,
          finishedAt: next.status === "dead" ? input.now : null,
          updatedAt: input.now,
          lastError: BACKGROUND_JOB_LEASE_EXPIRED_ERROR
        })
        .where(
          and(
            eq(backgroundJobRuns.tenantId, staleRow.tenantId),
            eq(backgroundJobRuns.id, staleRow.id),
            eq(backgroundJobRuns.status, "running"),
            eq(backgroundJobRuns.lockedAt, staleRow.lockedAt)
          )
        )
        .returning();
      if (!row) continue;
      await recordEvent({
        tenantId: row.tenantId,
        jobId: row.id,
        eventType: next.status === "dead" ? "dead" : "retry_scheduled",
        message: BACKGROUND_JOB_LEASE_EXPIRED_ERROR,
        metadata: {
          attempt: staleRow.attempt,
          leaseTimeoutMs: input.leaseTimeoutMs,
          previousWorkerId: staleRow.lockedBy
        },
        createdAt: input.now
      });
    }
  }
}

function mapBackgroundJobRun(row: typeof backgroundJobRuns.$inferSelect): BackgroundJobRun {
  return {
    id: row.id,
    tenantId: row.tenantId,
    kind: row.kind as BackgroundJobKind,
    status: row.status as BackgroundJobStatus,
    priority: row.priority,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    runAfter: row.runAfter,
    lockedBy: row.lockedBy,
    lockedAt: row.lockedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapBackgroundJobSchedule(
  row: typeof backgroundJobSchedules.$inferSelect
): BackgroundJobSchedule {
  return {
    id: row.id,
    tenantId: row.tenantId,
    kind: row.kind as BackgroundJobKind,
    scheduleKey: row.scheduleKey,
    payload: row.payload,
    intervalSeconds: row.intervalSeconds,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt,
    lastEnqueuedAt: row.lastEnqueuedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapBackgroundJobEvent(row: typeof backgroundJobEvents.$inferSelect): BackgroundJobEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    jobId: row.jobId,
    eventType: row.eventType as BackgroundJobEventType,
    message: row.message,
    metadata: row.metadata,
    createdAt: row.createdAt
  };
}

function mapFileAssetForJobs(row: typeof fileAssets.$inferSelect): FileAssetRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider as FileAssetRecord["provider"],
    storageKey: row.storageKey,
    originalName: row.originalName,
    safeDisplayName: row.safeDisplayName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksumSha256: row.checksumSha256,
    status: row.status as FileAssetRecord["status"],
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
    purgedAt: row.purgedAt
  };
}
