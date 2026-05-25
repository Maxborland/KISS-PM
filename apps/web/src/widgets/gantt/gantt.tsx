"use client";

import type { CSSProperties } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import type { GanttData, GanttDayHeader, GanttRow, GanttZoom } from "./types";

const DAY_W_BY_ZOOM: Record<GanttZoom, number> = {
  hour: 44,
  day: 28,
  week: 18,
  month: 12
};

function pctLabel(progress: number | undefined) {
  const p = Math.round((progress ?? 0) * 100);
  return `${p}%`;
}

function durationLabel(row: GanttRow) {
  if (row.kind === "milestone") return "0д";
  return `${row.durationDays}д`;
}

function fakeDate(dayIndex: number) {
  const d = Math.min(Math.max(dayIndex + 1, 1), 28);
  return `${String(d).padStart(2, "0")}.05.2026`;
}

function ChartBar({ row }: { row: GanttRow }) {
  const start = row.startDay + 1;
  const span = Math.max(row.durationDays, 1);
  const col = { gridColumn: `${start} / span ${span}` } as const;

  if (row.kind === "milestone") {
    return <div className="gmile" style={col} aria-hidden />;
  }

  const barClass =
    row.kind === "summary"
      ? row.level === 0
        ? "gbar gbar--group"
        : "gbar gbar--group-2"
      : row.critical
        ? "gbar gbar--blocker"
        : "gbar gbar--task";

  return <div className={barClass} style={col} aria-hidden />;
}

function NameCell({ row }: { row: GanttRow }) {
  const indent = row.level > 0 ? Math.min(row.level, 6) : 0;
  return (
    <div className="gantt2__cell gantt2__cell--name">
      {indent > 0 ? <span className={cn("wbs-indent", `wbs-indent--${indent}`)} aria-hidden /> : null}
      {row.collapsible ? (
        <button type="button" className="wbs-toggle" aria-label={row.collapsed ? "Развернуть" : "Свернуть"}>
          <ChevronRight className={cn("size-3", !row.collapsed && "rotate-90")} aria-hidden />
        </button>
      ) : null}
      {row.kind === "summary" ? (
        <strong className="wbs-name">{row.name}</strong>
      ) : (
        <span className="wbs-name">{row.name}</span>
      )}
    </div>
  );
}

function ChartHead1({ days, monthLabel }: { days: GanttDayHeader[]; monthLabel?: string }) {
  return (
    <div
      className="gantt2__chart-month"
      style={{ gridColumn: `1 / span ${days.length}` }}
    >
      {monthLabel ?? "Период"}
    </div>
  );
}

function ChartHead2({ days }: { days: GanttDayHeader[] }) {
  return (
    <>
      {days.map((d) => (
        <div
          key={d.day}
          className={cn("gantt2__chart-day", d.weekend && "gantt2__chart-day--weekend")}
        >
          {d.day}
        </div>
      ))}
    </>
  );
}

function WbsCells({ row, index }: { row: GanttRow; index: number }) {
  const resources =
    row.assignee && row.kind === "task" ? `Инициалы ${row.assignee.initials}` : "—";
  const labor = row.kind === "task" ? `${Math.round(row.durationDays * 8)}ч` : "—";

  return (
    <>
      <div className="gantt2__cell gantt2__cell--num">{index + 1}</div>
      <div className="gantt2__cell">
        <span className="wbs-mode">Авто</span>
      </div>
      <div className="gantt2__cell gantt2__cell--mono gantt2__cell--muted">{row.wbs ?? "—"}</div>
      <NameCell row={row} />
      <div className="gantt2__cell gantt2__cell--center">{durationLabel(row)}</div>
      <div className="gantt2__cell gantt2__cell--center">{pctLabel(row.progress)}</div>
      <div className="gantt2__cell gantt2__cell--mono gantt2__cell--center">{fakeDate(row.startDay)}</div>
      <div className="gantt2__cell gantt2__cell--mono gantt2__cell--center">
        {fakeDate(row.startDay + Math.max(row.durationDays - 1, 0))}
      </div>
      <div className="gantt2__cell gantt2__cell--center gantt2__cell--muted">—</div>
      <div className="gantt2__cell">{resources}</div>
      <div className="gantt2__cell gantt2__cell--right">{labor}</div>
    </>
  );
}

function ChartRowCell({ row, todayIndex, dayCount }: { row: GanttRow; todayIndex: number; dayCount: number }) {
  const chartGridStyle = {
    gridTemplateColumns: `repeat(${dayCount}, var(--gantt-day-w, 28px))`
  } as const;

  return (
    <div className="gantt2__cell gantt2__cell--chart" style={chartGridStyle}>
      {todayIndex >= 0 ? (
        <div className="gantt2__today" style={{ gridColumn: todayIndex + 1 }} aria-hidden />
      ) : null}
      <ChartBar row={row} />
    </div>
  );
}

export function Gantt({
  data,
  className,
  zoom = "day"
}: {
  data: GanttData;
  className?: string;
  zoom?: GanttZoom;
}) {
  const dayW = DAY_W_BY_ZOOM[zoom];
  const dayCount = data.days.length;
  const chartWidth = dayCount * dayW;
  const todayIndex = data.days.findIndex((d) => d.today);
  const zoomLabel = { hour: "час", day: "день", week: "неделя", month: "месяц" }[zoom];
  const chartGridStyle = {
    gridTemplateColumns: `repeat(${dayCount}, var(--gantt-day-w, 28px))`
  } as const;

  return (
    <div
      className={cn("gantt2", className)}
      role="grid"
      aria-label={`Диаграмма Ганта · ${data.monthLabel ?? ""} · масштаб: ${zoomLabel}`}
      data-gantt-zoom={zoom}
      style={
        {
          "--gantt-chart-w": `${chartWidth}px`,
          "--gantt-day-w": `${dayW}px`,
          "--gantt-day-count": String(dayCount)
        } as CSSProperties
      }
    >
      <div className="gantt2__split">
        <div className="gantt2__wbs" role="rowgroup" aria-label="Таблица WBS">
          <div className="gantt2__row gantt2__row--head1 gantt2__row--wbs" role="row">
            <div className="gantt2__cell gantt2__cell--num">#</div>
            <div className="gantt2__cell">Реж</div>
            <div className="gantt2__cell">WBS</div>
            <div className="gantt2__cell">Название задачи</div>
            <div className="gantt2__cell gantt2__cell--center">Длит.</div>
            <div className="gantt2__cell gantt2__cell--center">% зав.</div>
            <div className="gantt2__cell gantt2__cell--center">Начало</div>
            <div className="gantt2__cell gantt2__cell--center">Окончание</div>
            <div className="gantt2__cell gantt2__cell--center">Предш.</div>
            <div className="gantt2__cell">Ресурсы</div>
            <div className="gantt2__cell gantt2__cell--center">Труд.</div>
          </div>
          <div className="gantt2__row gantt2__row--head2 gantt2__row--wbs" role="row">
            <div className="gantt2__cell gantt2__cell--num">№</div>
            <div className="gantt2__cell" />
            <div className="gantt2__cell" />
            <div className="gantt2__cell" />
            <div className="gantt2__cell gantt2__cell--center">дни</div>
            <div className="gantt2__cell gantt2__cell--center">%</div>
            <div className="gantt2__cell gantt2__cell--center">дата</div>
            <div className="gantt2__cell gantt2__cell--center">дата</div>
            <div className="gantt2__cell gantt2__cell--center">#</div>
            <div className="gantt2__cell" />
            <div className="gantt2__cell gantt2__cell--center">ч</div>
          </div>
          {data.rows.map((row, index) => (
            <div
              key={row.id}
              className={cn(
                "gantt2__row",
                "gantt2__row--wbs",
                row.kind === "summary" && "gantt2__row--group",
                row.critical && row.kind === "task" && "gantt2__row--selected"
              )}
              role="row"
            >
              <WbsCells row={row} index={index} />
            </div>
          ))}
        </div>
        <div className="gantt2__chart-scroll" role="rowgroup" aria-label="График сроков">
          <div className="gantt2__chart-inner" style={{ width: chartWidth }}>
            <div className="gantt2__row gantt2__row--head1 gantt2__row--chart" role="row">
              <div className="gantt2__cell gantt2__cell--chart gantt2__cell--chart-head1" style={chartGridStyle}>
                <ChartHead1
                  days={data.days}
                  {...(data.monthLabel !== undefined ? { monthLabel: data.monthLabel } : {})}
                />
              </div>
            </div>
            <div className="gantt2__row gantt2__row--head2 gantt2__row--chart" role="row">
              <div className="gantt2__cell gantt2__cell--chart gantt2__cell--chart-head2" style={chartGridStyle}>
                <ChartHead2 days={data.days} />
              </div>
            </div>
            {data.rows.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "gantt2__row",
                  "gantt2__row--chart",
                  row.kind === "summary" && "gantt2__row--group",
                  row.critical && row.kind === "task" && "gantt2__row--selected"
                )}
                role="row"
              >
                <ChartRowCell row={row} todayIndex={todayIndex} dayCount={dayCount} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { GanttData, GanttRow } from "./types";
