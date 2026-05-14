import { createActorContext, createAuditEvent, createAuditTargetRef } from "@kiss-pm/domain-core";
import { describe, expect, it } from "vitest";

import { createInMemoryAuditEventStore } from "./auditLog";

function makeAuditEvent(input: { id: string; tenantId?: string; actorId?: string; targetId?: string }) {
  return createAuditEvent({
    id: input.id,
    actor: createActorContext({
      tenantId: input.tenantId ?? "tenant-a",
      actorId: input.actorId ?? "tenant-admin-a",
      correlationId: `corr-${input.id}`
    }),
    actionKey: "tenant_labels.update",
    target: createAuditTargetRef({
      entityType: "tenantLabel",
      entityId: input.targetId ?? "navigation.projects"
    }),
    result: "success",
    timestamp: "2026-05-14T14:15:00+07:00",
    details: {
      after: { label: "Проектный контур" }
    }
  });
}

describe("in-memory audit event store", () => {
  it("appends events and returns tenant-scoped audit readback in insertion order", () => {
    const store = createInMemoryAuditEventStore();
    const tenantAFirst = makeAuditEvent({ id: "audit-a-001", targetId: "navigation.projects" });
    const tenantBEvent = makeAuditEvent({
      id: "audit-b-001",
      tenantId: "tenant-b",
      actorId: "tenant-admin-b",
      targetId: "navigation.settings"
    });
    const tenantASecond = makeAuditEvent({ id: "audit-a-002", targetId: "navigation.portfolio" });

    store.append(tenantAFirst);
    store.append(tenantBEvent);
    store.append(tenantASecond);

    expect(store.listByTenant("tenant-a").map((event) => event.id)).toEqual(["audit-a-001", "audit-a-002"]);
    expect(store.listByTenant("tenant-b").map((event) => event.id)).toEqual(["audit-b-001"]);
  });

  it("keeps append-only history isolated from caller mutations", () => {
    const store = createInMemoryAuditEventStore();
    const event = makeAuditEvent({ id: "audit-a-immutable" });

    store.append(event);
    event.details!.after = { label: "Mutated outside store" };
    const readback = store.listByTenant("tenant-a");
    readback[0]!.details!.after = { label: "Mutated readback" };

    expect(store.listByTenant("tenant-a")[0]).toMatchObject({
      id: "audit-a-immutable",
      details: {
        after: { label: "Проектный контур" }
      }
    });
  });

  it("rejects duplicate audit event IDs and invalid tenant readback requests", () => {
    const store = createInMemoryAuditEventStore();
    const event = makeAuditEvent({ id: "audit-duplicate" });

    store.append(event);

    expect(() => store.append(event)).toThrow("Duplicate audit event id: audit-duplicate");
    expect(() => store.listByTenant("")).toThrow("tenantId is required");
  });
});
