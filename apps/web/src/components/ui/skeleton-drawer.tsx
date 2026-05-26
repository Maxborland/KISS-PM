import { cn } from "@/lib/cn";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type SkeletonDrawerProps = {
  level?: StateLevel;
  className?: string;
};

export function SkeletonDrawer({ level = "L2", className }: SkeletonDrawerProps) {
  return (
    <div
      className={cn(stateLevelModifier("skeleton-drawer", level), className)}
      aria-busy="true"
      aria-hidden
    >
      <Skeleton variant="title" width="md" />
      <Skeleton variant="text" width="lg" />
      <div className="skeleton-drawer__section">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
      <Skeleton variant="block" className="skeleton-drawer__block" />
    </div>
  );
}
