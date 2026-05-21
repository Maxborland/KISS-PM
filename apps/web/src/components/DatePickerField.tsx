"use client"

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [displayValue, setDisplayValue] = useState(formatDateDisplay(props.value));
  const [isFocused, setIsFocused] = useState(false);
  const selectedDate = parseDateInput(props.value);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatDateDisplay(props.value));
    }
  }, [isFocused, props.value]);

  function commitManualValue(nextValue: string) {
    const parsed = parseFlexibleDateInput(nextValue);
    if (!nextValue.trim()) {
      props.onChange("");
      setDisplayValue("");
      return;
    }
    if (!parsed) {
      props.onChange(nextValue);
      setDisplayValue(nextValue);
      return;
    }

    const formatted = formatDateInput(parsed);
    props.onChange(formatted);
    setDisplayValue(formatDateDisplay(formatted));
  }

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
          placeholder="27.03.2034"
          type="text"
          value={displayValue}
          onBlur={() => {
            setIsFocused(false);
            commitManualValue(displayValue);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDisplayValue(nextValue);
            const parsed = parseFlexibleDateInput(nextValue);
            if (parsed) props.onChange(formatDateInput(parsed));
            if (!nextValue.trim()) props.onChange("");
          }}
          onFocus={() => setIsFocused(true)}
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
                const formatted = formatDateInput(date);
                props.onChange(formatted);
                setDisplayValue(formatDateDisplay(formatted));
                setIsOpen(false);
              }}
            />
            <div className="date-picker-footer">
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => {
                  props.onChange("");
                  setDisplayValue("");
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
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/.exec(value.trim());
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

function parseRussianDateInput(value: string): Date | undefined {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
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

function parseFlexibleDateInput(value: string): Date | undefined {
  return parseDateInput(value) ?? parseRussianDateInput(value);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value: string): string {
  const date = parseDateInput(value);
  if (!date) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}
