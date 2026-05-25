import { cn } from "@/lib/cn";

export type SparklineProps = {
  points: number[];
  width?: number;
  height?: number;
  label?: string;
  className?: string;
};

function buildPolyline(points: number[], width: number, height: number): string {
  if (points.length === 0) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  return points
    .map((p, i) => {
      const x = pad + (i / Math.max(points.length - 1, 1)) * innerW;
      const y = pad + innerH - ((p - min) / span) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
}

/** Мини-график тренда (SVG polyline). */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  label = "Мини-график тренда",
  className
}: SparklineProps) {
  const poly = buildPolyline(points, width, height);

  return (
    <svg
      className={cn("sparkline", className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {poly ? <polyline className="sparkline__line" points={poly} fill="none" /> : null}
    </svg>
  );
}
