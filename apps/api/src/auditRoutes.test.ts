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
