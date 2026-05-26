export const backgroundJobKinds = [
  "storage.asset_cleanup",
  "notification.dispatch",
  "connector.sync",
  "search.projection_rebuild",
  "capacity.cache_warmup"
] as const;

export type BackgroundJobKind = (typeof backgroundJobKinds)[number];

export const backgroundJobStatuses = [
  "queued",
  "running",
  "succeeded",
  "dead",
  "cancelled"
] as const;

export type BackgroundJobStatus = (typeof backgroundJobStatuses)[number];

export const backgroundJobEventTypes = [
  "enqueued",
  "claimed",
  "succeeded",
  "failed",
  "retry_scheduled",
  "dead",
  "cancelled"
] as const;

export type BackgroundJobEventType = (typeof backgroundJobEventTypes)[number];

export type BackgroundJobRun = {
  id: string;
  tenantId: string;
  kind: BackgroundJobKind;
  status: BackgroundJobStatus;
  priority: number;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
  attempt: number;
  maxAttempts: number;
  runAfter: Date;
  lockedBy: string | null;
  lockedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BackgroundJobSchedule = {
  id: string;
  tenantId: string;
  kind: BackgroundJobKind;
  scheduleKey: string;
  payload: Record<string, unknown>;
  intervalSeconds: number;
  enabled: boolean;
  nextRunAt: Date;
  lastEnqueuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BackgroundJobEvent = {
  id: string;
  tenantId: string;
  jobId: string;
  eventType: BackgroundJobEventType;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export function parseBackgroundJobKind(value: unknown): {
  ok: true;
  value: BackgroundJobKind;
} | { ok: false; error: "background_job_kind_invalid" } {
  return typeof value === "string" && backgroundJobKinds.includes(value as BackgroundJobKind)
    ? { ok: true, value: value as BackgroundJobKind }
    : { ok: false, error: "background_job_kind_invalid" };
}

export function parseBackgroundJobStatus(value: unknown): {
  ok: true;
  value: BackgroundJobStatus;
} | { ok: false; error: "background_job_status_invalid" } {
  return typeof value === "string" && backgroundJobStatuses.includes(value as BackgroundJobStatus)
    ? { ok: true, value: value as BackgroundJobStatus }
    : { ok: false, error: "background_job_status_invalid" };
}

export function normalizeBackgroundJobPriority(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 0;
  return Math.max(-100, Math.min(100, value));
}

export function normalizeBackgroundJobMaxAttempts(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 5;
  return Math.max(1, Math.min(25, value));
}

export function normalizeBackgroundJobPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function computeBackgroundJobRetryDelayMs(
  attempt: number,
  input: { baseDelayMs?: number; maxDelayMs?: number } = {}
): number {
  const safeAttempt = Math.max(1, Math.min(25, attempt));
  const baseDelayMs = input.baseDelayMs ?? 60_000;
  const maxDelayMs = input.maxDelayMs ?? 3_600_000;
  return Math.min(maxDelayMs, baseDelayMs * 2 ** (safeAttempt - 1));
}

export function nextBackgroundJobFailureState(input: {
  attempt: number;
  maxAttempts: number;
  failedAt: Date;
}): { status: "queued"; runAfter: Date } | { status: "dead"; runAfter: Date } {
  if (input.attempt >= input.maxAttempts) {
    return { status: "dead", runAfter: input.failedAt };
  }
  return {
    status: "queued",
    runAfter: new Date(
      input.failedAt.getTime() + computeBackgroundJobRetryDelayMs(input.attempt)
    )
  };
}
