"use client";

import { HeatmapCell } from "@/components/domain/heatmap-cell";
import { cn } from "@/lib/cn";
import type { DayCell, DayHeader } from "./types";

function loadHeatLevel(level: "normal" | "high" | "over"): 0 | 1 | 2 | 3 | 4 {
  if (level === "over") return 4;
  if (level === "high") return 3;
  return 2;
}

/** Шапка матрицы — числа дней (1..31). */
export function DayHeadCell({ day }: { day: DayHeader }) {
  return (
    <div
      className={cn(
        "rmatrix__cell",
        day.weekend && "rmatrix__cell--weekend",
        day.holiday && "rmatrix__cell--holiday",
        day.today && "rmatrix__cell--today"
      )}
      title={day.weekdayShort ? `${day.weekdayShort}, ${day.day}` : undefined}
    >
      {day.day}
    </div>
  );
}

/** Ячейка с дневной нагрузкой. */
export function DayValueCell({
  cell,
  isToday = false,
  weekday = ""
}: {
  cell: DayCell;
  isToday?: boolean;
  weekday?: string;
}) {
  const todayClass = isToday ? "rmatrix__cell--today" : "";

  switch (cell.kind) {
    case "weekend":
      return (
        <div className={cn("rmatrix__cell", "rmatrix__cell--weekend", todayClass)} aria-hidden />
      );
    case "holiday":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--holiday", todayClass)}
          title="Праздник"
        />
      );
    case "vacation":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--vacation", todayClass)}
          title="Отпуск"
        />
      );
    case "zero":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--num-zero", todayClass)}
          aria-label={weekday ? `${weekday}, нет нагрузки` : "Нет нагрузки"}
        >
          ·
        </div>
      );
    case "load":
      return (
        <div
          className={cn(
            "rmatrix__cell",
            "rmatrix__cell--heatmap",
            cell.level === "over" && "rmatrix__cell--num-over",
            todayClass
          )}
          title={`${cell.hours} ч`}
        >
          <HeatmapCell
            value={Number.isInteger(cell.hours) ? cell.hours : cell.hours.toFixed(1)}
            level={loadHeatLevel(cell.level)}
            title={`${weekday ? `${weekday}: ` : ""}${cell.hours} ч`}
            className="rmatrix__heatmap"
          />
        </div>
      );
  }
}
