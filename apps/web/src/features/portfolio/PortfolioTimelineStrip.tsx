import type { Project } from "../../api";
import { formatDateOnly } from "../../workspaceViewHelpers";

function projectBarStyle(project: Project, rangeStart: number, rangeSpan: number) {
  const start = project.plannedStart ? Date.parse(project.plannedStart) : rangeStart;
  const finish = project.plannedFinish ? Date.parse(project.plannedFinish) : start + 86_400_000;
  const left = ((start - rangeStart) / rangeSpan) * 100;
  const width = Math.max(2, ((finish - start) / rangeSpan) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

export function PortfolioTimelineStrip(props: { projects: Project[] }) {
  const active = props.projects.filter((project) => project.status !== "closed");
  if (active.length === 0) {
    return (
      <section className="panel wide-panel" data-testid="portfolio-timeline">
        <p className="muted">Нет активных проектов для портфельной шкалы.</p>
      </section>
    );
  }

  const starts = active.map((p) => Date.parse(p.plannedStart ?? new Date().toISOString()));
  const finishes = active.map((p) => Date.parse(p.plannedFinish ?? p.plannedStart ?? new Date().toISOString()));
  const rangeStart = Math.min(...starts);
  const rangeFinish = Math.max(...finishes);
  const rangeSpan = Math.max(86_400_000, rangeFinish - rangeStart);

  return (
    <section className="panel wide-panel portfolio-timeline" data-testid="portfolio-timeline">
      <div className="panel-heading">
        <div>
          <h2>Портфель: шкала проектов</h2>
          <p className="panel-subtitle">
            {formatDateOnly(new Date(rangeStart).toISOString().slice(0, 10))} —{" "}
            {formatDateOnly(new Date(rangeFinish).toISOString().slice(0, 10))}
          </p>
        </div>
      </div>
      <ul className="portfolio-timeline-list">
        {active.map((project) => (
          <li key={project.id}>
            <span className="portfolio-timeline-label">{project.title}</span>
            <div className="portfolio-timeline-track">
              <div
                className="portfolio-timeline-bar"
                style={projectBarStyle(project, rangeStart, rangeSpan)}
                title={`${project.plannedStart ?? "?"} — ${project.plannedFinish ?? "?"}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
