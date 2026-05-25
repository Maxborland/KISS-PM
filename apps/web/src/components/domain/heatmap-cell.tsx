import { cn } from "@/lib/cn";

export type HeatmapCellProps = {
  value: number | string;
  level?: 0 | 1 | 2 | 3 | 4;
  title?: string;
  className?: string;
};

/** Ячейка тепловой карты загрузки (0–4). */
export function HeatmapCell({ value, level = 0, title, className }: HeatmapCellProps) {
  const label = title ?? `Загрузка ${value}`;
  return (
    <span
      className={cn("heatmap-cell", `heatmap-cell--${level}`, className)}
      role="img"
      aria-label={label}
      title={title}
    >
      {value}
    </span>
  );
}
