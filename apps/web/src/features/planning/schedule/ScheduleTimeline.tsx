"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo, type CSSProperties } from "react";

import {
  readCalculatedProjectFinish,
  readProjectPlannedFinish,
  readProjectPlannedStart
} from "../planningReadModelAccess";
import type { WbsGridRow } from "../grid/wbsRows";
import { buildGanttBarModels } from "./ganttBarModel";
import { buildDependencyPaths, type GanttBarLayout } from "./ganttDependencyPaths";
import {
  barWidthOnTimeline,
  buildGanttTimelineScale,
  dateToTimelineX,
  GANTT_ROW_HEIGHT_PX,
  type GanttZoom
} from "./ganttTimelineScale";
import { ScheduleGanttBarRows } from "./ScheduleGanttBarRows";
import { useGanttBarInteraction } from "./useGanttBarInteraction";

export function ScheduleTimeline(props: {
  readModel: PlanningReadModel | undefined;
  rows: WbsGridRow[];
  zoom: GanttZoom;
  showBaseline: boolean;
  selectedTaskId: string | null;
  totalHeight: number;
  canEditGantt: boolean;
  onSelectTask: (taskId: string) => void;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const rangeStart = readProjectPlannedStart(props.readModel);
  const rangeFinish =
    readCalculatedProjectFinish(props.readModel) ?? readProjectPlannedFinish(props.readModel);

  const scale = useMemo(
    () =>
      buildGanttTimelineScale({
        rangeStart,
        rangeFinish,
        zoom: props.zoom
      }),
    [rangeFinish, rangeStart, props.zoom]
  );

  const barModels = useMemo(
    () => buildGanttBarModels(props.rows, props.readModel),
    [props.readModel, props.rows]
  );

  const interaction = useGanttBarInteraction({
    scale,
    barModels,
    canEdit: props.canEditGantt,
    onPreviewCommand: props.onPreviewCommand,
    onSelectTask: props.onSelectTask
  });

  const { layoutsByTaskId, dependencyPaths } = useMemo(() => {
    if (!scale) {
      return { layoutsByTaskId: new Map<string, GanttBarLayout>(), dependencyPaths: [] };
    }
    const layouts = new Map<string, GanttBarLayout>();
    for (const bar of barModels) {
      if (!bar.start) continue;
      const finish = bar.finish ?? bar.start;
      const left = dateToTimelineX(scale, bar.start);
      const width = barWidthOnTimeline(scale, bar.start, finish);
      layouts.set(bar.taskId, { taskId: bar.taskId, rowIndex: bar.rowIndex, left, width });
    }
    const dependencies = (props.readModel?.authored.dependencies ?? []).map((dependency) => ({
      id: String(dependency.id ?? ""),
      predecessorTaskId: String(dependency.predecessorTaskId ?? ""),
      successorTaskId: String(dependency.successorTaskId ?? ""),
      type: String(
        (dependency as { dependencyType?: string }).dependencyType ??
          (dependency as { type?: string }).type ??
          "FS"
      )
    }));
    return {
      layoutsByTaskId: layouts,
      dependencyPaths: buildDependencyPaths({ dependencies, layoutsByTaskId: layouts })
    };
  }, [barModels, props.readModel?.authored.dependencies, scale]);

  if (!scale) {
    return (
      <div className="planning-gantt-pane planning-gantt-pane--empty" data-testid="planning-gantt-pane">
        <p className="planning-pane__muted">Нет дат для шкалы графика.</p>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayX = dateToTimelineX(scale, todayIso);
  const deadline =
    typeof props.readModel?.project.deadline === "string" ? props.readModel.project.deadline : null;
  const deadlineX = deadline ? dateToTimelineX(scale, deadline) : null;

  const linkStartLayout = interaction.linkFromTaskId
    ? layoutsByTaskId.get(interaction.linkFromTaskId)
    : undefined;

  return (
    <div
      className="planning-gantt-pane"
      data-testid="planning-gantt-pane"
      style={{ "--gantt-cell-width": `${scale.cellWidth}px` } as CSSProperties}
    >
      {!interaction.dayZoomOnly && props.canEditGantt ? (
        <p className="planning-pane__muted planning-gantt-hint">
          Перетаскивание баров и связей доступно при масштабе «День». Shift+клик — новая связь FS.
        </p>
      ) : null}
      <div className="planning-gantt-scroll-x">
        <div className="planning-gantt-timeline-head" style={{ width: scale.timelineWidth }}>
          {scale.columns.map((column) => (
            <div
              key={column.key}
              className="planning-gantt-head-cell"
              style={{ width: scale.cellWidth }}
            >
              {column.label}
            </div>
          ))}
        </div>
        <div
          ref={interaction.canvasRef}
          className="planning-gantt-canvas"
          style={{ width: scale.timelineWidth, height: props.totalHeight }}
          onPointerMove={interaction.onCanvasPointerMove}
          onPointerUp={(event) => void interaction.onCanvasPointerUp(event)}
        >
          {todayX >= 0 && todayX <= scale.timelineWidth ? (
            <div className="planning-gantt-marker planning-gantt-marker--today" style={{ left: todayX }} />
          ) : null}
          {deadlineX !== null && deadlineX >= 0 && deadlineX <= scale.timelineWidth ? (
            <div
              className="planning-gantt-marker planning-gantt-marker--deadline"
              style={{ left: deadlineX }}
            />
          ) : null}
          <svg className="planning-gantt-deps" width={scale.timelineWidth} height={props.totalHeight}>
            {dependencyPaths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                className="planning-gantt-dep-line"
                data-testid="planning-gantt-dep-line"
              />
            ))}
            {linkStartLayout && interaction.linkPointer ? (
              <line
                x1={linkStartLayout.left + linkStartLayout.width}
                y1={linkStartLayout.rowIndex * GANTT_ROW_HEIGHT_PX + GANTT_ROW_HEIGHT_PX / 2}
                x2={interaction.linkPointer.x}
                y2={interaction.linkPointer.y}
                className="planning-gantt-dep-line planning-gantt-dep-line--draft"
              />
            ) : null}
          </svg>
          <ScheduleGanttBarRows
            scale={scale}
            barModels={barModels}
            layoutsByTaskId={layoutsByTaskId}
            selectedTaskId={props.selectedTaskId}
            showBaseline={props.showBaseline}
            canEditGantt={props.canEditGantt}
            dayZoomOnly={interaction.dayZoomOnly}
            dragPreview={interaction.dragPreview}
            onBarPointerDown={interaction.onBarPointerDown}
          />
        </div>
      </div>
    </div>
  );
}
