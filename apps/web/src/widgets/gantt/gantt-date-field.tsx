"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { dateLabelToDayIndex, dayIndexToDateLabel } from "./gantt-dates";

/** Demo calendar: май 2026 — day index 0 = 01.05.2026 */
function dayIndexToDate(dayIndex: number): Date {
  return new Date(2026, 4, dayIndex + 1);
}

function dateToDayIndex(date: Date): number | null {
  if (date.getFullYear() !== 2026 || date.getMonth() !== 4) return null;
  const day = date.getDate();
  if (day < 1 || day > 31) return null;
  return day - 1;
}

function labelToDate(label: string): Date | undefined {
  const idx = dateLabelToDayIndex(label);
  if (idx === null) return undefined;
  return dayIndexToDate(idx);
}

export function GanttDateField({
  value,
  disabled,
  className,
  ariaLabel,
  onChange,
  onBlurCommit
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  onChange: (label: string) => void;
  onBlurCommit?: (label: string) => void;
}) {
  const dateValue = labelToDate(value);

  return (
    <DatePicker
      {...(className ? { className } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
      aria-label={ariaLabel}
      placeholder="Выберите дату"
      {...(dateValue ? { value: dateValue } : {})}
      onChange={(d) => {
        if (!d) return;
        const idx = dateToDayIndex(d);
        if (idx === null) return;
        const label = dayIndexToDateLabel(idx);
        onChange(label);
        onBlurCommit?.(label);
      }}
    />
  );
}
