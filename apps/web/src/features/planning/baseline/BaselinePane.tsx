"use client";

import { useQuery } from "@tanstack/react-query";

import { planningApi } from "../planningApi";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import type { PlanningCommand } from "@kiss-pm/domain";

export function BaselinePane(props: {
  projectId: string;
  readModel: PlanningReadModel | undefined;
  canCapture: boolean;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const baselinesQuery = useQuery({
    queryKey: ["plan", props.projectId, "baselines"],
    queryFn: () => planningApi.listBaselines(props.projectId)
  });
  const comparison = props.readModel?.baselineComparison;

  return (
    <section className="planning-pane" data-testid="planning-baseline-pane">
      <h2>Baseline</h2>
      <button
        className="primary-button"
        type="button"
        disabled={!props.canCapture}
        title={props.canCapture ? undefined : "Нужно право tenant.project_baselines.manage"}
        onClick={() =>
          void props.onPreviewCommand({
            type: "baseline.capture",
            payload: { baselineId: `baseline-${Date.now()}`, label: "Baseline" }
          })
        }
      >
        Зафиксировать baseline
      </button>
      <ul>
        {(baselinesQuery.data?.baselines ?? []).map((baseline) => (
          <li key={baseline.id}>
            {baseline.id} · {baseline.capturedAt} · задач: {baseline.taskCount}
          </li>
        ))}
      </ul>
      {comparison ? (
        <table className="planning-baseline-compare">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Δ финиш, дн</th>
            </tr>
          </thead>
          <tbody>
            {(comparison.tasks as Array<{ taskId: string; finishDeltaDays: number | null }>).map((row) => (
              <tr key={row.taskId}>
                <td>{row.taskId}</td>
                <td>{row.finishDeltaDays ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
