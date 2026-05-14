import { describe, expect, it } from "vitest";

import {
  createActorContext,
  createAuditEvent,
  createAuditTargetRef,
  DomainInvariantError
} from "./index";

describe("audit primitives", () => {
  it("creates a tenant-owned audit event with actor, target, result, timestamp, and correlation ID", () => {
    const actor = createActorContext({
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      correlationId: "corr-label-update-001"
    });
    const event = createAuditEvent({
      id: "audit-tenant-label-updated-001",
      actor,
      actionKey: "tenant_labels.update",
      target: createAuditTargetRef({
        entityType: "tenantLabel",
        entityId: "navigation.projects"
      }),
      result: "success",
      timestamp: "2026-05-14T14:10:00+07:00",
      details: {
        before: { label: "Проекты" },
        after: { label: "Проектный контур" },
        previousConfigurationVersion: 4,
        newConfigurationVersion: 5,
        changedLabel: {
          key: "navigation.projects",
          beforeLabel: "Проекты",
          afterLabel: "Проектный контур"
        }
      }
    });

    expect(event).toEqual({
      id: "audit-tenant-label-updated-001",
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      actionKey: "tenant_labels.update",
      target: {
        entityType: "tenantLabel",
        entityId: "navigation.projects"
      },
      result: "success",
      timestamp: "2026-05-14T14:10:00+07:00",
      correlationId: "corr-label-update-001",
      details: {
        before: { label: "Проекты" },
        after: { label: "Проектный контур" },
        previousConfigurationVersion: 4,
        newConfigurationVersion: 5,
        changedLabel: {
          key: "navigation.projects",
          beforeLabel: "Проекты",
          afterLabel: "Проектный контур"
        }
      }
    });
  });

  it("rejects missing required audit fields and actors without correlation IDs", () => {
    expect(() =>
      createAuditTargetRef({
        entityType: "",
        entityId: "target-1"
      })
    ).toThrow("auditTarget.entityType is required");

    expect(() =>
      createAuditEvent({
        id: "audit-without-correlation",
        actor: createActorContext({
          tenantId: "tenant-a",
          actorId: "tenant-admin-a"
        }),
        actionKey: "tenant_labels.update",
        target: createAuditTargetRef({
          entityType: "tenantLabel",
          entityId: "navigation.projects"
        }),
        result: "success",
        timestamp: "2026-05-14T14:10:00+07:00"
      })
    ).toThrow("actor.correlationId is required");

    expect(() =>
      createAuditEvent({
        id: "audit-invalid-result",
        actor: createActorContext({
          tenantId: "tenant-a",
          actorId: "tenant-admin-a",
          correlationId: "corr-invalid-result"
        }),
        actionKey: "tenant_labels.update",
        target: createAuditTargetRef({
          entityType: "tenantLabel",
          entityId: "navigation.projects"
        }),
        result: "pending" as never,
        timestamp: "2026-05-14T14:10:00+07:00"
      })
    ).toThrow("auditEvent.result is invalid");
  });

  it("clones details so audit input mutations cannot rewrite event history", () => {
    const details = {
      before: { label: "Проекты" },
      after: { label: "Проектный контур" }
    };
    const event = createAuditEvent({
      id: "audit-clone-details",
      actor: createActorContext({
        tenantId: "tenant-a",
        actorId: "tenant-admin-a",
        correlationId: "corr-clone-details"
      }),
      actionKey: "tenant_labels.update",
      target: createAuditTargetRef({
        entityType: "tenantLabel",
        entityId: "navigation.projects"
      }),
      result: "success",
      timestamp: "2026-05-14T14:11:00+07:00",
      details
    });

    details.after.label = "Переписано после события";

    expect(event.details?.after).toEqual({ label: "Проектный контур" });
  });

  it("throws typed domain errors for audit validation failures", () => {
    try {
      createAuditEvent({
        id: "",
        actor: createActorContext({
          tenantId: "tenant-a",
          actorId: "tenant-admin-a",
          correlationId: "corr-validation"
        }),
        actionKey: "tenant_labels.update",
        target: createAuditTargetRef({
          entityType: "tenantLabel",
          entityId: "navigation.projects"
        }),
        result: "success",
        timestamp: "2026-05-14T14:12:00+07:00"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainInvariantError);
      expect((error as DomainInvariantError).code).toBe("validation_error");
    }
  });
});
