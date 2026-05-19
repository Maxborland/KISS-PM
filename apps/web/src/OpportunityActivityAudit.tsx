import type { AuditEvent } from "./api";
import { getWorkspaceUserName } from "./OpportunityActivityFeed";
import type { WorkspaceData } from "./workspaceData";
import { getAuditActionLabel } from "./workspaceDashboard";
import { formatDate } from "./workspaceViewHelpers";

export function OpportunityAuditTab(props: {
  auditEvents: AuditEvent[] | null;
  canReadRawAudit: boolean;
  data: WorkspaceData;
}) {
  if (!props.canReadRawAudit) {
    return (
      <p className="empty-state compact">
        Исходный аудит доступен только пользователям с правом tenant.audit_events.read.
      </p>
    );
  }
  if (!props.auditEvents || props.auditEvents.length === 0) {
    return <p className="empty-state compact">Аудит по этой сделке пока пуст.</p>;
  }

  return (
    <div className="activity-list">
      {props.auditEvents.map((event) => (
        <article className="activity-row system-row" key={event.id}>
          <div>
            <strong>{getAuditActionLabel(event.actionType)}</strong>
            <p>{getWorkspaceUserName(props.data, event.actorUserId)}</p>
            <small>{formatDate(event.createdAt)}</small>
          </div>
        </article>
      ))}
    </div>
  );
}
