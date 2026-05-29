import { cn } from "@/lib/cn";

export type ProbabilityRingProps = {
  value: number;
  className?: string;
};

/** Кольцо вероятности сделки (0–100). */
export function ProbabilityRing({ value, className }: ProbabilityRingProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <span className={cn("prob-ring", className)} role="img" aria-label={`Вероятность ${pct} процентов`}>
      <svg className="prob-ring__svg" viewBox="0 0 36 36" aria-hidden>
        <circle className="prob-ring__track" cx="18" cy="18" r="15.9" fill="none" />
        <circle
          className="prob-ring__fill"
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          pathLength={100}
          strokeDasharray={`${pct} ${100 - pct}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="prob-ring__value mono">{pct}%</span>
    </span>
  );
}
