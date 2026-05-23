"use client";

import { fetchProjectAuditEvents } from "@kiss-pm/planning-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Dialog, DialogContent } from "../../../components/ui/dialog";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export function ProjectAuditPane(props: { projectId: string; canRead: boolean }) {
  const [advancedEvent, setAdvancedEvent] = useState<Record<string, unknown> | null>(null);
  const auditQuery = useQuery({
    queryKey: ["project-audit", props.projectId],
    queryFn: () => fetchProjectAuditEvents(apiOrigin, props.projectId),
    enabled: props.canRead
  });

  if (!props.canRead) {
    return <p title="Нужно право tenant.audit_events.read">Аудит проекта недоступен.</p>;
  }

  return (
    <section className="planning-pane" data-testid="planning-audit-pane">
      <h2>Аудит проекта</h2>
      <ul className="planning-audit-list">
        {(auditQuery.data?.auditEvents ?? []).slice(0, 50).map((event) => (
          <li key={String(event.id)}>
            <span>{humanAuditLabel(event)}</span>
            <button className="secondary-button" type="button" onClick={() => setAdvancedEvent(event)}>
              Подробнее
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={advancedEvent !== null} onOpenChange={(open) => !open && setAdvancedEvent(null)}>
        <DialogContent title="Advanced JSON" onClose={() => setAdvancedEvent(null)}>
          <pre>{advancedEvent ? JSON.stringify(advancedEvent, null, 2) : ""}</pre>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function humanAuditLabel(event: Record<string, unknown>): string {
  const actionType = String(event.actionType ?? "unknown");
  const createdAt = String(event.createdAt ?? "");
  return `${createdAt} · ${actionType}`;
}
