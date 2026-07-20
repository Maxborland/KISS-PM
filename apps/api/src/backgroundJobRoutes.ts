import {
  canManageBackgroundJobs,
  canReadBackgroundJobs,
  type AccessProfile
} from "@kiss-pm/access-control";
import {
  normalizeBackgroundJobMaxAttempts,
  normalizeBackgroundJobPayload,
  normalizeBackgroundJobPriority,
  parseBackgroundJobKind,
  parseBackgroundJobStatus,
  type BackgroundJobKind,
  type TenantUser
} from "@kiss-pm/domain";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type { ApiRouteDeps } from "./routeTypes";
import { readLimitedJsonBody } from "./jsonBody";

type BackgroundJobRouteDeps = Pick<
  ApiRouteDeps,
  "dataSource" | "getActorProfile" | "getSessionActorFromHeaders"
>;

// Boundary-kinds без реализации (см. jobHandlers.ts): их «выполнение» ничего не
// делает, поэтому постановка в очередь честно отклоняется 501 not_implemented —
// вместо фиктивного успеха и вечно висящей queued-строки. Дефолтный сид
// расписаний (ensureDefaultBackgroundJobSchedules) эти kinds не засевает.
export const NOT_IMPLEMENTED_BACKGROUND_JOB_KINDS: ReadonlySet<BackgroundJobKind> = new Set([
  "connector.sync",
  "search.projection_rebuild",
  "calls.recording_compose"
]);

export function registerBackgroundJobRoutes(app: Hono, deps: BackgroundJobRouteDeps) {
  app.get("/api/workspace/background-jobs/runs", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const access = requireBackgroundJobAccess(actor, profile, "read");
    if (!access.allowed) return context.json({ error: access.reason }, 403);
    if (!deps.dataSource.listBackgroundJobs) {
      return context.json({ error: "background_jobs_not_configured" }, 501);
    }
    const status = parseOptionalStatus(context.req.query("status"));
    if (!status.ok) return context.json({ error: status.error }, 400);
    const limit = parseLimit(context.req.query("limit"));
    if (!limit.ok) return context.json({ error: limit.error }, 400);
    const runs = await deps.dataSource.listBackgroundJobs({
      tenantId: actor.tenantId,
      status: status.value,
      limit: limit.value
    });
    return context.json({ runs: runs.map(serializeJobRun) });
  });

  app.get("/api/workspace/background-jobs/runs/:runId/events", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const access = requireBackgroundJobAccess(actor, profile, "read");
    if (!access.allowed) return context.json({ error: access.reason }, 403);
    if (!deps.dataSource.listBackgroundJobEvents) {
      return context.json({ error: "background_jobs_not_configured" }, 501);
    }
    const runId = context.req.param("runId").trim();
    if (!/^background-job-[A-Za-z0-9._:-]+$/.test(runId)) {
      return context.json({ error: "background_job_id_invalid" }, 400);
    }
    const events = await deps.dataSource.listBackgroundJobEvents({
      tenantId: actor.tenantId,
      jobId: runId,
      limit: 100
    });
    return context.json({ events: events.map(serializeJobEvent) });
  });

  app.post("/api/workspace/background-jobs/runs", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const access = requireBackgroundJobAccess(actor, profile, "manage");
    if (!access.allowed) return context.json({ error: access.reason }, 403);
    if (!deps.dataSource.enqueueBackgroundJob) {
      return context.json({ error: "background_jobs_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseEnqueueBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (NOT_IMPLEMENTED_BACKGROUND_JOB_KINDS.has(parsed.value.kind)) {
      return context.json({ error: "background_job_kind_not_implemented" }, 501);
    }

    const job = await deps.dataSource.enqueueBackgroundJob({
      id: `background-job-${randomUUID()}`,
      tenantId: actor.tenantId,
      ...parsed.value
    });
    return context.json({ run: serializeJobRun(job) }, 201);
  });
}

function requireBackgroundJobAccess(
  actor: TenantUser,
  profile: AccessProfile,
  mode: "read" | "manage"
) {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  return mode === "read"
    ? canReadBackgroundJobs(input)
    : canManageBackgroundJobs(input);
}

function parseOptionalStatus(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return { ok: true as const, value: null };
  const parsed = parseBackgroundJobStatus(normalized);
  return parsed.ok ? parsed : { ok: false as const, error: parsed.error };
}

function parseLimit(value: string | undefined) {
  if (!value) return { ok: true as const, value: 50 };
  if (!/^[1-9][0-9]?$|^100$/.test(value)) {
    return { ok: false as const, error: "background_job_limit_invalid" };
  }
  return { ok: true as const, value: Number(value) };
}

function parseEnqueueBody(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const kind = parseBackgroundJobKind(record.kind);
  if (!kind.ok) return kind;
  return {
    ok: true as const,
    value: {
      kind: kind.value,
      payload: normalizeBackgroundJobPayload(record.payload),
      idempotencyKey: typeof record.idempotencyKey === "string" && record.idempotencyKey.trim()
        ? record.idempotencyKey.trim().slice(0, 200)
        : null,
      priority: normalizeBackgroundJobPriority(record.priority),
      maxAttempts: normalizeBackgroundJobMaxAttempts(record.maxAttempts)
    }
  };
}

function serializeJobRun(run: import("@kiss-pm/domain").BackgroundJobRun) {
  return {
    ...run,
    runAfter: run.runAfter.toISOString(),
    lockedAt: run.lockedAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}

function serializeJobEvent(event: import("@kiss-pm/domain").BackgroundJobEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}
