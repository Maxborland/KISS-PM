"use client";

import { cn } from "@/lib/cn";
import { barIssueClass } from "./gantt-issue-styling";
import type { GanttDependencyEndpoint, GanttDragSession, GanttRow } from "./types";

function DependencyEndpointHandle({
  rowId,
  endpoint,
  hot,
  onPointerDown
}: {
  rowId: string;
  endpoint: GanttDependencyEndpoint;
  hot?: boolean;
  onPointerDown?: (endpoint: GanttDependencyEndpoint, event: React.PointerEvent) => void;
}) {
  const label = endpoint === "start" ? "Связать от начала" : "Связать от окончания";
  return (
    <button
      type="button"
      className={cn(
        "gantt2__dep-endpoint",
        endpoint === "start" ? "gantt2__dep-endpoint--start" : "gantt2__dep-endpoint--finish",
        hot && "gantt2__dep-endpoint--hot"
      )}
      data-gantt-row-id={rowId}
      data-gantt-endpoint={endpoint}
      aria-label={label}
      title={label}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(endpoint, event);
      }}
    />
  );
}

export function GanttChartBar({
  row,
  selected,
  showBaseline,
  showCritical,
  drag,
  interactive,
  linkMode,
  linkSourceId,
  linkHoverRowId,
  linkHoverEndpoint,
  onPointerDownMove,
  onPointerDownResizeStart,
  onPointerDownResizeEnd,
  onPointerDownProgress,
  onEndpointPointerDown
}: {
  row: GanttRow;
  selected: boolean;
  showBaseline: boolean;
  showCritical: boolean;
  drag: GanttDragSession | null;
  interactive: boolean;
  linkMode?: boolean;
  linkSourceId?: string;
  linkHoverRowId?: string;
  linkHoverEndpoint?: GanttDependencyEndpoint;
  onPointerDownMove?: (event: React.PointerEvent) => void;
  onPointerDownResizeStart?: (event: React.PointerEvent) => void;
  onPointerDownResizeEnd?: (event: React.PointerEvent) => void;
  onPointerDownProgress?: (event: React.PointerEvent) => void;
  onEndpointPointerDown?: (endpoint: GanttDependencyEndpoint, event: React.PointerEvent) => void;
}) {
  const activeDrag = drag?.rowId === row.id ? drag : null;
  const startDay = activeDrag?.previewStartDay ?? row.startDay;
  const durationDays = row.kind === "milestone" ? 0 : (activeDrag?.previewDuration ?? row.durationDays);
  const progress = activeDrag?.previewProgress ?? row.progress ?? 0;
  const start = startDay + 1;
  const span = Math.max(durationDays, 1);
  const col = { gridColumn: `${start} / span ${span}` } as const;
  const progressPct = Math.round(progress * 100);
  const canLink = interactive && (row.kind === "task" || row.kind === "milestone");
  const showEndpoints = canLink && (linkMode || selected || linkSourceId === row.id);

  if (row.kind === "milestone") {
    return (
      <span
        className={cn("gmile-wrap", selected && "gmile-wrap--selected", interactive && "gantt2__bar--interactive")}
        style={col}
        onPointerDown={interactive ? onPointerDownMove : undefined}
        role="img"
        aria-label={row.name}
      >
        <span className={cn("gmile", barIssueClass(row))} />
        {showEndpoints ? (
          <>
            <DependencyEndpointHandle
              rowId={row.id}
              endpoint="start"
              {...(linkHoverRowId === row.id && linkHoverEndpoint === "start" ? { hot: true } : {})}
              {...(onEndpointPointerDown ? { onPointerDown: onEndpointPointerDown } : {})}
            />
            <DependencyEndpointHandle
              rowId={row.id}
              endpoint="finish"
              {...(linkHoverRowId === row.id && linkHoverEndpoint === "finish" ? { hot: true } : {})}
              {...(onEndpointPointerDown ? { onPointerDown: onEndpointPointerDown } : {})}
            />
          </>
        ) : null}
      </span>
    );
  }

  const barClass = cn(
    "gbar",
    row.kind === "summary"
      ? row.level <= 1
        ? "gbar--group"
        : "gbar--group-2"
      : row.scheduleState === "overdue"
        ? "gbar--overdue"
        : row.scheduleState === "at-risk"
          ? "gbar--at-risk"
          : showCritical && row.critical
            ? "gbar--critical"
            : "gbar--task",
    selected && "gbar--selected",
    activeDrag && "gbar--preview",
    barIssueClass(row),
    interactive && row.kind === "task" && "gantt2__bar--interactive"
  );

  return (
    <>
      {showBaseline && row.baselineStartDay !== undefined && row.baselineDurationDays !== undefined ? (
        <div
          className="gbar-baseline"
          style={{
            gridColumn: `${row.baselineStartDay + 1} / span ${Math.max(row.baselineDurationDays, 1)}`
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={barClass}
        style={col}
        role="img"
        aria-label={row.name}
        data-gantt-bar-selected={selected ? "true" : undefined}
        onPointerDown={interactive && row.kind === "task" ? onPointerDownMove : undefined}
      >
        {row.kind === "task" && progressPct > 0 ? (
          <span className="gbar__progress" style={{ width: `${progressPct}%` }} aria-hidden />
        ) : null}
        {interactive && row.kind === "task" ? (
          <>
            <span
              className="gantt2__resize gantt2__resize--start"
              onPointerDown={(event) => {
                event.stopPropagation();
                onPointerDownResizeStart?.(event);
              }}
            />
            <span
              className="gantt2__resize gantt2__resize--end"
              onPointerDown={(event) => {
                event.stopPropagation();
                onPointerDownResizeEnd?.(event);
              }}
            />
            <span
              className="gantt2__progress-handle"
              style={{ left: `${progressPct}%` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPointerDownProgress?.(event);
              }}
            />
            {showEndpoints ? (
              <>
                <DependencyEndpointHandle
                  rowId={row.id}
                  endpoint="start"
                  {...(linkHoverRowId === row.id && linkHoverEndpoint === "start" ? { hot: true } : {})}
                  {...(onEndpointPointerDown ? { onPointerDown: onEndpointPointerDown } : {})}
                />
                <DependencyEndpointHandle
                  rowId={row.id}
                  endpoint="finish"
                  {...(linkHoverRowId === row.id && linkHoverEndpoint === "finish" ? { hot: true } : {})}
                  {...(onEndpointPointerDown ? { onPointerDown: onEndpointPointerDown } : {})}
                />
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
