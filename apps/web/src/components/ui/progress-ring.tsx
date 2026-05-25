import { cn } from "@/lib/cn";

export type ProgressRingProps = {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  className?: string;
};

/** Кольцевой индикатор (SVG) для KPI и компактных карточек. */
export function ProgressRing({
  value,
  max = 100,
  size = 40,
  label,
  className
}: ProgressRingProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const pct = max > 0 ? clamped / max : 0;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const displayPct = Math.round(pct * 100);

  return (
    <div
      className={cn("progress-ring", className)}
      role="img"
      aria-label={label ?? `Прогресс ${displayPct} процентов`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="progress-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="progress-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring__label mono">{displayPct}%</span>
    </div>
  );
}
