import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type NumericValueProps = {
  value: ReactNode;
  suffix?: string;
  className?: string;
};

/** Числовое KPI-значение с tabular nums. */
export function NumericValue({ value, suffix, className }: NumericValueProps) {
  return (
    <span className={cn("numeric-value mono", className)}>
      {value}
      {suffix ? <span className="numeric-value__suffix">{suffix}</span> : null}
    </span>
  );
}
