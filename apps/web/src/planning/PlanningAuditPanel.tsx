import type { AuditEvent } from "../api";
import { getAuditActionLabel } from "../workspaceDashboard";
import "./planningWorkspace.css";

export function PlanningAuditPanel(props: {
  projectId: string;
  auditEvents: readonly AuditEvent[];
  canReadAudit: boolean;
  isLoading: boolean;
  error: string | null;
}) {
  const planningEvents = filterPlanningAuditEvents(props.auditEvents, props.projectId);

  return (
    <section className="planning-side-panel planning-audit-panel">
      <div>
        <h3>Аудит планирования</h3>
        <p className="muted">Planning preview/apply события из общего audit trail.</p>
      </div>
      {!props.canReadAudit ? (
        <p className="muted">Нужно право tenant.audit_events.read.</p>
      ) : props.error ? (
        <p className="planning-form-error">{props.error}</p>
      ) : props.isLoading && planningEvents.length === 0 ? (
        <p className="muted">Загружаем audit trail...</p>
      ) : planningEvents.length === 0 ? (
        <p className="muted">По этому проекту пока нет planning audit events.</p>
      ) : (
        <div className="planning-audit-list">
          {planningEvents.slice(0, 6).map((event) => (
            <article className="planning-audit-row" key={event.id}>
              <strong>{getAuditActionLabel(event.actionType)}</strong>
              <time>{formatAuditDate(event.createdAt)}</time>
              <small>{formatPlanVersionChange(event)}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function filterPlanningAuditEvents(
  auditEvents: readonly AuditEvent[],
  projectId: string
): AuditEvent[] {
  return auditEvents
    .filter((event) =>
      event.actionType.startsWith("planning.") &&
      event.sourceEntity?.type === "Project" &&
      event.sourceEntity.id === projectId
    )
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function formatPlanVersionChange(event: AuditEvent): string {
  const before = readPlanVersion(event.beforeState);
  const after = readPlanVersion(event.afterState);
  if (before !== null && after !== null) return `planVersion ${before} -> ${after}`;
  if (before !== null) return `planVersion ${before}`;
  if (after !== null) return `planVersion ${after}`;
  return "planVersion не указан";
}

function readPlanVersion(state: Record<string, unknown> | null | undefined): number | null {
  const value = state?.planVersion;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function formatAuditDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}
