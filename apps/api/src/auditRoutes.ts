import { canReadAuditEvents } from "@kiss-pm/access-control";
import type { AuditEventCursor } from "@kiss-pm/persistence";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import { parseProjectIdParam } from "./routeParamParsers";

const defaultAuditReadLimit = 100;
const maxAuditReadLimit = 100;

export function registerAuditRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const { dataSource, getActorProfile, getSessionActorFromHeaders } = deps;

  app.get("/api/tenant/current/audit-events", async (context) => {
    const projectId = parseAuditProjectFilter(context.req.query("projectId"));
    if (projectId === false) {
      return context.json({ error: "invalid_project_id" }, 400);
    }
    const limit = parseAuditLimit(context.req.query("limit"));
    if (limit === null) {
      return context.json({ error: "invalid_audit_limit" }, 400);
    }
    const actorUserId = parseAuditIdentifier(context.req.query("actorUserId"));
    if (actorUserId === false) {
      return context.json({ error: "invalid_audit_actor" }, 400);
    }
    const actionType = parseAuditIdentifier(context.req.query("actionType"));
    if (actionType === false) {
      return context.json({ error: "invalid_audit_action_type" }, 400);
    }
    const executionResult = parseAuditExecutionResult(context.req.query("executionResult"));
    if (executionResult === false) {
      return context.json({ error: "invalid_audit_execution_result" }, 400);
    }
    const fromDate = parseAuditDate(context.req.query("fromDate"));
    if (fromDate === false) {
      return context.json({ error: "invalid_audit_from_date" }, 400);
    }
    const toDate = parseAuditDate(context.req.query("toDate"));
    if (toDate === false) {
      return context.json({ error: "invalid_audit_to_date" }, 400);
    }
    const cursor = parseAuditCursor(context.req.query("cursor"));
    if (cursor === false) {
      return context.json({ error: "invalid_audit_cursor" }, 400);
    }

    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (!dataSource.listAuditEventsByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAuditEvents({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    // Просим на одну запись больше окна: превышение = есть следующая страница (nextCursor).
    const page = await dataSource.listAuditEventsByTenantId(actor.tenantId, {
      limit: limit + 1,
      projectId,
      actorUserId,
      actionType,
      executionResult,
      fromDate,
      toDate,
      cursor
    });

    const hasMore = page.length > limit;
    const windowEvents = hasMore ? page.slice(0, limit) : page;
    const last = windowEvents[windowEvents.length - 1];
    const nextCursor =
      hasMore && last ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id }) : null;

    return context.json({
      auditEvents: windowEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString()
      })),
      nextCursor
    });
  });

  // Точечная выборка события: адресуемые квитанции агента (auditEventId/correlationId)
  // не должны зависеть от окна limit ленты. Тот же RBAC, что и у списка.
  app.get("/api/tenant/current/audit-events/:auditEventId", async (context) => {
    const auditEventId = context.req.param("auditEventId").trim();
    if (auditEventId.length === 0 || auditEventId.length > 128) {
      return context.json({ error: "invalid_audit_event_id" }, 400);
    }

    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }
    if (!dataSource.getAuditEventById) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAuditEvents({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const event = await dataSource.getAuditEventById(actor.tenantId, auditEventId);
    if (!event) return context.json({ error: "audit_event_not_found" }, 404);
    return context.json({
      auditEvent: { ...event, createdAt: event.createdAt.toISOString() }
    });
  });
}

function parseAuditProjectFilter(value: string | undefined): string | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = parseProjectIdParam(normalized);
  return parsed.ok ? parsed.value : false;
}

function parseAuditLimit(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return defaultAuditReadLimit;
  if (!/^(0|[1-9]\d*)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxAuditReadLimit) {
    return null;
  }
  return parsed;
}

// Строковый фильтр (actorUserId / actionType): trim, 1..128, без управляющих символов.
// undefined/пусто → фильтр не задан (null). Некорректная строка → false (400).
function parseAuditIdentifier(value: string | undefined): string | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.length > 128) return false;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return normalized;
}

// Статус исполнения (executionResult ->> 'status'): нижний регистр [a-z_], 1..40.
function parseAuditExecutionResult(value: string | undefined): string | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (!/^[a-z_]{1,40}$/.test(normalized)) return false;
  return normalized;
}

// Дата фильтра (ISO-8601 или YYYY-MM-DD). Пусто → не задана (null); неразбираемая → false.
function parseAuditDate(value: string | undefined): Date | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed;
}

// Курсор keyset: base64url(`${createdAtISO}|${id}`). Пусто → нет курсора; битый → false.
function parseAuditCursor(value: string | undefined): AuditEventCursor | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(normalized, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf("|");
  if (separator <= 0) return false;
  const createdAtIso = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);
  if (id.length === 0 || id.length > 128) return false;
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime())) return false;
  return { createdAt, id };
}

function encodeAuditCursor(cursor: AuditEventCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`, "utf8").toString(
    "base64url"
  );
}
