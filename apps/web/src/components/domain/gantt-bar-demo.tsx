import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

export type GanttBarDemoVariant = "default" | "at-risk" | "overdue";

export type GanttBarDemoProps = {
  label: string;
  progress?: number;
  variant?: GanttBarDemoVariant;
  className?: string;
};

/**
 * Демо-полоса для каталога Composites / Storybook.
 * Не путать с интерактивной полосой `GanttChartBar` в `widgets/gantt`.
 */
export function GanttBarDemo({ label, progress = 0, variant = "default", className }: GanttBarDemoProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className={cn(
        "gantt-bar-demo",
        variant === "at-risk" && "gantt-bar-demo--at-risk",
        variant === "overdue" && "gantt-bar-demo--overdue",
        className
      )}
      role="img"
      aria-label={`${label}, ${pct}%`}
      style={{ "--gantt-bar-demo-pct": `${pct}%` } as CSSProperties}
    >
      {pct > 0 ? <span className="gantt-bar-demo__progress" aria-hidden /> : null}
      <span className="gantt-bar-demo__label">{label}</span>
    </div>
  );
}
