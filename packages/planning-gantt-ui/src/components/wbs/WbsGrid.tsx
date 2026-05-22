import type {
  PlanningGanttCapabilities,
  PlanningGanttIntent,
  PlanningGanttTaskRow
} from "../..";
import { buildPlanningTreeIndex, flattenPlanningRows } from "../../lib/treeRows";
import "../planning-gantt.css";

export function WbsGrid(props: {
  rows: readonly PlanningGanttTaskRow[];
  collapsedTaskIds?: ReadonlySet<string> | undefined;
  selectedTaskId?: string | null | undefined;
  capabilities: PlanningGanttCapabilities;
  onIntent?: ((intent: PlanningGanttIntent) => void) | undefined;
  onSelectTask?: ((taskId: string) => void) | undefined;
}) {
  const index = buildPlanningTreeIndex(props.rows);
  const flatRows = flattenPlanningRows(index, props.collapsedTaskIds);

  return (
    <table className="planningGanttTable" aria-label="WBS задач">
      <thead>
        <tr>
          <th scope="col">WBS</th>
          <th scope="col">Название</th>
          <th scope="col">Старт</th>
          <th scope="col">Финиш</th>
          <th scope="col">Работа</th>
          <th scope="col">%</th>
          <th scope="col">!</th>
        </tr>
      </thead>
      <tbody>
        {flatRows.map((flatRow) => {
          const row = index.rowsById.get(flatRow.id);
          if (!row) return null;
          return (
            <tr
              key={row.id}
              data-task-id={row.id}
              aria-selected={props.selectedTaskId === row.id}
              onClick={() => props.onSelectTask?.(row.id)}
            >
              <td>{row.wbsCode}</td>
              <td style={{ paddingLeft: 10 + flatRow.depth * 18 }}>
                {row.isSummary ? <strong>{row.title}</strong> : row.title}
              </td>
              <td>{row.plannedStart ?? "—"}</td>
              <td>{row.plannedFinish ?? "—"}</td>
              <td>{formatMinutes(row.workMinutes)}</td>
              <td>{row.percentComplete}%</td>
              <td>
                {row.validationIssueIds.length > 0 ? (
                  <span className="planningGanttIssueMark" title="Есть замечания планирования">
                    {row.validationIssueIds.length}
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}ч`;
  return `${minutes}м`;
}
