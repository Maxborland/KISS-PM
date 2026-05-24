"use client";

import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  className?: string;
};

export function Segmented<T extends string>({ options, value, onChange, name, className }: SegmentedProps<T>) {
  return (
    <div className={cn("segmented", className)} role="radiogroup">
      {options.map((opt) => (
        <label key={opt.value} className={cn("segmented__btn", value === opt.value && "is-active")}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
