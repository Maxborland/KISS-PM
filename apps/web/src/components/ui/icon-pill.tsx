import type { LucideIcon } from "lucide-react";

import { ICON_SIZE, ICON_STROKE, type IconSizeKey } from "@/components/ui/icon-metrics";
import { cn } from "@/lib/cn";

export type IconPillProps = {
  icon: LucideIcon;
  label: string;
  size?: IconSizeKey;
  className?: string;
};

/** Иконка в круглой/скруглённой подложке (toolbar, meta). */
export function IconPill({ icon: Icon, label, size = "md", className }: IconPillProps) {
  return (
    <span className={cn("icon-pill", `icon-pill--${size}`, className)} title={label}>
      <Icon size={ICON_SIZE[size]} strokeWidth={ICON_STROKE} aria-hidden />
      <span className="u-sr-only">{label}</span>
    </span>
  );
}
