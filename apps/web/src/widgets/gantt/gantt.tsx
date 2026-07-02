"use client";

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import type { GanttData, GanttDayHeader, GanttRow } from "./types";

const DAY_W = 28;
const ROW_H = 28; // высота строки-данных (min-height .gantt2__row)

/** Смещение бара в днях при drag: пиксели / ширину дня, округлённо. Малый сдвиг (клик) → 0. */
export function dayDeltaFromDrag(deltaX: number, dayWidth: number): number {
  if (dayWidth <= 0) return 0;
  return Math.round(deltaX / dayWidth) || 0; // `|| 0` нормализует -0 → 0
}

export type DependencyArrow = {
  key: string;
  /** индекс строки-предшественника среди видимых */
  fromRow: number;
  /** индекс строки-преемника */
  toRow: number;
  /** X конца бара предшественника (px от левого края чарт-области) */
  fromX: number;
  /** X начала бара преемника (px) */
  toX: number;
};

/**
 * Геометрия стрелок связей FS: от конца бара предшественника к началу бара преемника.
 * Предшественники вне видимых строк (свёрнуты) пропускаются. Чистая функция — тестируется без рендера.
 */
export function computeDependencyArrows(rows: readonly GanttRow[], dayWidth: number): DependencyArrow[] {
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const arrows: DependencyArrow[] = [];
  rows.forEach((row, toRow) => {
    for (const predId of row.predecessorIds ?? []) {
      const fromRow = indexById.get(predId);
      if (fromRow === undefined) continue;
      const pred = rows[fromRow];
      if (!pred) continue;
      arrows.push({
        key: `${predId}->${row.id}`,
        fromRow,
        toRow,
        fromX: (pred.startDay + Math.max(pred.durationDays, 1)) * dayWidth,
        toX: row.startDay * dayWidth
      });
    }
  });
  return arrows;
}

/** Рисует входящие стрелки связей в чарт-ячейке строки-преемника (predecessor выше по списку). */
function DependencyArrows({ arrows }: { arrows: DependencyArrow[] }) {
  if (arrows.length === 0) return null;
  const yMid = ROW_H / 2;
  return (
    <>
      {arrows.map((arrow) => {
        const rowDelta = arrow.toRow - arrow.fromRow; // >0 — предшественник выше
        const yFrom = yMid - rowDelta * ROW_H;
        const gap = 8;
        const elbowX = Math.max(arrow.fromX + gap, arrow.toX - gap);
        const d = `M ${arrow.fromX} ${yFrom} H ${elbowX} V ${yMid} H ${arrow.toX}`;
        return (
          <svg key={arrow.key} className="gdep" style={{ top: 0, left: 0, width: "var(--gantt-chart-w)", height: ROW_H, overflow: "visible" }} aria-hidden>
            <path className="gdep__line" d={d} />
            <path className="gdep__arrow" d={`M ${arrow.toX} ${yMid} l -5 -3 v 6 z`} />
          </svg>
        );
      })}
    </>
  );
}

/**
 * Скрывает строки, чей любой предок свёрнут (collapsedIds), и выставляет collapsed на свёрнутых.
 * Чистая функция — легко тестируется без рендера.
 */
export function applyCollapse<T extends { id: string; parentId?: string; collapsed?: boolean }>(
  rows: readonly T[],
  collapsedIds: ReadonlySet<string>
): T[] {
  if (collapsedIds.size === 0) return [...rows];
  const parentById = new Map(rows.map((row) => [row.id, row.parentId]));
  const hiddenByCollapse = (row: T): boolean => {
    let ancestor = row.parentId;
    while (ancestor) {
      if (collapsedIds.has(ancestor)) return true;
      ancestor = parentById.get(ancestor);
    }
    return false;
  };
  return rows
    .filter((row) => !hiddenByCollapse(row))
    .map((row) => (collapsedIds.has(row.id) ? { ...row, collapsed: true } : row));
}

function pctLabel(progress: number | undefined) {
  const p = Math.round((progress ?? 0) * 100);
  return `${p}%`;
}

function durationLabel(row: GanttRow) {
  if (row.kind === "milestone") return "0д";
  return `${row.durationDays}д`;
}

function ChartBar({ row, onMoveTask }: { row: GanttRow; onMoveTask?: (id: string, dayDelta: number) => void }) {
  const start = row.startDay + 1;
  const span = Math.max(row.durationDays, 1);
  const col = { gridColumn: `${start} / span ${span}` } as const;
  const [dragDx, setDragDx] = useState<number | null>(null);

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

  // UX-008: заливка прогресса прямо в баре (как в MS Project), а не только цифрой в колонке.
  const progressPct = Math.round(Math.max(0, Math.min(1, row.progress ?? 0)) * 100);

  // P0-2: перетаскивание бара задачи по времени (только листовые задачи; сводные/вехи не двигаем).
  const draggable = Boolean(onMoveTask) && row.kind === "task";
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    event.preventDefault();
    const startX = event.clientX;
    setDragDx(0);
    const onMove = (moveEvent: globalThis.PointerEvent) => setDragDx(moveEvent.clientX - startX);
    const onUp = (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragDx(null);
      const delta = dayDeltaFromDrag(upEvent.clientX - startX, DAY_W);
      if (delta !== 0) onMoveTask?.(row.id, delta);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const style: CSSProperties =
    dragDx !== null
      ? { ...col, transform: `translateX(${dragDx}px)`, cursor: "grabbing" }
      : draggable
        ? { ...col, cursor: "grab" }
        : col;

  return (
    <div
      className={barClass}
      style={style}
      aria-hidden
      {...(draggable ? { onPointerDown: handlePointerDown } : {})}
    >
      {progressPct > 0 ? <div className="gbar__progress" style={{ width: `${progressPct}%` }} /> : null}
    </div>
  );
}

function NameCell({ row, onToggleCollapse }: { row: GanttRow; onToggleCollapse?: (id: string) => void }) {
  const indent = row.level > 0 ? Math.min(row.level, 6) : 0;
  return (
    <div className="gantt2__cell gantt2__cell--name">
      {indent > 0 ? <span className={cn("wbs-indent", `wbs-indent--${indent}`)} aria-hidden /> : null}
      {row.collapsible ? (
        <button
          type="button"
          className="wbs-toggle"
          aria-label={row.collapsed ? "Развернуть" : "Свернуть"}
          aria-expanded={!row.collapsed}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse?.(row.id);
          }}
        >
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
      {days.map((d, index) => (
        <div
          key={d.iso ?? index}
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
  onSelect,
  onToggleCollapse,
  onMoveTask,
  arrows
}: {
  row: GanttRow;
  index: number;
  todayIndex: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onToggleCollapse?: (id: string) => void;
  onMoveTask?: (id: string, dayDelta: number) => void;
  arrows?: DependencyArrow[];
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
      <NameCell row={row} {...(onToggleCollapse ? { onToggleCollapse } : {})} />
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
        <ChartBar row={row} {...(onMoveTask ? { onMoveTask } : {})} />
        {arrows && arrows.length > 0 ? <DependencyArrows arrows={arrows} /> : null}
      </div>
    </div>
  );
}

export function Gantt({ data, className, selectedId, onSelectRow, onToggleCollapse, onMoveTask }: { data: GanttData; className?: string; selectedId?: string | null; onSelectRow?: (id: string) => void; onToggleCollapse?: (id: string) => void; onMoveTask?: (id: string, dayDelta: number) => void }) {
  const totalDays = data.days.length;
  const chartWidth = totalDays * DAY_W;
  const todayIndex = data.days.findIndex((d) => d.today);
  const arrowsByToRow = new Map<number, DependencyArrow[]>();
  for (const arrow of computeDependencyArrows(data.rows, DAY_W)) {
    arrowsByToRow.set(arrow.toRow, [...(arrowsByToRow.get(arrow.toRow) ?? []), arrow]);
  }

  return (
    <div
      className={cn("gantt2", className)}
      role="grid"
      aria-label={`Диаграмма Ганта · ${data.monthLabel ?? ""}`}
      style={
        {
          "--gantt-chart-w": `${chartWidth}px`,
          "--gantt-day-w": `${DAY_W}px`,
          "--gantt-days": `${totalDays}`
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
            arrows={arrowsByToRow.get(index) ?? []}
            {...(onSelectRow ? { onSelect: onSelectRow } : {})}
            {...(onToggleCollapse ? { onToggleCollapse } : {})}
            {...(onMoveTask ? { onMoveTask } : {})}
          />
        ))}
      </div>
    </div>
  );
}

export type { GanttData, GanttRow } from "./types";
