"use client";

import type { CSSProperties } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import type { GanttData, GanttDayHeader, GanttRow } from "./types";

const DAY_W = 28;

function pctLabel(progress: number | undefined) {
  const p = Math.round((progress ?? 0) * 100);
  return `${p}%`;
}

function durationLabel(row: GanttRow) {
  if (row.kind === "milestone") return "0д";
  return `${row.durationDays}д`;
}

function ChartBar({ row, todayIndex }: { row: GanttRow; todayIndex: number }) {
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

function DataRow({
  row,
  index,
  todayIndex,
  selected,
  onSelect
}: {
  row: GanttRow;
  index: number;
  todayIndex: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const resources = row.kind === "task" ? row.resourceName ?? "—" : "—";
  const labor =
    row.kind === "task" && row.workMinutes != null ? `${Math.round(row.workMinutes / 60)}ч` : "—";
  const interactive = Boolean(onSelect);

  return (
    <div
      className={cn(
        "gantt2__row",
        row.kind === "summary" && "gantt2__row--group",
        ((row.critical && row.kind === "task") || selected) && "gantt2__row--selected",
        interactive && "cursor-pointer"
      )}
      role="row"
      {...(interactive
        ? { onClick: () => onSelect?.(row.id), tabIndex: 0, "aria-selected": selected, "data-selected": selected ? "true" : undefined }
        : {})}
    >
      <div className="gantt2__cell gantt2__cell--num">{index + 1}</div>
      <div className="gantt2__cell">
        <span className="wbs-mode">{row.mode ?? "Авто"}</span>
      </div>
      <div className="gantt2__cell gantt2__cell--mono gantt2__cell--muted">{row.wbs ?? "—"}</div>
      <NameCell row={row} />
      <div className="gantt2__cell gantt2__cell--center">{durationLabel(row)}</div>
      <div className="gantt2__cell gantt2__cell--center">{pctLabel(row.progress)}</div>
      <div className="gantt2__cell gantt2__cell--mono gantt2__cell--center">{row.startLabel ?? "—"}</div>
      <div className="gantt2__cell gantt2__cell--mono gantt2__cell--center">{row.finishLabel ?? "—"}</div>
      <div className="gantt2__cell gantt2__cell--center gantt2__cell--muted">{row.predecessorLabel ?? "—"}</div>
      <div className="gantt2__cell">{resources}</div>
      <div className="gantt2__cell gantt2__cell--right">{labor}</div>
      <div className="gantt2__cell gantt2__cell--chart">
        {todayIndex >= 0 ? (
          <div
            className="gantt2__today"
            style={{ gridColumn: todayIndex + 1 }}
            aria-hidden
          />
        ) : null}
        <ChartBar row={row} todayIndex={todayIndex} />
      </div>
    </div>
  );
}

export function Gantt({ data, className, selectedId, onSelectRow }: { data: GanttData; className?: string; selectedId?: string | null; onSelectRow?: (id: string) => void }) {
  const totalDays = data.days.length;
  const chartWidth = totalDays * DAY_W;
  const todayIndex = data.days.findIndex((d) => d.today);

  return (
    <div
      className={cn("gantt2", className)}
      role="grid"
      aria-label={`Диаграмма Ганта · ${data.monthLabel ?? ""}`}
      style={
        {
          "--gantt-chart-w": `${chartWidth}px`,
          "--gantt-day-w": `${DAY_W}px`
        } as CSSProperties
      }
    >
      <div className="gantt2__inner">
        <div className="gantt2__row gantt2__row--head1" role="row">
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
          <div className="gantt2__cell gantt2__cell--chart gantt2__cell--chart-head1">
            <ChartHead1
              days={data.days}
              {...(data.monthLabel !== undefined ? { monthLabel: data.monthLabel } : {})}
            />
          </div>
        </div>
        <div className="gantt2__row gantt2__row--head2" role="row">
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
          <div className="gantt2__cell gantt2__cell--chart gantt2__cell--chart-head2">
            <ChartHead2 days={data.days} />
          </div>
        </div>
        {data.rows.map((row, index) => (
          <DataRow
            key={row.id}
            row={row}
            index={index}
            todayIndex={todayIndex}
            selected={selectedId === row.id}
            {...(onSelectRow ? { onSelect: onSelectRow } : {})}
          />
        ))}
      </div>
    </div>
  );
}

export type { GanttData, GanttRow } from "./types";
