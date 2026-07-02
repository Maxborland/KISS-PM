"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
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

/**
 * Общий pointer-drag: возвращает текущий сдвиг в px и onPointerDown. Слушатели window снимаются
 * и на pointerup (тогда commit), и на РАЗМОНТИРОВАНИИ (без commit) — иначе при исчезновении строки
 * во время перетаскивания оставались бы висящие слушатели + применялся бы чужой сдвиг задачи.
 */
function usePointerDragDx(onCommit: (dayDelta: number) => void) {
  const [dx, setDx] = useState<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    setDx(0);
    const onMove = (moveEvent: globalThis.PointerEvent) => setDx(moveEvent.clientX - startX);
    const teardown = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cleanupRef.current = null;
      setDx(null);
    };
    const onUp = (upEvent: globalThis.PointerEvent) => {
      teardown();
      const delta = dayDeltaFromDrag(upEvent.clientX - startX, DAY_W);
      if (delta !== 0) onCommit(delta);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    cleanupRef.current = teardown;
  };
  return { dx, onPointerDown };
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

/**
 * Единый overlay-слой стрелок связей поверх всей чарт-области.
 * P0-6: вынесен ИЗ строк, поэтому content-visibility на строках (виртуализация) не режет линии.
 * Координаты — в системе .gantt2__inner: x = chartLeft + dayX, y = headerH + rowIndex·ROW_H + ROW_H/2.
 */
function DependencyOverlay({
  arrows,
  chartLeft,
  headerH
}: {
  arrows: DependencyArrow[];
  chartLeft: number;
  headerH: number;
}) {
  if (arrows.length === 0) return null;
  const yOf = (rowIndex: number) => headerH + rowIndex * ROW_H + ROW_H / 2;
  return (
    <svg
      className="gantt2__deps"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 2 }}
      aria-hidden
    >
      {arrows.map((arrow) => {
        const x1 = chartLeft + arrow.fromX;
        const y1 = yOf(arrow.fromRow);
        const x2 = chartLeft + arrow.toX;
        const y2 = yOf(arrow.toRow);
        const gap = 8;
        const elbowX = Math.max(x1 + gap, x2 - gap);
        const d = `M ${x1} ${y1} H ${elbowX} V ${y2} H ${x2}`;
        return (
          <g key={arrow.key}>
            <path className="gdep__line" d={d} fill="none" />
            <path className="gdep__arrow" d={`M ${x2} ${y2} l -5 -3 v 6 z`} />
          </g>
        );
      })}
    </svg>
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

function ChartBar({
  row,
  onMoveTask,
  onResizeTask
}: {
  row: GanttRow;
  onMoveTask?: (id: string, dayDelta: number) => void;
  onResizeTask?: (id: string, dayDelta: number) => void;
}) {
  const start = row.startDay + 1;
  const span = Math.max(row.durationDays, 1);
  const col = { gridColumn: `${start} / span ${span}` } as const;
  const move = usePointerDragDx((delta) => onMoveTask?.(row.id, delta));
  const resize = usePointerDragDx((delta) => onResizeTask?.(row.id, delta));

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

  // P0-2: перетаскивание — только листовые задачи; сводные/вехи не двигаем.
  const draggable = Boolean(onMoveTask) && row.kind === "task";
  const resizable = Boolean(onResizeTask) && row.kind === "task";

  const style: CSSProperties =
    move.dx !== null
      ? { ...col, transform: `translateX(${move.dx}px)`, cursor: "grabbing" }
      : resize.dx !== null
        ? { ...col, width: `calc(100% + ${resize.dx}px)` }
        : draggable
          ? { ...col, cursor: "grab" }
          : col;

  return (
    <div
      className={barClass}
      style={style}
      aria-hidden
      {...(draggable ? { onPointerDown: move.onPointerDown } : {})}
    >
      {progressPct > 0 ? <div className="gbar__progress" style={{ width: `${progressPct}%` }} /> : null}
      {resizable ? (
        <span
          className="gbar__resize"
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize" }}
          onPointerDown={(event) => {
            event.stopPropagation(); // не двигаем весь бар
            resize.onPointerDown(event);
          }}
        />
      ) : null}
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
  onResizeTask
}: {
  row: GanttRow;
  index: number;
  todayIndex: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onToggleCollapse?: (id: string) => void;
  onMoveTask?: (id: string, dayDelta: number) => void;
  onResizeTask?: (id: string, dayDelta: number) => void;
}) {
  const resources = row.kind === "task" ? row.resourceName ?? "—" : "—";
  const labor =
    row.kind === "task" && row.workMinutes != null ? `${Math.round(row.workMinutes / 60)}ч` : "—";
  const interactive = Boolean(onSelect);
  // UX-009: резерв времени (slack) в tooltip строки — 0 у критического пути.
  const slackTitle = row.slackDays != null ? `Резерв: ${row.slackDays} дн.` : undefined;

  return (
    <div
      className={cn(
        "gantt2__row",
        row.kind === "summary" && "gantt2__row--group",
        ((row.critical && row.kind === "task") || selected) && "gantt2__row--selected",
        interactive && "cursor-pointer"
      )}
      role="row"
      {...(slackTitle ? { title: slackTitle } : {})}
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
        <ChartBar row={row} {...(onMoveTask ? { onMoveTask } : {})} {...(onResizeTask ? { onResizeTask } : {})} />
      </div>
    </div>
  );
}

export function Gantt({ data, className, selectedId, onSelectRow, onToggleCollapse, onMoveTask, onResizeTask }: { data: GanttData; className?: string; selectedId?: string | null; onSelectRow?: (id: string) => void; onToggleCollapse?: (id: string) => void; onMoveTask?: (id: string, dayDelta: number) => void; onResizeTask?: (id: string, dayDelta: number) => void }) {
  const totalDays = data.days.length;
  const chartWidth = totalDays * DAY_W;
  const todayIndex = data.days.findIndex((d) => d.today);
  // useMemo: не пересчитывать все стрелки на ре-рендерах, где data.rows не менялся (клик/selectedId).
  const arrows = useMemo(() => computeDependencyArrows(data.rows, DAY_W), [data.rows]);
  const innerRef = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<{ chartLeft: number; headerH: number } | null>(null);

  // Измеряем смещение чарт-области и высоту шапки в системе .gantt2__inner, чтобы позиционировать
  // overlay стрелок независимо от гибкой ширины колонки «Название» и горизонтального скролла.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => {
      const innerRect = inner.getBoundingClientRect();
      const headChart = inner.querySelector<HTMLElement>(".gantt2__row--head2 .gantt2__cell--chart");
      const firstDataRow = inner.querySelector<HTMLElement>(
        ".gantt2__row:not(.gantt2__row--head1):not(.gantt2__row--head2)"
      );
      if (!headChart || !firstDataRow) return;
      const chartLeft = headChart.getBoundingClientRect().left - innerRect.left;
      const headerH = firstDataRow.getBoundingClientRect().top - innerRect.top;
      setGeom((prev) =>
        prev && prev.chartLeft === chartLeft && prev.headerH === headerH ? prev : { chartLeft, headerH }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [data.days.length, data.rows.length]);

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
      <div className="gantt2__inner" ref={innerRef}>
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
            {...(onToggleCollapse ? { onToggleCollapse } : {})}
            {...(onMoveTask ? { onMoveTask } : {})}
            {...(onResizeTask ? { onResizeTask } : {})}
          />
        ))}
        {geom ? <DependencyOverlay arrows={arrows} chartLeft={geom.chartLeft} headerH={geom.headerH} /> : null}
      </div>
    </div>
  );
}

export type { GanttData, GanttRow } from "./types";
