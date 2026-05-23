"use client";

import type { GanttBarModel } from "./ganttBarModel";
import type { GanttBarLayout } from "./ganttDependencyPaths";
import {
  barWidthOnTimeline,
  dateToTimelineX,
  GANTT_ROW_HEIGHT_PX,
  type GanttTimelineScale
} from "./ganttTimelineScale";

export function ScheduleGanttBarRows(props: {
  scale: GanttTimelineScale;
  barModels: GanttBarModel[];
  layoutsByTaskId: Map<string, GanttBarLayout>;
  selectedTaskId: string | null;
  showBaseline: boolean;
  canEditGantt: boolean;
  dayZoomOnly: boolean;
  dragPreview: { taskId: string; startIso: string; finishIso: string } | null;
  onBarPointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
    bar: GanttBarModel,
    layoutLeft: number,
    layoutWidth: number
  ) => void;
}) {
  return (
    <>
      {props.barModels.map((bar) => {
        const layout = props.layoutsByTaskId.get(bar.taskId);
        if (!layout || !bar.start) return null;
        const top = bar.rowIndex * GANTT_ROW_HEIGHT_PX;
        const isSelected = props.selectedTaskId === bar.taskId;
        const dragPreview =
          props.dragPreview?.taskId === bar.taskId ? props.dragPreview : null;
        const displayStart = dragPreview?.startIso ?? bar.start;
        const displayFinish = dragPreview?.finishIso ?? bar.finish ?? bar.start;
        const displayLeft = dateToTimelineX(props.scale, displayStart);
        const displayWidth = barWidthOnTimeline(props.scale, displayStart, displayFinish);
        return (
          <div
            key={bar.taskId}
            className={[
              "planning-gantt-row",
              isSelected ? "is-selected" : "",
              bar.isCritical ? "is-critical" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ top, height: GANTT_ROW_HEIGHT_PX }}
          >
            {bar.kind === "milestone" ? (
              <span
                className="planning-gantt-milestone"
                style={{ left: displayLeft }}
                title={bar.title}
              />
            ) : bar.kind === "summary" ? (
              <div
                className="planning-gantt-summary"
                style={{ left: displayLeft, width: displayWidth }}
                title={bar.title}
              />
            ) : (
              <>
                {props.showBaseline && bar.baselineFinish ? (
                  <div
                    className="planning-gantt-baseline"
                    style={{
                      left: dateToTimelineX(props.scale, bar.baselineFinish),
                      width: Math.max(4, displayWidth * 0.9)
                    }}
                  />
                ) : null}
                <div
                  className={[
                    "planning-gantt-bar",
                    props.canEditGantt && props.dayZoomOnly ? "is-draggable" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid="planning-gantt-bar"
                  data-task-id={bar.taskId}
                  style={{ left: displayLeft, width: displayWidth }}
                  title={`${bar.title}: ${displayStart} — ${displayFinish}`}
                  onPointerDown={(event) =>
                    props.onBarPointerDown(event, bar, layout.left, layout.width)
                  }
                />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
