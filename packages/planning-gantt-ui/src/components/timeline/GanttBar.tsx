import type { PlanningGanttTaskRow } from "../../types/viewModel";
import { dateToX } from "../../lib/timelineScale";

export type GanttBarRect = {
  taskId: string;
  startX: number;
  finishX: number;
  y: number;
  height: number;
};

export function getGanttBarRect(input: {
  row: PlanningGanttTaskRow;
  rowIndex: number;
  rowHeight: number;
  rangeStart: string;
  dayWidth: number;
}): GanttBarRect | null {
  if (!input.row.plannedStart || !input.row.plannedFinish) return null;
  const startX = dateToX(input.row.plannedStart, input.rangeStart, input.dayWidth);
  const finishX = dateToX(input.row.plannedFinish, input.rangeStart, input.dayWidth) + input.dayWidth;
  return {
    taskId: input.row.id,
    startX,
    finishX: Math.max(finishX, startX + input.dayWidth),
    y: 64 + input.rowIndex * input.rowHeight + 10,
    height: input.row.isSummary ? 10 : 16
  };
}

export function GanttBar(props: {
  row: PlanningGanttTaskRow;
  rect: GanttBarRect;
  rangeStart: string;
  dayWidth: number;
  showBaseline: boolean;
}) {
  const width = props.rect.finishX - props.rect.startX;
  const progressWidth = Math.max(0, Math.min(width, width * (props.row.percentComplete / 100)));
  const barClassName = props.row.isSummary
    ? "planningGanttSummary"
    : props.row.isCritical
      ? "planningGanttBar planningGanttBarCritical"
      : "planningGanttBar";

  return (
    <g data-task-id={props.row.id}>
      {props.showBaseline && props.row.baselineStart && props.row.baselineFinish ? (
        <rect
          className="planningGanttBaseline"
          x={dateToX(props.row.baselineStart, props.rangeStart, props.dayWidth)}
          y={props.rect.y + props.rect.height + 4}
          width={Math.max(
            props.dayWidth,
            dateToX(props.row.baselineFinish, props.rangeStart, props.dayWidth) -
              dateToX(props.row.baselineStart, props.rangeStart, props.dayWidth) +
              props.dayWidth
          )}
          height={4}
          rx={2}
        />
      ) : null}
      <rect
        className={barClassName}
        x={props.rect.startX}
        y={props.rect.y}
        width={width}
        height={props.rect.height}
        rx={props.row.isSummary ? 2 : 4}
      />
      {!props.row.isSummary && progressWidth > 0 ? (
        <rect
          className="planningGanttProgress"
          x={props.rect.startX}
          y={props.rect.y}
          width={progressWidth}
          height={props.rect.height}
          rx={4}
        />
      ) : null}
    </g>
  );
}
