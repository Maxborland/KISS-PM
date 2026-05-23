import type { Project } from "../../api";
import { formatDateOnly, formatMoney } from "../../workspaceViewHelpers";

export function RoleDashboardPanel(props: {
  projects: Project[];
  overloadProjectIds: ReadonlySet<string>;
}) {
  const atRisk = props.projects.filter(
    (project) =>
      props.overloadProjectIds.has(project.id) ||
      (project.plannedFinish &&
        Date.parse(project.plannedFinish) < Date.now() + 7 * 86_400_000)
  );

  return (
    <section className="panel wide-panel" data-testid="role-dashboard-panel">
      <div className="panel-heading">
        <div>
          <h2>Управленческий фокус</h2>
          <p className="panel-subtitle">
            Проекты с риском по срокам или с перегруженными сотрудниками (суммарно по всем проектам)
            — откройте график или ресурсы.
          </p>
        </div>
      </div>
      {atRisk.length === 0 ? (
        <p className="muted">Критичных отклонений по активным проектам не обнаружено.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Проект</th>
              <th>Финиш</th>
              <th>Контракт</th>
              <th>Сигнал</th>
            </tr>
          </thead>
          <tbody>
            {atRisk.slice(0, 8).map((project) => (
              <tr key={project.id}>
                <td>{project.title}</td>
                <td>{formatDateOnly(project.plannedFinish)}</td>
                <td>{formatMoney(project.contractValue)}</td>
                <td>
                  {props.overloadProjectIds.has(project.id)
                    ? "Участвует в перегрузе"
                    : "Срок ≤ 7 дн"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
