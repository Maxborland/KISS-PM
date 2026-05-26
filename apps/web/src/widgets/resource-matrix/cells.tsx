"use client";

import { cn } from "@/lib/cn";
import type { DayLoadLevel } from "./load-level";
import type { DayCell, DayHeader } from "./types";

function loadToneClass(level: DayLoadLevel): string {
  if (level === "over") return "rmatrix__cell--load-over";
  if (level === "high") return "rmatrix__cell--load-high";
  return "rmatrix__cell--load-normal";
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** Шапка матрицы — числа дней (1..31). */
export function DayHeadCell({ day }: { day: DayHeader }) {
  return (
    <div
      className={cn(
        "rmatrix__cell",
        "rmatrix__cell--day-head",
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

/** Ячейка с дневной нагрузкой — единый контейнер на все состояния. */
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
  const base = cn("rmatrix__cell", "rmatrix__cell--day", todayClass);

  switch (cell.kind) {
    case "weekend":
      return (
        <div
          className={cn(base, "rmatrix__cell--weekend")}
          aria-hidden
          title={weekday ? `${weekday}, выходной` : "Выходной"}
        />
      );
    case "holiday":
      return (
        <div
          className={cn(base, "rmatrix__cell--holiday")}
          title={weekday ? `${weekday}, праздник` : "Праздник"}
        />
      );
    case "vacation":
      return (
        <div
          className={cn(base, "rmatrix__cell--vacation")}
          title={weekday ? `${weekday}, отпуск` : "Отпуск"}
        />
      );
    case "zero":
      return (
        <div
          className={cn(base, "rmatrix__cell--load-zero")}
          aria-label={weekday ? `${weekday}, нет нагрузки` : "Нет нагрузки"}
        >
          —
        </div>
      );
    case "load": {
      const level = cell.level;
      const label = `${weekday ? `${weekday}: ` : ""}${cell.hours} ч`;
      return (
        <div className={cn(base, loadToneClass(level))} title={label}>
          <span className={cn("rmatrix__day-num", `rmatrix__day-num--${level}`)}>
            {formatHours(cell.hours)}
          </span>
        </div>
      );
    }
  }
}
