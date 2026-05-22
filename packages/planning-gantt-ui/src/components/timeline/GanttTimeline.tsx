import type {
  PlanningGanttDependencyRow,
  PlanningGanttFeatures,
  PlanningGanttTaskRow
} from "../..";
import { getTimelineWidth } from "../../lib/timelineScale";
import "../planning-gantt.css";
import { GanttBar, getGanttBarRect } from "./GanttBar";
import { GanttDependencyArrows } from "./GanttDependencyArrows";
import { GanttTimelineHeader } from "./GanttTimelineHeader";

const rowHeight = 36;

export function GanttTimeline(props: {
  rows: readonly PlanningGanttTaskRow[];
  dependencies: readonly PlanningGanttDependencyRow[];
  rangeStart: string;
  rangeFinish: string;
  dayWidth: number;
  features: PlanningGanttFeatures;
}) {
  const width = Math.max(720, getTimelineWidth(props.rangeStart, props.rangeFinish, props.dayWidth));
  const height = 64 + props.rows.length * rowHeight + 24;
  const rects = props.rows.map((row, rowIndex) => ({
    row,
    rect: getGanttBarRect({
      row,
      rowIndex,
      rowHeight,
      rangeStart: props.rangeStart,
      dayWidth: props.dayWidth
    })
  }));
  const rectsByTaskId = new Map(
    rects.flatMap(({ row, rect }) => rect ? [[row.id, rect] as const] : [])
  );

  return (
    <div className="planningGanttTimeline">
      <svg className="planningGanttSvg" width={width} height={height} role="img" aria-label="Диаграмма Ганта">
        <GanttTimelineHeader
          rangeStart={props.rangeStart}
          rangeFinish={props.rangeFinish}
          dayWidth={props.dayWidth}
          width={width}
        />
        {props.features.dependencies ? (
          <GanttDependencyArrows
            dependencies={props.dependencies}
            rectsByTaskId={rectsByTaskId}
          />
        ) : null}
        {rects.map(({ row, rect }) =>
          rect ? (
            <GanttBar
              key={row.id}
              row={row}
              rect={rect}
              rangeStart={props.rangeStart}
              dayWidth={props.dayWidth}
              showBaseline={props.features.baseline}
            />
          ) : null
        )}
      </svg>
    </div>
  );
}
