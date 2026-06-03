"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditEventListItem } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function AuditEventsRuntimeBlock({
  auditEvents
}: {
  auditEvents: AuditEventListItem[];
}) {
  const events = auditEvents.slice(0, 50);

  return (
    <>
      <RoutePageIntro lead="Живой журнал управленческих действий: кто, что изменил, по какой сущности и с каким результатом." />
      <CardPanel title="Аудит действий" subtitle={`${events.length} записей`} flush>
        {events.length === 0 ? (
          <EmptyState
            title="Записей аудита нет"
            description="После управленческих действий и подтверждений агента события появятся здесь."
          />
        ) : (
          <ul className="audit-list">
            {events.map((event) => (
              <li key={event.id} className="audit-list__item">
                <div className="audit-list__body">
                  <div className="audit-list__head">
                    <strong className="u-text-body u-text-strong">{event.actionType}</strong>
                    <Chip variant={isAllowed(event.permissionResult) ? "success" : "warning"}>
                      {isAllowed(event.permissionResult) ? "разрешено" : "отклонено"}
                    </Chip>
                  </div>
                  <p className="u-text-body u-text-muted">
                    {event.sourceWorkflow ?? "workspace"} · {entityLabel(event.sourceEntity)}
                  </p>
                  <p className="u-text-xs u-text-muted">
                    Актор: <span className="mono">{event.actorUserId}</span> · корреляция{" "}
                    <span className="mono">{event.correlationId}</span>
                  </p>
                </div>
                <span className="u-text-xs u-text-muted mono">{formatAuditDate(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardPanel>
    </>
  );
}

function formatAuditDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}

function isAllowed(permissionResult: Record<string, unknown>): boolean {
  return permissionResult.allowed === true;
}

function entityLabel(sourceEntity: Record<string, unknown>): string {
  const type = typeof sourceEntity.type === "string" ? sourceEntity.type : "Entity";
  const id = typeof sourceEntity.id === "string" ? sourceEntity.id : "unknown";
  return `${type}:${id}`;
}
