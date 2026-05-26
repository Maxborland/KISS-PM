import { cn } from "@/lib/cn";

export type SparklineProps = {
  /** SVG path `d` для линии (viewBox 0 0 600 200). */
  linePath: string;
  /** SVG path `d` для заливки под линией (опционально). */
  areaPath?: string;
  gradientId?: string;
  className?: string;
  height?: number;
};

/** Компактный sparkline для плиток дашборда. */
export function Sparkline({
  linePath,
  areaPath,
  gradientId = "sparkline-fill",
  className,
  height = 200
}: SparklineProps) {
  return (
    <svg
      className={cn("sparkline", className)}
      viewBox="0 0 600 200"
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      {areaPath ? (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
          </linearGradient>
        </defs>
      ) : null}
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      <path d={linePath} stroke="var(--danger)" strokeWidth={2} fill="none" />
    </svg>
  );
}
