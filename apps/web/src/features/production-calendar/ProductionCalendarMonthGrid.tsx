"use client";

import { useMemo } from "react";

import type { ProductionCalendarException } from "./useProductionCalendar";

const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function ProductionCalendarMonthGrid(props: {
  year: number;
  exceptions: ProductionCalendarException[];
  workingWeekdays: number[];
  workingMinutesPerDay: number;
  onToggleDay: (date: string, current: ProductionCalendarException | null) => void;
  disabled?: boolean;
}) {
  const exceptionsByDate = useMemo(() => {
    const map = new Map<string, ProductionCalendarException>();
    for (const item of props.exceptions) {
      if (!item.resourceId) map.set(item.date, item);
    }
    return map;
  }, [props.exceptions]);

  return (
    <div className="production-calendar-grid" data-testid="production-calendar-grid">
      {MONTH_LABELS.map((monthLabel, monthIndex) => (
        <MonthBlock
          key={monthLabel}
          monthLabel={monthLabel}
          year={props.year}
          monthIndex={monthIndex}
          exceptionsByDate={exceptionsByDate}
          workingWeekdays={props.workingWeekdays}
          workingMinutesPerDay={props.workingMinutesPerDay}
          onToggleDay={props.onToggleDay}
          disabled={props.disabled ?? false}
        />
      ))}
    </div>
  );
}

function MonthBlock(props: {
  monthLabel: string;
  year: number;
  monthIndex: number;
  exceptionsByDate: Map<string, ProductionCalendarException>;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
  onToggleDay: (date: string, current: ProductionCalendarException | null) => void;
  disabled: boolean;
}) {
  const cells = useMemo(
    () => buildMonthCells(props.year, props.monthIndex),
    [props.year, props.monthIndex]
  );
  const workingSet = useMemo(() => new Set(props.workingWeekdays), [props.workingWeekdays]);

  return (
    <section className="production-calendar-month" aria-label={props.monthLabel}>
      <header>
        <h3>{props.monthLabel}</h3>
      </header>
      <div className="production-calendar-month__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="production-calendar-month__cells">
        {cells.map((cell) => {
          if (!cell) {
            return <span key={`empty-${Math.random()}`} className="production-calendar-cell is-empty" />;
          }
          const exception = props.exceptionsByDate.get(cell.dateIso) ?? null;
          const baseWorkingMinutes = workingSet.has(cell.weekdayIso)
            ? props.workingMinutesPerDay
            : 0;
          const effectiveMinutes = exception ? exception.workingMinutes : baseWorkingMinutes;
          const isHoliday = effectiveMinutes === 0;
          const isOverridden = exception !== null;
          const classes = [
            "production-calendar-cell",
            isHoliday ? "is-holiday" : "is-working",
            isOverridden ? "is-overridden" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={cell.dateIso}
              type="button"
              className={classes}
              data-date={cell.dateIso}
              data-testid={`production-calendar-day-${cell.dateIso}`}
              title={exception?.reason ?? (isHoliday ? "Нерабочий день" : "Рабочий день")}
              disabled={props.disabled}
              onClick={() => props.onToggleDay(cell.dateIso, exception)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type MonthCell = {
  day: number;
  dateIso: string;
  weekdayIso: number;
};

function buildMonthCells(year: number, monthIndex: number): Array<MonthCell | null> {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstWeekdayIso = isoWeekday(firstDay.getUTCDay());
  const leadingEmpty = firstWeekdayIso - 1;
  const cells: Array<MonthCell | null> = [];
  for (let index = 0; index < leadingEmpty; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    cells.push({
      day,
      dateIso: toIsoDate(date),
      weekdayIso: isoWeekday(date.getUTCDay())
    });
  }
  return cells;
}

function isoWeekday(jsWeekday: number): number {
  return jsWeekday === 0 ? 7 : jsWeekday;
}

function toIsoDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
