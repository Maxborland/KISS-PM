import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

export type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  className?: string;
};

/** Горизонтальный индикатор прогресса (Radix Progress). */
export function ProgressBar({ value, max = 100, label, className }: ProgressBarProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const pct = max > 0 ? Math.round((clamped / max) * 100) : 0;

  return (
    <div className={cn("progress-bar", className)}>
      {label ? (
        <div className="progress-bar__head">
          <span className="progress-bar__label">{label}</span>
          <span className="progress-bar__value mono">{pct}%</span>
        </div>
      ) : null}
      <ProgressPrimitive.Root
        className="progress-bar__track"
        value={clamped}
        max={max}
        aria-label={label ?? `Прогресс ${pct} процентов`}
        style={{ "--progress-pct": `${pct}%` } as CSSProperties}
      >
        <ProgressPrimitive.Indicator className="progress-bar__fill" />
      </ProgressPrimitive.Root>
    </div>
  );
}
