import type { PlanningReadModel } from "./planningReadModelMapper";
import "./planningWorkspace.css";

type BaselineTaskComparison = PlanningReadModel["baselineComparison"]["tasks"][number];

export type BaselineSummary = {
  taskCount: number;
  startVarianceDays: number;
  finishVarianceDays: number;
  workVarianceMinutes: number;
};

export function PlanningBaselinePanel(props: {
  readModel: PlanningReadModel;
}) {
  const comparison = props.readModel.baselineComparison;
  const summary = summarizeBaselineComparison(comparison.tasks);

  return (
    <section className="planning-side-panel planning-baseline-panel">
      <div>
        <h3>Baseline</h3>
        <p className="muted">
          {comparison.baselineId
            ? `${comparison.baselineId} / ${comparison.capturedAt ?? "дата фиксации не задана"}`
            : "Baseline пока не зафиксирован."}
        </p>
      </div>
      {comparison.baselineId ? (
        <>
          <div className="planning-baseline-summary">
            <div>
              <span>Задачи</span>
              <strong>{summary.taskCount}</strong>
            </div>
            <div>
              <span>Сдвиг старта</span>
              <strong>{formatSignedDays(summary.startVarianceDays)}</strong>
            </div>
            <div>
              <span>Сдвиг финиша</span>
              <strong>{formatSignedDays(summary.finishVarianceDays)}</strong>
            </div>
            <div>
              <span>Сдвиг работ</span>
              <strong>{formatSignedHours(summary.workVarianceMinutes)}</strong>
            </div>
          </div>
          {comparison.tasks.length === 0 ? (
            <p className="muted">В baseline нет строк для сравнения.</p>
          ) : (
            <div className="planning-baseline-list">
              {comparison.tasks.slice(0, 6).map((task) => (
                <article className="planning-baseline-row" key={task.taskId}>
                  <strong>{task.taskId}</strong>
                  <span>
                    {task.baselineStart ?? "нет"}
                    {" -> "}
                    {task.currentStart ?? "нет"}
                  </span>
                  <small>
                    финиш {formatNullableDays(task.finishDeltaDays)},
                    работы {formatNullableHours(task.workDeltaMinutes)}
                  </small>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

export function summarizeBaselineComparison(
  tasks: readonly BaselineTaskComparison[]
): BaselineSummary {
  return tasks.reduce<BaselineSummary>(
    (summary, task) => ({
      taskCount: summary.taskCount + 1,
      startVarianceDays: summary.startVarianceDays + (task.startDeltaDays ?? 0),
      finishVarianceDays: summary.finishVarianceDays + (task.finishDeltaDays ?? 0),
      workVarianceMinutes: summary.workVarianceMinutes + (task.workDeltaMinutes ?? 0)
    }),
    {
      taskCount: 0,
      startVarianceDays: 0,
      finishVarianceDays: 0,
      workVarianceMinutes: 0
    }
  );
}

function formatNullableDays(value: number | null): string {
  return value === null ? "нет" : formatSignedDays(value);
}

function formatNullableHours(value: number | null): string {
  return value === null ? "нет" : formatSignedHours(value);
}

function formatSignedDays(value: number): string {
  if (value === 0) return "0 дн.";
  return `${value > 0 ? "+" : ""}${value} дн.`;
}

function formatSignedHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours === 0) return "0 ч";
  return `${hours > 0 ? "+" : ""}${hours} ч`;
}
