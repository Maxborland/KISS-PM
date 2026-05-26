import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type SkeletonTableProps = {
  rows?: number;
  columns?: number;
  level?: StateLevel;
  className?: string;
};

export function SkeletonTable({ rows = 5, columns = 4, level = "L2", className }: SkeletonTableProps) {
  return (
    <div
      className={cn(stateLevelModifier("skeleton-table", level), className)}
      aria-busy="true"
      aria-hidden
    >
      <div className="skeleton-table__head">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} variant="text" width="md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="skeleton-table__row">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={`${row}-${col}`} variant="text" width={col === 0 ? "lg" : "md"} />
          ))}
        </div>
      ))}
    </div>
  );
}
