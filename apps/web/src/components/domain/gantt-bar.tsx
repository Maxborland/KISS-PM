import { cn } from "@/lib/cn";

export type GanttBarDemoVariant = "default" | "at-risk" | "overdue";

export type GanttBarProps = {
  label: string;
  progress?: number;
  variant?: GanttBarDemoVariant;
  className?: string;
};

/** Демо-полоса Gantt для каталога Composites (не интерактивный chart bar). */
export function GanttBar({ label, progress = 0, variant = "default", className }: GanttBarProps) {
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
    >
      {pct > 0 ? (
        <span className="gantt-bar-demo__progress" style={{ width: `${pct}%` }} aria-hidden />
      ) : null}
      <span className="gantt-bar-demo__label">{label}</span>
    </div>
  );
}
