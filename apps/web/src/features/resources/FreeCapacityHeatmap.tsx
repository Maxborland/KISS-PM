import type { CapacitySummary } from "../dashboard/useCapacitySummary";

export function FreeCapacityHeatmap(props: { summary: CapacitySummary | undefined; isLoading: boolean }) {
  if (props.isLoading || !props.summary) {
    return (
      <section className="panel wide-panel free-capacity-heatmap" data-testid="free-capacity-heatmap">
        <p className="muted">Загрузка сводки ёмкости…</p>
      </section>
    );
  }

  const buckets = [
    { label: "Низкая загрузка", tone: "low" as const, count: props.summary.buckets.low },
    { label: "Средняя", tone: "mid" as const, count: props.summary.buckets.mid },
    { label: "Перегруз", tone: "high" as const, count: props.summary.buckets.high }
  ];

  return (
    <section className="panel wide-panel free-capacity-heatmap" data-testid="free-capacity-heatmap">
      <div className="panel-heading">
        <div>
          <h2>Свободная ёмкость</h2>
          <p className="panel-subtitle">
            Сводка по workspace за {props.summary.monthIso} (employee-total, все проекты).
          </p>
        </div>
      </div>
      <ul className="free-capacity-heatmap__grid">
        {buckets.map((bucket) => (
          <li key={bucket.label} className={`free-capacity-heatmap__cell is-${bucket.tone}`}>
            <strong>{bucket.count}</strong>
            <span>{bucket.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
