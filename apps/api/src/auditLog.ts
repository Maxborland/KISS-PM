import { createAuditEvent } from "@kiss-pm/domain-core";
import type { AuditEvent, TenantId } from "@kiss-pm/domain-core";

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function cloneAuditEvent(event: AuditEvent): AuditEvent {
  return createAuditEvent({
    id: event.id,
    actor: {
      tenantId: event.tenantId,
      actorId: event.actorId,
      correlationId: event.correlationId
    },
    actionKey: event.actionKey,
    target: event.target,
    result: event.result,
    timestamp: event.timestamp,
    ...(event.details !== undefined ? { details: event.details } : {})
  });
}

export function createInMemoryAuditEventStore() {
  const events: AuditEvent[] = [];
  const eventIds = new Set<string>();

  return {
    append(event: AuditEvent): AuditEvent {
      if (eventIds.has(event.id)) {
        throw new Error(`Duplicate audit event id: ${event.id}`);
      }

      const storedEvent = cloneAuditEvent(event);
      events.push(storedEvent);
      eventIds.add(storedEvent.id);

      return cloneAuditEvent(storedEvent);
    },

    listByTenant(tenantId: TenantId): AuditEvent[] {
      const requestedTenantId = requireNonEmptyString(tenantId, "tenantId");

      return events.filter((event) => event.tenantId === requestedTenantId).map((event) => cloneAuditEvent(event));
    }
  };
}
