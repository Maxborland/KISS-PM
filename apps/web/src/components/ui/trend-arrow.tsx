import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/cn";

export type TrendDirection = "up" | "down" | "flat";

export type TrendArrowProps = {
  direction: TrendDirection;
  /** Подпись рядом со стрелкой. */
  label?: string;
  /** Алиас для `label` (исторический API в stories). */
  value?: string;
  className?: string;
};

/** Направление тренда KPI с иконкой и подписью. */
export function TrendArrow({ direction, label, value, className }: TrendArrowProps) {
  const text = label ?? value ?? "";
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <span
      className={cn("trend-arrow", `trend-arrow--${direction}`, className)}
      {...(text ? { role: "status" as const, "aria-label": text } : {})}
    >
      <Icon className="size-4" aria-hidden />
      {text ? <span>{text}</span> : null}
    </span>
  );
}
