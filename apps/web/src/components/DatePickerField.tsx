"use client"

import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function DatePickerField(props: {
  describedBy?: string | undefined;
  disabled?: boolean | undefined;
  id: string;
  invalid?: boolean | undefined;
  label: string;
  name?: string | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateInput(props.value);

  return (
    <span className="date-picker-field">
      <label htmlFor={props.id}>{props.label}</label>
      <span className="date-picker-control">
        <input
          aria-describedby={props.describedBy}
          aria-invalid={props.invalid}
          disabled={props.disabled}
          id={props.id}
          inputMode="numeric"
          name={props.name}
          placeholder="2034-03-27"
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Открыть календарь"
              className="date-picker-trigger"
              disabled={props.disabled}
              title={`Открыть календарь: ${props.label}`}
              type="button"
            >
              <CalendarDays aria-hidden="true" size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="date-picker-popover" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (!date) return;
                props.onChange(formatDateInput(date));
                setIsOpen(false);
              }}
            />
            <div className="date-picker-footer">
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => {
                  props.onChange("");
                  setIsOpen(false);
                }}
              >
                Очистить
              </button>
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </span>
    </span>
  );
}

function parseDateInput(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
