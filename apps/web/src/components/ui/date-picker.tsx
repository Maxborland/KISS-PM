"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

export type DatePickerProps = {
  value?: Date | undefined;
  onChange?: (value: Date | undefined) => void;
  defaultValue?: Date;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
};

function formatDate(d: Date | null | undefined) {
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function DatePicker({
  value,
  onChange,
  defaultValue,
  placeholder = "Выберите дату",
  disabled,
  className,
  ...rest
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState<Date | undefined>(defaultValue);
  const current = onChange ? value : internal;

  const handleSelect = (d: Date | undefined) => {
    if (!onChange) setInternal(d);
    onChange?.(d);
    if (d) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={rest["aria-label"] ?? placeholder}
          aria-expanded={open}
          className={cn(
            "input flex w-full cursor-pointer items-center justify-between text-left",
            "disabled:cursor-not-allowed disabled:opacity-60",
            !current && "text-[var(--muted)]",
            className
          )}
        >
          <span>{current ? formatDate(current) : placeholder}</span>
          <CalendarIcon className="size-4 text-[var(--muted)]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="rdp-shell w-auto p-[var(--space-3)]">
        <DayPicker
          mode="single"
          locale={ru}
          weekStartsOn={1}
          showOutsideDays
          selected={current}
          onSelect={handleSelect}
          ISOWeek
          className="rdp-kiss"
          components={{
            Chevron: ({ orientation }) =>
              orientation === "left" ? (
                <ChevronLeft className="size-4" aria-hidden />
              ) : (
                <ChevronRight className="size-4" aria-hidden />
              )
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
