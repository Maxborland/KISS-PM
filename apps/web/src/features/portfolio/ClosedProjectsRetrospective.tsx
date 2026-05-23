import type { Project } from "../../api";
import { formatDateOnly, formatMoney } from "../../workspaceViewHelpers";

export function ClosedProjectsRetrospective(props: { projects: Project[] }) {
  const closed = props.projects.filter((project) => project.status === "closed");
  if (closed.length === 0) {
    return (
      <section className="panel wide-panel" data-testid="closed-projects-retrospective">
        <p className="muted">Нет закрытых проектов для ретроспективы.</p>
      </section>
    );
  }

  return (
    <section className="panel wide-panel" data-testid="closed-projects-retrospective">
      <div className="panel-heading">
        <div>
          <h2>Ретроспектива закрытых проектов</h2>
          <p className="panel-subtitle">
            Снимок завершённых проектов для извлечения уроков в шаблоны (MVP).
          </p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Проект</th>
            <th>Финиш</th>
            <th>Контракт</th>
          </tr>
        </thead>
        <tbody>
          {closed.slice(0, 12).map((project) => (
            <tr key={project.id}>
              <td>{project.title}</td>
              <td>{formatDateOnly(project.plannedFinish)}</td>
              <td>{formatMoney(project.contractValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
