"use client";

import { useCallback, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_GANTT_COLUMNS } from "./gantt-column-settings";
import { GanttChartBar } from "./gantt-chart-bar";
import { buildDependencyPaths, GANTT_CHART_HEADER_PX, GANTT_ROW_PX } from "./gantt-dependency-paths";
import {
  buildLinkPreviewLine,
  canCompleteLinkHover,
  linkTargetFromPointer
} from "./gantt-link-interaction";
import { dayIndexToDateLabel, finishDayIndex } from "./gantt-dates";
import { isCellInRange } from "./gantt-selection";
import { hasPlanningIssue } from "./gantt-planning-issues";
import { GanttWbsGrid } from "./gantt-wbs-grid";
import type {
  GanttCellField,
  GanttColumnConfig,
  GanttColumnId,
  GanttContextTarget,
  GanttData,
  GanttDayHeader,
  GanttDependencyEndpoint,
  GanttDragSession,
  GanttFocusCell,
  GanttLinkSession,
  GanttProps,
  GanttRow,
  GanttRowDragState,
  GanttZoom
} from "./types";

const DAY_W_BY_ZOOM: Record<GanttZoom, number> = {
  hour: 44,
  day: 20,
  week: 18,
  month: 12
};

function ChartHead1({ days, monthLabel }: { days: GanttDayHeader[]; monthLabel?: string }) {
  return (
    <div className="gantt2__chart-month" style={{ gridColumn: `1 / span ${days.length}` }}>
      {monthLabel ?? "Период"}
    </div>
  );
}

function ChartHead2({ days }: { days: GanttDayHeader[] }) {
  return (
    <>
      {days.map((d) => (
        <div key={d.day} className={cn("gantt2__chart-day", d.weekend && "gantt2__chart-day--weekend")}>
          {d.day}
        </div>
      ))}
    </>
  );
}

function ArrowHead({ x, y, dir }: { x: number; y: number; dir: "left" | "right" }) {
  const tip = 5;
  const half = 3;
  const points =
    dir === "right"
      ? `${x},${y} ${x - tip},${y - half} ${x - tip},${y + half}`
      : `${x},${y} ${x + tip},${y - half} ${x + tip},${y + half}`;
  return <polygon className="gdep__arrow" points={points} />;
}

function DependencyOverlay({
  rows,
  dependencies,
  dayW,
  chartWidth,
  selectedDependencyId,
  link,
  onSelectDependency,
  onDependencyContextMenu
}: {
  rows: GanttRow[];
  dependencies: GanttData["dependencies"];
  dayW: number;
  chartWidth: number;
  selectedDependencyId?: string;
  link: GanttLinkSession | null;
  onSelectDependency?: (id: string) => void;
  onDependencyContextMenu?: (event: React.MouseEvent, dependencyId: string) => void;
}) {
  const height = GANTT_CHART_HEADER_PX + rows.length * GANTT_ROW_PX;
  const paths = dependencies?.length ? buildDependencyPaths(rows, dependencies, dayW) : [];
  const normalPaths = paths.filter((path) => path.id !== selectedDependencyId);
  const highlightedPath = selectedDependencyId
    ? paths.find((path) => path.id === selectedDependencyId)
    : undefined;

  const renderPath = (path: (typeof paths)[number]) => (
    <g
      key={path.id}
      className={cn("gdep__path", selectedDependencyId === path.id && "gdep__path--selected")}
      style={{ pointerEvents: "stroke" }}
      onClick={() => onSelectDependency?.(path.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectDependency?.(path.id);
        onDependencyContextMenu?.(event, path.id);
      }}
    >
      <path className="gdep__line" d={path.d} />
      <ArrowHead x={path.x2} y={path.y2} dir={path.arrowDir} />
    </g>
  );

  return (
    <svg className="gantt2__deps" width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`} aria-hidden>
      {normalPaths.map(renderPath)}
      {highlightedPath ? renderPath(highlightedPath) : null}
      {link
        ? (() => {
            const preview = buildLinkPreviewLine({ rows, link, dayW });
            if (!preview) return null;
            return (
              <line
                className="gdep__line gdep__line--preview"
                x1={preview.x1}
                y1={preview.y1}
                x2={preview.x2}
                y2={preview.y2}
              />
            );
          })()
        : null}
    </svg>
  );
}

function rowClass(row: GanttRow, selected: boolean) {
  return cn("gantt2__row", row.kind === "summary" && "gantt2__row--group", selected && "gantt2__row--selected");
}

export type GanttEndpointPointerAction =
  | { type: "start"; rowId: string; endpoint: GanttDependencyEndpoint }
  | { type: "complete"; rowId: string; endpoint: GanttDependencyEndpoint }
  | { type: "ignore" };

export function resolveEndpointPointerAction(
  link: GanttLinkSession | null,
  rowId: string,
  endpoint: GanttDependencyEndpoint
): GanttEndpointPointerAction {
  if (!link) return { type: "start", rowId, endpoint };
  if (canCompleteLinkHover(link.fromId, { rowId, endpoint })) {
    return { type: "complete", rowId, endpoint };
  }
  return { type: "ignore" };
}

export function GanttView({
  data,
  className,
  zoom = "day",
  interactionMode = "readonly",
  previewState,
  previewMessage,
  showDependencies = true,
  showBaseline = false,
  showCriticalPath = true,
  edit,
  focus,
  selection,
  rowDrag,
  drag,
  link,
  schedulingHint,
  onRowClick,
  onBarClick,
  onBarDoubleClick,
  columnConfig,
  onColumnResize,
  onColumnReorder,
  onRowHeaderClick,
  onCellClick,
  onCellFocus,
  onContextMenu,
  onRowDragStart,
  onRowDragOver,
  onRowDragEnd,
  onAssignResource,
  onStartEdit,
  onEditDraft,
  onCommitEdit,
  onCancelEdit,
  onToggleCollapse,
  onChartPointerDown,
  onChartPointerMove,
  onChartPointerUp,
  onLinkStart,
  onLinkMove,
  onLinkComplete,
  onLinkCancel,
  onDependencySelect,
  onKeyNavigate
}: GanttProps) {
  const interactive = interactionMode === "interactive";
  const dayW = DAY_W_BY_ZOOM[zoom];
  const dayCount = data.days.length;
  const chartWidth = dayCount * dayW;
  const todayIndex = data.days.findIndex((d) => d.today);
  const chartGridStyle = { gridTemplateColumns: `repeat(${dayCount}, var(--gantt-day-w, 28px))` } as const;
  const chartInnerRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef({ clientX: 0, clientY: 0 });
  const rowOrder = data.rows.map((r) => r.id);
  const columns = columnConfig ?? DEFAULT_GANTT_COLUMNS;

  const ctx = (event: React.MouseEvent, target: GanttContextTarget) => {
    event.preventDefault();
    onContextMenu?.(event, target);
  };

  const clientToChart = useCallback((clientX: number, clientY: number) => {
    const rect = chartInnerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleChartPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      lastPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      const { x, y } = clientToChart(event.clientX, event.clientY);
      if (link) {
        const hover = linkTargetFromPointer(event.clientX, event.clientY);
        onLinkMove?.(x, y, hover);
      }
      onChartPointerMove?.(event.clientX, event.clientY);
    },
    [clientToChart, link, onChartPointerMove, onLinkMove]
  );

  const handleChartPointerUp = useCallback(() => {
    if (link && interactive) {
      const hover = linkTargetFromPointer(
        lastPointerRef.current.clientX,
        lastPointerRef.current.clientY
      );
      if (canCompleteLinkHover(link.fromId, hover)) {
        onLinkComplete?.(hover.rowId, hover.endpoint);
      } else {
        onLinkCancel?.();
      }
    }
    onChartPointerUp?.();
  }, [interactive, link, onChartPointerUp, onLinkCancel, onLinkComplete]);

  const bindDrag = (rowId: string, kind: Parameters<NonNullable<GanttProps["onChartPointerDown"]>>[1]) =>
    (event: ReactPointerEvent) => {
      if (!chartInnerRef.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = chartInnerRef.current.getBoundingClientRect();
      onChartPointerDown?.(rowId, kind, event.clientX, rect, dayW);
    };

  return (
    <div
      className={cn(
        "gantt2",
        interactive && "gantt2--interactive",
        link && "gantt2--link-mode gantt2__shell--link-mode",
        data.selectedRowId && "gantt2--has-selection",
        data.selectedDependencyId && "gantt2--dependency-selected",
        className
      )}
      role="grid"
      aria-label={`Диаграмма Ганта · ${data.monthLabel ?? ""}`}
      data-gantt-zoom={zoom}
      data-gantt-preview={previewState}
      style={
        {
          "--gantt-chart-w": `${chartWidth}px`,
          "--gantt-day-w": `${dayW}px`,
          "--gantt-day-count": String(dayCount)
        } as CSSProperties
      }
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onKeyNavigate?.("down");
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onKeyNavigate?.("up");
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onKeyNavigate?.("left");
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onKeyNavigate?.("right");
        }
      }}
    >
      {previewMessage || schedulingHint ? (
        <div className="gantt2__status-banner" aria-live="polite">
          {previewMessage}
          {schedulingHint ? <span className="gantt2__status-banner-hint"> · {schedulingHint}</span> : null}
        </div>
      ) : null}
      <div className="gantt2__split">
        <GanttWbsGrid
          rows={data.rows}
          rowOrder={rowOrder}
          columns={columns}
          interactive={interactive}
          {...(data.selectedRowId ? { selectedRowId: data.selectedRowId } : {})}
          edit={edit ?? null}
          focus={focus ?? null}
          selection={selection ?? null}
          rowDrag={rowDrag ?? null}
          link={Boolean(link)}
          {...(onColumnResize ? { onColumnResize } : {})}
          {...(onColumnReorder ? { onColumnReorder } : {})}
          {...(onRowHeaderClick ? { onRowHeaderClick } : {})}
          {...(onRowDragStart ? { onRowDragStart } : {})}
          {...(onRowDragOver ? { onRowDragOver } : {})}
          {...(onRowDragEnd ? { onRowDragEnd } : {})}
          {...(onToggleCollapse ? { onToggleCollapse } : {})}
          onContextMenu={ctx}
          cellBind={(row, field) => ({
            selected: isCellInRange({ rowId: row.id, field }, selection ?? null, rowOrder),
            onFocus: () => onCellFocus?.({ rowId: row.id, field }),
            onClick: (event: React.MouseEvent) => onCellClick?.({ rowId: row.id, field }, event.shiftKey),
            onContextMenu: (event: React.MouseEvent) => ctx(event, { kind: "cell", rowId: row.id, field }),
            onDoubleClick: () => {
              if (field === "name") onBarDoubleClick?.(row.id);
              else onStartEdit?.(row.id, field);
            },
            ...(field === "start" || field === "finish"
              ? {
                  onDateCommit: (label: string) => {
                    onEditDraft?.(label);
                    onCommitEdit?.(label);
                  }
                }
              : {}),
            ...(field === "resource"
              ? {
                  onAssignResource: (resource: import("./gantt-resources").GanttResource | null) =>
                    onAssignResource?.(row.id, resource?.initials ?? null)
                }
              : {})
          })}
          cellProps={{
            edit: edit ?? null,
            focus: focus ?? null,
            ...(onCommitEdit ? { onCommit: onCommitEdit } : {}),
            ...(onCancelEdit ? { onCancel: onCancelEdit } : {}),
            ...(onEditDraft ? { onDraftChange: onEditDraft } : {})
          }}
        />
        <div
          className="gantt2__chart-scroll"
          role="rowgroup"
          aria-label="График сроков"
          onPointerMove={handleChartPointerMove}
          onPointerUp={handleChartPointerUp}
          onPointerLeave={handleChartPointerUp}
        >
          <div ref={chartInnerRef} className="gantt2__chart-inner" style={{ width: chartWidth }}>
            {showDependencies ? (
              <DependencyOverlay
                rows={data.rows}
                dependencies={data.dependencies}
                dayW={dayW}
                chartWidth={chartWidth}
                {...(data.selectedDependencyId ? { selectedDependencyId: data.selectedDependencyId } : {})}
                link={link ?? null}
                {...(onDependencySelect ? { onSelectDependency: onDependencySelect } : {})}
                {...(onContextMenu
                  ? {
                      onDependencyContextMenu: (event, dependencyId) =>
                        ctx(event, { kind: "dependency", dependencyId })
                    }
                  : {})}
              />
            ) : null}
            <div className="gantt2__row gantt2__row--head1 gantt2__row--chart" role="row">
              <div className="gantt2__cell gantt2__cell--chart gantt2__cell--chart-head1" style={chartGridStyle}>
                <ChartHead1 days={data.days} {...(data.monthLabel !== undefined ? { monthLabel: data.monthLabel } : {})} />
              </div>
            </div>
            <div className="gantt2__row gantt2__row--head2 gantt2__row--chart" role="row">
              <div className="gantt2__cell gantt2__cell--chart gantt2__cell--chart-head2" style={chartGridStyle}>
                <ChartHead2 days={data.days} />
              </div>
            </div>
            {data.rows.map((row) => {
              const selected = row.id === data.selectedRowId;
              return (
                <div
                  key={row.id}
                  className={cn(
                    rowClass(row, selected),
                    "gantt2__row--chart",
                    hasPlanningIssue(row) && "gantt2__row--planning-issue"
                  )}
                  role="row"
                  aria-selected={selected}
                  onContextMenu={(event) => ctx(event, { kind: "bar", rowId: row.id })}
                  onDoubleClick={() => onBarDoubleClick?.(row.id)}
                  onClick={() => onBarClick?.(row.id)}
                >
                  <div className="gantt2__cell gantt2__cell--chart" style={chartGridStyle}>
                    {todayIndex >= 0 ? (
                      <div className="gantt2__today" style={{ gridColumn: todayIndex + 1 }} aria-hidden />
                    ) : null}
                    <GanttChartBar
                      row={row}
                      selected={selected}
                      showBaseline={showBaseline}
                      showCritical={showCriticalPath}
                      drag={drag ?? null}
                      interactive={interactive}
                      linkMode={Boolean(link)}
                      {...(link?.fromId ? { linkSourceId: link.fromId } : {})}
                      {...(link?.hoverToId ? { linkHoverRowId: link.hoverToId } : {})}
                      {...(link?.hoverToEndpoint ? { linkHoverEndpoint: link.hoverToEndpoint } : {})}
                      onPointerDownMove={bindDrag(row.id, row.kind === "milestone" ? "milestone-move" : "move")}
                      onPointerDownResizeStart={bindDrag(row.id, "resize-start")}
                      onPointerDownResizeEnd={bindDrag(row.id, "resize-end")}
                      onPointerDownProgress={bindDrag(row.id, "progress")}
                      onEndpointPointerDown={(endpoint, event) => {
                        lastPointerRef.current = {
                          clientX: event.clientX,
                          clientY: event.clientY
                        };
                        const action = resolveEndpointPointerAction(link ?? null, row.id, endpoint);
                        if (action.type === "complete") {
                          onLinkComplete?.(action.rowId, action.endpoint);
                          return;
                        }
                        if (action.type === "ignore") return;
                        const { x, y } = clientToChart(event.clientX, event.clientY);
                        onLinkStart?.(action.rowId, action.endpoint, x, y);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {drag ? (
        <div className="gantt2__drag-readout" role="status" aria-live="polite">
          <span>Начало: {dayIndexToDateLabel(drag.previewStartDay)}</span>
          <span>
            Окончание:{" "}
            {dayIndexToDateLabel(
              drag.previewStartDay + Math.max(drag.previewDuration, 1) - (drag.previewDuration > 0 ? 1 : 0)
            )}
          </span>
          <span>Длительность: {drag.previewDuration}д</span>
          <span>Прогресс: {Math.round(drag.previewProgress * 100)}%</span>
        </div>
      ) : null}
    </div>
  );
}
