"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useCallback, useMemo, useRef, useState } from "react";

import { PlanningSelect, PlanningSelectLabel } from "../../../components/ui/select";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { WbsGrid } from "../grid/WbsGrid";
import { buildWbsRows } from "../grid/wbsRows";
import { GANTT_ROW_HEIGHT_PX } from "./ganttTimelineScale";
import { ScheduleTimeline } from "./ScheduleTimeline";

export function SchedulePane(props: {
  readModel: PlanningReadModel | undefined;
  projectId: string;
  defaultStatusId: string;
  permissions: PlanningPermissions;
  previewPending: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
  onApplyBatch: (commands: PlanningCommand[]) => Promise<unknown>;
  onDeleteRows: (taskIds: string[]) => Promise<void>;
  onUndoPending: () => void;
  onUndoApplied?: () => void;
  onRedoApplied?: () => void;
  ganttZoom: "day" | "week" | "month";
  onGanttZoomChange: (zoom: "day" | "week" | "month") => void;
}) {
  const [showBaseline, setShowBaseline] = useState(false);
  const wbsScrollRef = useRef<HTMLDivElement | null>(null);
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  const rows = useMemo(() => buildWbsRows(props.readModel), [props.readModel]);
  const totalHeight = Math.max(GANTT_ROW_HEIGHT_PX, rows.length * GANTT_ROW_HEIGHT_PX);

  const syncScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (!target || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    target.scrollTop = source.scrollTop;
    syncingScrollRef.current = false;
  }, []);

  return (
    <div className="planning-schedule-pane" data-testid="planning-schedule-pane">
      <div className="planning-toolbar planning-schedule-toolbar">
        <label className="planning-schedule-baseline-toggle">
          <input
            type="checkbox"
            checked={showBaseline}
            onChange={(event) => setShowBaseline(event.target.checked)}
          />
          Сравнить с baseline
        </label>
        <PlanningSelectLabel>Масштаб</PlanningSelectLabel>
        <PlanningSelect
          aria-label="Масштаб диаграммы"
          value={props.ganttZoom}
          options={[
            { value: "day", label: "День" },
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" }
          ]}
          onChange={(value) => props.onGanttZoomChange(value as "day" | "week" | "month")}
        />
      </div>
      <div className="planning-schedule-grid">
        <div
          className="planning-schedule-wbs"
          ref={wbsScrollRef}
          onScroll={(event) => syncScroll(event.currentTarget, ganttScrollRef.current)}
        >
          <WbsGrid
            readModel={props.readModel}
            projectId={props.projectId}
            defaultStatusId={props.defaultStatusId}
            permissions={props.permissions}
            previewPending={props.previewPending}
            selectedTaskId={props.selectedTaskId}
            onSelectTask={props.onSelectTask}
            onPreviewCommand={props.onPreviewCommand}
            onApplyBatch={props.onApplyBatch}
            onDeleteRows={props.onDeleteRows}
            onUndoPending={props.onUndoPending}
            {...(props.onUndoApplied ? { onUndoApplied: props.onUndoApplied } : {})}
            {...(props.onRedoApplied ? { onRedoApplied: props.onRedoApplied } : {})}
          />
        </div>
        <div
          className="planning-schedule-gantt"
          ref={ganttScrollRef}
          onScroll={(event) => syncScroll(event.currentTarget, wbsScrollRef.current)}
        >
          <ScheduleTimeline
            readModel={props.readModel}
            rows={rows}
            zoom={props.ganttZoom}
            showBaseline={showBaseline}
            selectedTaskId={props.selectedTaskId}
            totalHeight={totalHeight}
            canEditGantt={
              props.permissions.canManageProjectPlan && !props.previewPending && props.ganttZoom === "day"
            }
            onSelectTask={props.onSelectTask}
            onPreviewCommand={props.onPreviewCommand}
          />
        </div>
      </div>
    </div>
  );
}
