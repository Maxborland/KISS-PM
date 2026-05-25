import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ICON_SIZE, ICON_STROKE, type IconSizeKey } from "@/components/ui/icon-metrics";
import { cn } from "@/lib/cn";

export type TrendDirection = "up" | "down" | "flat";

const ICON_BY_DIR: Record<TrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus
};

export type TrendArrowProps = {
  direction: TrendDirection;
  value?: string;
  label?: string;
  size?: IconSizeKey;
  className?: string;
};

/** Стрелка тренда с опциональным числовым дельта-значением. */
export function TrendArrow({ direction, value, label, size = "md", className }: TrendArrowProps) {
  const Icon = ICON_BY_DIR[direction];
  const aria =
    label ??
    (direction === "up" ? "Рост" : direction === "down" ? "Снижение" : "Без изменений");

  return (
    <span
      className={cn(
        "trend-arrow",
        direction === "up" && "trend-arrow--up",
        direction === "down" && "trend-arrow--down",
        direction === "flat" && "trend-arrow--flat",
        className
      )}
      role="status"
      aria-label={aria}
    >
      <Icon size={ICON_SIZE[size]} strokeWidth={ICON_STROKE} aria-hidden />
      {value ? <span className="trend-arrow__value mono">{value}</span> : null}
    </span>
  );
}
