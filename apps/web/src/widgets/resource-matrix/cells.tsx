"use client";

import { cn } from "@/lib/cn";
import type { DayCell, DayHeader } from "./types";

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
  switch (cell.kind) {
    case "weekend":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--weekend", isToday && "rmatrix__cell--today")}
          aria-hidden
        />
      );
    case "holiday":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--holiday", isToday && "rmatrix__cell--today")}
          title="Праздник"
        />
      );
    case "vacation":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--vacation", isToday && "rmatrix__cell--today")}
          title="Отпуск"
        />
      );
    case "zero":
      return (
        <div
          className={cn("rmatrix__cell", "rmatrix__cell--num-zero", isToday && "rmatrix__cell--today")}
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
            cell.level === "normal" && "rmatrix__cell--num-normal",
            cell.level === "high" && "rmatrix__cell--num-high",
            cell.level === "over" && "rmatrix__cell--num-over",
            isToday && "rmatrix__cell--today"
          )}
          title={`${cell.hours} ч`}
        >
          {Number.isInteger(cell.hours) ? cell.hours : cell.hours.toFixed(1)}
        </div>
      );
  }
}
