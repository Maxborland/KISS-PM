"use client";

import type { ReactNode } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { formatDateRange } from "@/lib/mock-data/format";
import { cn } from "@/lib/cn";

export type DateRangeProps = {
  mode?: "display" | "edit";
  start?: string | null;
  finish?: string | null;
  startDate?: Date;
  finishDate?: Date;
  onStartChange?: (value: Date | undefined) => void;
  onFinishChange?: (value: Date | undefined) => void;
  startLabel?: string;
  finishLabel?: string;
  className?: string;
  actions?: ReactNode;
};

/** Диапазон дат: read-only текст или два DatePicker. */
export function DateRange({
  mode = "display",
  start = null,
  finish = null,
  startDate,
  finishDate,
  onStartChange,
  onFinishChange,
  startLabel = "Начало",
  finishLabel = "Окончание",
  className,
  actions
}: DateRangeProps) {
  if (mode === "display") {
    return (
      <div className={cn("date-range", className)}>
        <span className="date-range__label">{startLabel} — {finishLabel}</span>
        <span className="date-range__text mono">{formatDateRange(start, finish)}</span>
        {actions}
      </div>
    );
  }

  return (
    <div className={cn("date-range date-range--inline", className)}>
      <div className="date-range__field">
        <span className="date-range__label">{startLabel}</span>
        <DatePicker
          value={startDate}
          {...(onStartChange ? { onChange: onStartChange } : {})}
          placeholder="Дата начала"
          aria-label={startLabel}
        />
      </div>
      <div className="date-range__field">
        <span className="date-range__label">{finishLabel}</span>
        <DatePicker
          value={finishDate}
          {...(onFinishChange ? { onChange: onFinishChange } : {})}
          placeholder="Дата окончания"
          aria-label={finishLabel}
        />
      </div>
      {actions}
    </div>
  );
}
