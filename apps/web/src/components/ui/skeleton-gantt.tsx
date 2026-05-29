import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type SkeletonGanttProps = {
  level?: StateLevel;
  className?: string;
};

export function SkeletonGantt({ level = "L3", className }: SkeletonGanttProps) {
  return (
    <div
      className={cn(stateLevelModifier("skeleton-gantt", level), className)}
      aria-busy="true"
      aria-hidden
    >
      <div className="skeleton-gantt__toolbar">
        <Skeleton variant="chip" />
        <Skeleton variant="chip" />
        <Skeleton variant="row" className="skeleton-gantt__toolbar-spacer" />
      </div>
      <div className="skeleton-gantt__body">
        <div className="skeleton-gantt__tree">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="text" width={i % 2 === 0 ? "lg" : "md"} />
          ))}
        </div>
        <div className="skeleton-gantt__chart">
          <Skeleton variant="block" className="skeleton-gantt__chart-canvas" />
        </div>
      </div>
    </div>
  );
}
