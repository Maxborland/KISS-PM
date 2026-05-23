"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { useCallback, useRef, useState } from "react";

import type { GanttBarModel } from "./ganttBarModel";
import {
  barWidthOnTimeline,
  dateToTimelineX,
  diffUtcDaysBetween,
  GANTT_ROW_HEIGHT_PX,
  timelineXToDate,
  type GanttTimelineScale
} from "./ganttTimelineScale";

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  mode: DragMode;
  taskId: string;
  startIso: string;
  finishIso: string;
  pointerStartX: number;
  originStartX: number;
  originWidth: number;
};

const RESIZE_HANDLE_PX = 8;

function shiftIsoByDays(iso: string, days: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function hitTestBar(
  scale: GanttTimelineScale,
  barModels: GanttBarModel[],
  canvasEl: HTMLElement,
  clientX: number,
  clientY: number
): { bar: GanttBarModel; layoutLeft: number; layoutWidth: number } | null {
  const rect = canvasEl.getBoundingClientRect();
  const x = clientX - rect.left + canvasEl.scrollLeft;
  const y = clientY - rect.top + canvasEl.scrollTop;
  for (const bar of barModels) {
    if (!bar.start || bar.kind === "milestone") continue;
    const top = bar.rowIndex * GANTT_ROW_HEIGHT_PX;
    const finish = bar.finish ?? bar.start;
    const layoutLeft = dateToTimelineX(scale, bar.start);
    const layoutWidth = barWidthOnTimeline(scale, bar.start, finish);
    if (y >= top && y < top + GANTT_ROW_HEIGHT_PX && x >= layoutLeft && x <= layoutLeft + layoutWidth) {
      return { bar, layoutLeft, layoutWidth };
    }
  }
  return null;
}

export function useGanttBarInteraction(options: {
  scale: GanttTimelineScale | null;
  barModels: GanttBarModel[];
  canEdit: boolean;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
  onSelectTask: (taskId: string) => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [linkFromTaskId, setLinkFromTaskId] = useState<string | null>(null);
  const [linkPointer, setLinkPointer] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const dayZoomOnly = options.scale?.zoom === "day";

  const commitSchedule = useCallback(
    async (taskId: string, startIso: string, finishIso: string) => {
      await options.onPreviewCommand({
        type: "task.update_schedule",
        payload: { taskId, plannedStart: startIso, plannedFinish: finishIso }
      });
    },
    [options.onPreviewCommand]
  );

  const onBarPointerDown = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      bar: GanttBarModel,
      layoutLeft: number,
      layoutWidth: number
    ) => {
      if (!options.canEdit || !options.scale || !bar.start || bar.kind === "milestone") return;
      if (!dayZoomOnly) return;
      event.stopPropagation();
      options.onSelectTask(bar.taskId);
      const startIso = bar.start;
      const finishIso = bar.finish ?? bar.start;

      if (event.shiftKey) {
        setLinkFromTaskId(bar.taskId);
        setLinkPointer({ x: layoutLeft + layoutWidth, y: bar.rowIndex * GANTT_ROW_HEIGHT_PX + 18 });
        return;
      }

      const localX = event.clientX - event.currentTarget.getBoundingClientRect().left;
      let mode: DragMode = "move";
      if (localX <= RESIZE_HANDLE_PX) mode = "resize-start";
      else if (localX >= layoutWidth - RESIZE_HANDLE_PX) mode = "resize-end";

      const next: DragState = {
        mode,
        taskId: bar.taskId,
        startIso,
        finishIso,
        pointerStartX: event.clientX,
        originStartX: layoutLeft,
        originWidth: layoutWidth
      };
      dragRef.current = next;
      setActiveDrag(next);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [dayZoomOnly, options]
  );

  const onCanvasPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const scale = options.scale;
      if (!scale) return;

      if (linkFromTaskId) {
        const rect = event.currentTarget.getBoundingClientRect();
        setLinkPointer({
          x: event.clientX - rect.left + event.currentTarget.scrollLeft,
          y: event.clientY - rect.top + event.currentTarget.scrollTop
        });
        return;
      }

      const drag = dragRef.current;
      if (!drag || !dayZoomOnly) return;
      const deltaX = event.clientX - drag.pointerStartX;
      const dayDelta = Math.round(deltaX / scale.cellWidth);

      let nextDrag: DragState | null = null;
      if (drag.mode === "move") {
        nextDrag = {
          ...drag,
          startIso: shiftIsoByDays(drag.startIso, dayDelta),
          finishIso: shiftIsoByDays(drag.finishIso, dayDelta)
        };
      } else {
        const newStartX = drag.mode === "resize-start" ? drag.originStartX + deltaX : drag.originStartX;
        const newFinishX =
          drag.mode === "resize-end"
            ? drag.originStartX + drag.originWidth + deltaX
            : drag.originStartX + drag.originWidth;
        const nextStart = timelineXToDate(scale, newStartX);
        const nextFinish = timelineXToDate(scale, newFinishX);
        if (diffUtcDaysBetween(nextStart, nextFinish) >= 0) {
          nextDrag = { ...drag, startIso: nextStart, finishIso: nextFinish };
        }
      }
      if (nextDrag) {
        dragRef.current = nextDrag;
        setActiveDrag(nextDrag);
      }
    },
    [dayZoomOnly, linkFromTaskId, options.scale]
  );

  const onCanvasPointerUp = useCallback(
    async (event: React.PointerEvent<HTMLElement>) => {
      const canvasEl = canvasRef.current;
      if (linkFromTaskId && canvasEl && options.scale) {
        const hit = hitTestBar(options.scale, options.barModels, canvasEl, event.clientX, event.clientY);
        if (hit && hit.bar.taskId !== linkFromTaskId) {
          await options.onPreviewCommand({
            type: "dependency.upsert",
            payload: {
              id: `dep-${Date.now()}`,
              predecessorTaskId: linkFromTaskId,
              successorTaskId: hit.bar.taskId,
              dependencyType: "FS",
              lagMinutes: 0
            }
          });
        }
        setLinkFromTaskId(null);
        setLinkPointer(null);
        return;
      }

      const drag = dragRef.current;
      dragRef.current = null;
      setActiveDrag(null);
      if (!drag) return;
      await commitSchedule(drag.taskId, drag.startIso, drag.finishIso);
    },
    [commitSchedule, linkFromTaskId, options]
  );

  return {
    canvasRef,
    onBarPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    linkFromTaskId,
    linkPointer,
    dragPreview: activeDrag,
    dayZoomOnly
  };
}
