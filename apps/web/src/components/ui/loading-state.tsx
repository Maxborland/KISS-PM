import { cn } from "@/lib/cn";

export type LoadingStateProps = {
  label?: string;
  className?: string;
};

export function LoadingState({ label = "Загрузка…", className }: LoadingStateProps) {
  return (
    <div className={cn("skeleton-page", className)} aria-busy="true" aria-live="polite">
      <p className="u-text-sm u-text-muted u-mb-4">{label}</p>
      <div className="skeleton skeleton--bar" />
      <div className="skeleton skeleton--text skeleton--w-md" />
      <div className="skeleton skeleton--text skeleton--w-lg" />
      <div className="skeleton skeleton--block u-mt-4" />
    </div>
  );
}
