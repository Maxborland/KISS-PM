import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type SkeletonBentoProps = {
  level?: StateLevel;
  className?: string;
};

export function SkeletonBento({ level = "L3", className }: SkeletonBentoProps) {
  return (
    <div
      className={cn(stateLevelModifier("skeleton-bento", level), className)}
      aria-busy="true"
      aria-hidden
    >
      <div className="skeleton-bento__hero">
        <Skeleton variant="title" width="md" />
        <Skeleton variant="text" width="lg" />
      </div>
      <div className="skeleton-bento__grid">
        <Skeleton variant="block" className="skeleton-bento__tile skeleton-bento__tile--wide" />
        <Skeleton variant="block" className="skeleton-bento__tile" />
        <Skeleton variant="block" className="skeleton-bento__tile" />
        <Skeleton variant="block" className="skeleton-bento__tile skeleton-bento__tile--tall" />
      </div>
    </div>
  );
}
