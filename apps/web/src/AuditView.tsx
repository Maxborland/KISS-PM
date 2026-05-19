import { Activity } from "lucide-react";

import { type WorkspaceData } from "./workspaceData";
import {
  buildAuditChangeSummary,
  buildAuditPreviewRows,
  getAuditActionLabel
} from "./workspaceDashboard";
import { formatDate } from "./workspaceViewHelpers";
import { type SectionState } from "./workspaceShellState";
import {
  Panel,
  SectionFeedback,
  TableEmpty
} from "./components/workspace-ui";

export function AuditView(props: {
  data: WorkspaceData;
  sectionState: SectionState;
}) {
  const auditRows = buildAuditPreviewRows(props.data.auditEvents, props.data.users, 200);

  return (
    <Panel
      title="Аудит"
      subtitle="Проверяемый журнал административных действий и изменений настроек рабочего пространства."
      actions={
        <span className="toolbar-chip">
          <Activity aria-hidden="true" size={14} />
          {props.data.auditEvents.length} событий
        </span>
      }
    >
      <SectionFeedback state={props.sectionState} emptyLabel="Аудит недоступен для текущей роли." />
      {props.sectionState.canRead && !props.sectionState.error ? (
        <div className="table-wrap">
          <table className="data-table audit-table" aria-label="События аудита">
            <thead>
              <tr>
                <th>Событие</th>
                <th>Пользователь</th>
                <th>Рабочий поток</th>
                <th>Сущность</th>
                <th>Изменение</th>
                <th>ID корреляции</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {props.data.auditEvents.length === 0 ? (
                <TableEmpty colSpan={7} label="Событий аудита пока нет." />
              ) : (
                props.data.auditEvents.map((event) => {
                  const preview = auditRows.find((row) => row.id === event.id);
                  const actor = props.data.users.find(
                    (user) => user.id === event.actorUserId
                  );
                  const changeSummary = buildAuditChangeSummary(event);

                  return (
                    <tr key={event.id}>
                      <td>
                        <span className="entity-name-cell">
                          <span className="row-avatar">A</span>
                          <span>
                            <strong>{getAuditActionLabel(event.actionType)}</strong>
                            <small>{event.actionType}</small>
                          </span>
                        </span>
                      </td>
                      <td>{actor?.name ?? event.actorUserId}</td>
                      <td>{event.sourceWorkflow ?? "Не задан"}</td>
                      <td>
                        {event.sourceEntity
                          ? `${event.sourceEntity.type}: ${event.sourceEntity.id}`
                          : "Не задана"}
                      </td>
                      <td>
                        <span className="entity-name-cell">
                          <span>
                            <strong>{changeSummary.title}</strong>
                            <small>{changeSummary.detail}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <code className="inline-code">{event.correlationId}</code>
                      </td>
                      <td>{preview?.createdAtLabel ?? formatDate(event.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}
