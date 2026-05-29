import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type NumericValueProps = {
  value: ReactNode;
  unit?: string;
  className?: string;
};

/** Число с tabular nums для таблиц, KPI и метрик. */
export function NumericValue({ value, unit, className }: NumericValueProps) {
  return (
    <span className={cn("numeric-value mono", className)}>
      <span className="numeric-value__main">{value}</span>
      {unit ? <span className="numeric-value__unit">{unit}</span> : null}
    </span>
  );
}
