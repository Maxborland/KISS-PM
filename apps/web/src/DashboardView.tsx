import {
  Activity,
  BriefcaseBusiness,
  ShieldCheck,
  Users
} from "lucide-react";

import { buildAuditPreviewRows } from "./workspaceDashboard";
import { type WorkspaceData } from "./workspaceData";
import { getMetricHint, type SectionState } from "./workspaceShellState";
import {
  Metric,
  SectionFeedback,
  StatusPill,
  TableEmpty
} from "./components/workspace-ui";

export function DashboardView(props: {
  data: WorkspaceData;
  sectionStates: {
    users: SectionState;
    positions: SectionState;
    accessRoles: SectionState;
    auditEvents: SectionState;
  };
}) {
  const activeUsers = props.data.users.filter((user) => user.status === "active").length;
  const dashboardUsers = props.data.users.slice(0, 7);
  const auditRows = buildAuditPreviewRows(props.data.auditEvents, props.data.users);

  return (
    <section className="dashboard-grid">
      <Metric
        icon={Users}
        hint={getMetricHint(props.sectionStates.users)}
        meta="Активные учетные записи"
        title="Пользователи"
        value={props.data.users.length}
      />
      <Metric
        icon={ShieldCheck}
        hint={getMetricHint(props.sectionStates.accessRoles)}
        meta="Профили доступа"
        title="Роли доступа"
        value={props.data.accessRoles.length}
      />
      <Metric
        icon={BriefcaseBusiness}
        hint={getMetricHint(props.sectionStates.positions)}
        meta="Оргструктура"
        title="Должности"
        value={props.data.positions.length}
      />
      <Metric
        icon={Activity}
        hint={getMetricHint(props.sectionStates.auditEvents)}
        meta={`${activeUsers} активных пользователей`}
        title="События аудита"
        value={props.data.auditEvents.length}
      />

      <section className="panel audit-preview-panel wide-panel">
        <div className="panel-heading audit-heading">
          <div>
            <h2>Рабочее пространство</h2>
            <p className="panel-subtitle">
              Базовый контур рабочего пространства: вход, пользователи, роли,
              должности, профиль, тема и журнал аудита.
            </p>
          </div>
        </div>
        <section className="audit-preview" aria-label="Последние события аудита">
          <h3>Последние события аудита</h3>
          <SectionFeedback
            state={props.sectionStates.auditEvents}
            emptyLabel="События аудита недоступны для текущей роли."
          />
          {props.sectionStates.auditEvents.canRead && !props.sectionStates.auditEvents.error ? (
            auditRows.length > 0 ? (
              <ol className="audit-list">
                {auditRows.map((event) => (
                  <li className="audit-list-item" key={event.id}>
                    <span className="audit-event-marker" aria-hidden="true" />
                    <div>
                      <strong>{event.actionLabel}</strong>
                      <small>
                        {event.actorName} · {event.createdAtLabel}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">Событий аудита пока нет.</p>
            )
          ) : null}
        </section>
      </section>

      <section className="panel user-records-panel wide-panel">
        <div className="panel-heading">
          <div>
            <h2>{props.data.users.length} пользователей</h2>
            <p className="panel-subtitle">
              Учетные записи с ролью, должностью, статусом и рабочим контекстом.
            </p>
          </div>
        </div>
        <SectionFeedback state={props.sectionStates.users} emptyLabel="Пользователи недоступны." />
        {props.sectionStates.users.canRead && !props.sectionStates.users.error ? (
          <div className="table-wrap dashboard-table-wrap">
            <table className="data-table dashboard-table" aria-label="Последние пользователи">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Статус</th>
                  <th>Роль доступа</th>
                  <th>Должность</th>
                  <th>Контекст</th>
                </tr>
              </thead>
              <tbody>
                {dashboardUsers.length === 0 ? (
                  <TableEmpty colSpan={5} label="Пользователей пока нет." />
                ) : (
                  dashboardUsers.map((user) => {
                    const role = props.data.accessRoles.find(
                      (item) => item.id === user.accessProfileId
                    );

                    return (
                      <tr key={user.id}>
                        <td>
                          <span className="person-cell">
                            <span className="row-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                            <span>
                              <strong>{user.name}</strong>
                              <small>{user.email}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <StatusPill
                            tone={user.status === "active" ? "success" : "muted"}
                            label={user.status === "active" ? "Активен" : "Отключен"}
                          />
                        </td>
                        <td>{role?.name ?? user.accessProfileId}</td>
                        <td>{user.positionName ?? "Без должности"}</td>
                        <td>
                          <span className="muted">Текущее рабочее пространство</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
