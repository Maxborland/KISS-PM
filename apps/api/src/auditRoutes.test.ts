import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";

import type { ApiTenantDataSource } from "./apiTypes";
import { createApp } from "./app";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const EVENT = {
  id: "agent-action-42",
  tenantId: "tenant-1",
  actorUserId: "user-audit",
  actionType: "agent.comment_task.applied",
  sourceSurfaceId: null,
  sourceWorkflow: "agent",
  sourceEntity: { type: "Task", id: "task-a" },
  input: {},
  beforeState: null,
  afterState: null,
  permissionResult: { allowed: true },
  executionResult: { status: "succeeded" },
  correlationId: "agent-execute-1",
  createdAt: new Date("2026-07-18T10:00:00.000Z")
};

function createHarness(options: { permissions?: AccessProfile["permissions"]; withGetById?: boolean } = {}) {
  const permissions = options.permissions ?? ["tenant.audit_events.read"];
  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() { return []; },
    async findUserById(userId) {
      return userId === "user-audit" ? { id: "user-audit", tenantId: "tenant-1", name: "Аудитор", accessProfileId: "p" } : undefined;
    },
    async findTenantById(tenantId) { return tenantId === "tenant-1" ? { id: tenantId, name: "T" } : undefined; },
    async findAccessProfileById() { return { id: "p", permissions }; },
    async listWorkspaceUsers() { return []; },
    async findSessionByTokenHash() {
      return { id: "s", tenantId: "tenant-1", userId: "user-audit", tokenHash: "ignored", expiresAt: new Date("2099-01-01T00:00:00.000Z") };
    },
    ...(options.withGetById === false ? {} : {
      async getAuditEventById(_tenantId, auditEventId) {
        return auditEventId === EVENT.id ? EVENT : undefined;
      }
    })
  };
  return createApp({ dataSource: dataSource as ApiTenantDataSource });
}

describe("GET /api/tenant/current/audit-events/:auditEventId", () => {
  it("отдаёт событие по id с ISO-датой (адресуемая квитанция не зависит от окна ленты)", async () => {
    const app = createHarness();
    const response = await app.request(`/api/tenant/current/audit-events/${EVENT.id}`, { headers: { cookie: COOKIE } });
    expect(response.status).toBe(200);
    const payload = await response.json() as { auditEvent: { id: string; createdAt: string; correlationId: string } };
    expect(payload.auditEvent.id).toBe(EVENT.id);
    expect(payload.auditEvent.createdAt).toBe("2026-07-18T10:00:00.000Z");
    expect(payload.auditEvent.correlationId).toBe("agent-execute-1");
  });

  it("404 для неизвестного id, 401 без сессии, 400 для пустого/сверхдлинного id", async () => {
    const app = createHarness();
    const missing = await app.request("/api/tenant/current/audit-events/audit-ghost", { headers: { cookie: COOKIE } });
    expect(missing.status).toBe(404);

    const anonymous = await app.request(`/api/tenant/current/audit-events/${EVENT.id}`);
    expect(anonymous.status).toBe(401);

    const oversized = await app.request(`/api/tenant/current/audit-events/${"x".repeat(200)}`, { headers: { cookie: COOKIE } });
    expect(oversized.status).toBe(400);
  });

  it("403 без tenant.audit_events.read (RBAC как у ленты)", async () => {
    const app = createHarness({ permissions: ["tenant.projects.read"] });
    const response = await app.request(`/api/tenant/current/audit-events/${EVENT.id}`, { headers: { cookie: COOKIE } });
    expect(response.status).toBe(403);
  });

  it("501 в partial data-source режиме без getAuditEventById", async () => {
    const app = createHarness({ withGetById: false });
    const response = await app.request(`/api/tenant/current/audit-events/${EVENT.id}`, { headers: { cookie: COOKIE } });
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
  });
});

type SeedEvent = {
  id: string;
  actorUserId: string;
  actionType: string;
  status: string;
  createdAt: string;
};

// Лента из нескольких актёров/типов/дат — покрывает серверные фильтры и keyset за окном ленты.
const FEED: SeedEvent[] = [
  { id: "ev-6", actorUserId: "user-anna", actionType: "control_surface.published", status: "succeeded", createdAt: "2026-07-18T06:00:00.000Z" },
  { id: "ev-5", actorUserId: "user-boris", actionType: "workspace.user.deactivated", status: "denied", createdAt: "2026-07-17T06:00:00.000Z" },
  { id: "ev-4", actorUserId: "user-anna", actionType: "control_surface.published", status: "failed", createdAt: "2026-07-16T06:00:00.000Z" },
  { id: "ev-3", actorUserId: "user-anna", actionType: "access_role.created", status: "succeeded", createdAt: "2026-07-15T06:00:00.000Z" },
  { id: "ev-2", actorUserId: "user-boris", actionType: "control_surface.published", status: "succeeded", createdAt: "2026-07-14T06:00:00.000Z" },
  { id: "ev-1", actorUserId: "user-anna", actionType: "workspace.user.created", status: "succeeded", createdAt: "2026-07-13T06:00:00.000Z" }
];

// Реальная фильтрующая/keyset реализация датасорса — зеркало inMemory/persistence-семантики.
function createFeedHarness() {
  const rows = FEED.map((seed) => ({
    id: seed.id,
    tenantId: "tenant-1",
    actorUserId: seed.actorUserId,
    actionType: seed.actionType,
    sourceSurfaceId: null,
    sourceWorkflow: "admin",
    sourceEntity: { type: "ControlSurface", id: "s" },
    input: {},
    beforeState: null,
    afterState: null,
    permissionResult: { allowed: true },
    executionResult: { status: seed.status },
    correlationId: `corr-${seed.id}`,
    createdAt: new Date(seed.createdAt)
  }));
  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() { return []; },
    async findUserById() { return { id: "user-anna", tenantId: "tenant-1", name: "Анна", accessProfileId: "p" }; },
    async findTenantById(tenantId) { return tenantId === "tenant-1" ? { id: tenantId, name: "T" } : undefined; },
    async findAccessProfileById() { return { id: "p", permissions: ["tenant.audit_events.read"] }; },
    async listWorkspaceUsers() { return []; },
    async findSessionByTokenHash() {
      return { id: "s", tenantId: "tenant-1", userId: "user-anna", tokenHash: "ignored", expiresAt: new Date("2099-01-01T00:00:00.000Z") };
    },
    async listAuditEventsByTenantId(tenantId, options) {
      const status = (event: (typeof rows)[number]): string | undefined => {
        const raw = (event.executionResult as { status?: unknown }).status;
        return typeof raw === "string" ? raw : undefined;
      };
      return rows
        .filter((event) => event.tenantId === tenantId)
        .filter((event) => !options?.actorUserId || event.actorUserId === options.actorUserId)
        .filter((event) => !options?.actionType || event.actionType === options.actionType)
        .filter((event) => !options?.executionResult || status(event) === options.executionResult)
        .filter((event) => !options?.fromDate || event.createdAt.getTime() >= options.fromDate.getTime())
        .filter((event) => !options?.toDate || event.createdAt.getTime() <= options.toDate.getTime())
        .sort((a, b) =>
          a.createdAt.getTime() === b.createdAt.getTime()
            ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
            : b.createdAt.getTime() - a.createdAt.getTime()
        )
        .filter((event) => {
          if (!options?.cursor) return true;
          const cur = options.cursor.createdAt.getTime();
          const at = event.createdAt.getTime();
          return at !== cur ? at < cur : event.id < options.cursor.id;
        })
        .slice(0, options?.limit);
    }
  };
  return createApp({ dataSource: dataSource as ApiTenantDataSource });
}

async function listAudit(app: ReturnType<typeof createFeedHarness>, query: string) {
  const response = await app.request(`/api/tenant/current/audit-events${query}`, { headers: { cookie: COOKIE } });
  const payload = (await response.json()) as { auditEvents: Array<{ id: string; createdAt: string }>; nextCursor: string | null };
  return { status: response.status, payload };
}

describe("GET /api/tenant/current/audit-events (серверные фильтры + keyset)", () => {
  it("фильтрует по actorUserId за пределами окна ленты", async () => {
    const app = createFeedHarness();
    const { status, payload } = await listAudit(app, "?actorUserId=user-boris");
    expect(status).toBe(200);
    expect(payload.auditEvents.map((event) => event.id)).toEqual(["ev-5", "ev-2"]);
  });

  it("фильтрует по actionType и executionResult", async () => {
    const app = createFeedHarness();
    const byType = await listAudit(app, "?actionType=control_surface.published");
    expect(byType.payload.auditEvents.map((event) => event.id)).toEqual(["ev-6", "ev-4", "ev-2"]);
    const byResult = await listAudit(app, "?actionType=control_surface.published&executionResult=succeeded");
    expect(byResult.payload.auditEvents.map((event) => event.id)).toEqual(["ev-6", "ev-2"]);
  });

  it("фильтрует по диапазону дат fromDate..toDate (включительно)", async () => {
    const app = createFeedHarness();
    const { payload } = await listAudit(app, "?fromDate=2026-07-15T00:00:00.000Z&toDate=2026-07-17T23:59:59.999Z");
    expect(payload.auditEvents.map((event) => event.id)).toEqual(["ev-5", "ev-4", "ev-3"]);
  });

  it("keyset-пагинация: nextCursor ведёт к следующей странице без пропусков и дублей", async () => {
    const app = createFeedHarness();
    const first = await listAudit(app, "?limit=2");
    expect(first.payload.auditEvents.map((event) => event.id)).toEqual(["ev-6", "ev-5"]);
    expect(first.payload.nextCursor).toBeTruthy();

    const second = await listAudit(app, `?limit=2&cursor=${encodeURIComponent(first.payload.nextCursor!)}`);
    expect(second.payload.auditEvents.map((event) => event.id)).toEqual(["ev-4", "ev-3"]);
    expect(second.payload.nextCursor).toBeTruthy();

    const third = await listAudit(app, `?limit=2&cursor=${encodeURIComponent(second.payload.nextCursor!)}`);
    expect(third.payload.auditEvents.map((event) => event.id)).toEqual(["ev-2", "ev-1"]);
    // Последняя страница ровно заполнила окно — но следующей нет.
    expect(third.payload.nextCursor).toBeNull();
  });

  it("400 на некорректные фильтры и курсор", async () => {
    const app = createFeedHarness();
    const badActor = await app.request(`/api/tenant/current/audit-events?actorUserId=${"x".repeat(200)}`, { headers: { cookie: COOKIE } });
    expect(badActor.status).toBe(400);
    await expect(badActor.json()).resolves.toEqual({ error: "invalid_audit_actor" });

    const badResult = await app.request("/api/tenant/current/audit-events?executionResult=Succeeded!", { headers: { cookie: COOKIE } });
    expect(badResult.status).toBe(400);
    await expect(badResult.json()).resolves.toEqual({ error: "invalid_audit_execution_result" });

    const badDate = await app.request("/api/tenant/current/audit-events?fromDate=not-a-date", { headers: { cookie: COOKIE } });
    expect(badDate.status).toBe(400);
    await expect(badDate.json()).resolves.toEqual({ error: "invalid_audit_from_date" });

    const badCursor = await app.request("/api/tenant/current/audit-events?cursor=%2E%2E%2E", { headers: { cookie: COOKIE } });
    expect(badCursor.status).toBe(400);
    await expect(badCursor.json()).resolves.toEqual({ error: "invalid_audit_cursor" });
  });
});
