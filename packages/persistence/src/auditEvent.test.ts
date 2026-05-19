import { describe, expect, it } from "vitest";

import { createAuditEventRecord } from "./index";

describe("audit event persistence record", () => {
  it("creates an audit event with the mandatory management-action trace fields", () => {
    const event = createAuditEventRecord({
      id: "audit-1",
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      actionType: "tenant.user.invited",
      sourceWorkflow: "phase_1_2_test",
      sourceEntity: {
        type: "TenantUser",
        id: "user-new"
      },
      input: {
        email: "new.user@example.test"
      },
      beforeState: null,
      afterState: {
        status: "invited"
      },
      permissionResult: {
        allowed: true,
        reason: "same_tenant_permission_granted"
      },
      executionResult: {
        status: "succeeded"
      },
      correlationId: "corr-1",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });

    expect(event).toMatchObject({
      id: "audit-1",
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      actionType: "tenant.user.invited",
      sourceWorkflow: "phase_1_2_test",
      sourceEntity: {
        type: "TenantUser",
        id: "user-new"
      },
      permissionResult: {
        allowed: true,
        reason: "same_tenant_permission_granted"
      },
      executionResult: {
        status: "succeeded"
      },
      correlationId: "corr-1"
    });
    expect(event.createdAt.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  it("rejects audit events missing required trace fields", () => {
    expect(() =>
      createAuditEventRecord({
        id: "audit-2",
        tenantId: "",
        actorUserId: "user-alpha-admin",
        actionType: "tenant.user.invited",
        sourceWorkflow: "phase_1_2_test",
        sourceEntity: {
          type: "TenantUser",
          id: "user-new"
        },
        input: {},
        beforeState: null,
        afterState: null,
        permissionResult: {
          allowed: true
        },
        executionResult: {
          status: "succeeded"
        },
        correlationId: "corr-2",
        createdAt: new Date("2026-05-18T00:00:00.000Z")
      })
    ).toThrow("tenantId");
  });
});
