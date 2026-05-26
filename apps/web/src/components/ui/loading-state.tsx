import { cn } from "@/lib/cn";
import { SkeletonBento } from "@/components/ui/skeleton-bento";
import { SkeletonGantt } from "@/components/ui/skeleton-gantt";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type LoadingStateLayout = "generic" | "table" | "bento" | "gantt";

export type LoadingStateProps = {
  label?: string;
  level?: StateLevel;
  layout?: LoadingStateLayout;
  className?: string;
};

export function LoadingState({
  label = "Загрузка…",
  level = "L3",
  layout = "generic",
  className
}: LoadingStateProps) {
  const body =
    layout === "table" ? (
      <SkeletonTable level={level === "L1" ? "L1" : "L2"} />
    ) : layout === "bento" ? (
      <SkeletonBento level={level} />
    ) : layout === "gantt" ? (
      <SkeletonGantt level={level} />
    ) : (
      <div className="loading-state__generic" aria-hidden>
        <div className="skeleton skeleton--bar" />
        <div className="skeleton skeleton--text skeleton--w-md" />
        <div className="skeleton skeleton--text skeleton--w-lg" />
        <div className="skeleton skeleton--block u-mt-4" />
      </div>
    );

  return (
    <div
      className={cn(stateLevelModifier("loading-state", level), className)}
      aria-busy="true"
      aria-live="polite"
    >
      {label ? <p className="loading-state__label u-text-body u-text-muted">{label}</p> : null}
      {body}
    </div>
  );
}
