import { cn } from "@/lib/cn";

export type CapacityBarProps = {
  label: string;
  used: number;
  capacity: number;
  className?: string;
};

function capacityTone(pct: number): "default" | "warn" | "over" {
  if (pct > 100) return "over";
  if (pct >= 85) return "warn";
  return "default";
}

/** Полоса загрузки ресурса (часы / FTE). */
export function CapacityBar({ label, used, capacity, className }: CapacityBarProps) {
  const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
  const tone = capacityTone(pct);
  const fill = Math.min(100, pct);

  return (
    <div
      className={cn(
        "capacity-bar",
        tone === "warn" && "capacity-bar--warn",
        tone === "over" && "capacity-bar--over",
        className
      )}
    >
      <div className="capacity-bar__head">
        <span>{label}</span>
        <span className="mono">
          {used} / {capacity} ({pct}%)
        </span>
      </div>
      <div
        className="capacity-bar__track"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={`${label}: ${pct}%`}
      >
        <span className="capacity-bar__fill" style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}
