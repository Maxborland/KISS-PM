import "./planning-gantt.css";

export function GanttLegend() {
  return (
    <div className="planningGanttLegend" aria-label="Легенда графика">
      <span className="planningGanttLegendItem">
        <span className="planningGanttLegendSwatch" />
        Задача
      </span>
      <span className="planningGanttLegendItem">
        <span className="planningGanttLegendSwatch planningGanttBarCritical" />
        Критический путь
      </span>
      <span className="planningGanttLegendItem">
        <span className="planningGanttLegendSwatch planningGanttBaseline" />
        Baseline
      </span>
    </div>
  );
}
