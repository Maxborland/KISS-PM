import type { PlanningReadModel } from "./planningReadModelMapper";
import "./planningWorkspace.css";

export function ResourceLoadSummary(props: {
  readModel: PlanningReadModel;
}) {
  const dayBuckets = props.readModel.resourceLoad.buckets.filter((bucket) => bucket.granularity === "day");
  const assignedMinutes = dayBuckets.reduce((sum, bucket) => sum + bucket.assignedMinutes, 0);
  const capacityMinutes = dayBuckets.reduce((sum, bucket) => sum + bucket.capacityMinutes, 0);
  const reservedMinutes = dayBuckets.reduce((sum, bucket) => sum + bucket.reservedMinutes, 0);
  const overloadMinutes = props.readModel.resourceLoad.overloads.reduce((sum, overload) => sum + overload.overloadMinutes, 0);

  return (
    <section className="planning-side-panel">
      <h3>Ресурсная загрузка</h3>
      <dl className="planning-resource-metrics">
        <div>
          <dt>Назначено</dt>
          <dd>{formatHours(assignedMinutes)}</dd>
        </div>
        <div>
          <dt>Доступно</dt>
          <dd>{formatHours(capacityMinutes)}</dd>
        </div>
        <div>
          <dt>Резерв</dt>
          <dd>{formatHours(reservedMinutes)}</dd>
        </div>
        <div className={overloadMinutes > 0 ? "danger" : ""}>
          <dt>Перегруз</dt>
          <dd>{formatHours(overloadMinutes)}</dd>
        </div>
      </dl>
      {props.readModel.resourceLoad.overloads.length > 0 ? (
        <ul className="planning-overload-list">
          {props.readModel.resourceLoad.overloads.slice(0, 5).map((overload) => (
            <li key={`${overload.resourceId}:${overload.granularity}:${overload.date}`}>
              <strong>{overload.resourceId}</strong>
              <span>{overload.date}: {formatHours(overload.overloadMinutes)}</span>
              <small>{overload.taskIds.length} задач, {overload.reasons.length} причин</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Перегрузов по текущему read model нет.</p>
      )}
    </section>
  );
}

function formatHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} ч`;
}
