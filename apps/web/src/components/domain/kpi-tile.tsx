import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type KpiTileProps = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
};

/** Карточка KPI с tabular value. */
export function KpiTile({ label, value, meta, className }: KpiTileProps) {
  return (
    <div className={cn("kpi-tile", className)}>
      <span className="kpi-tile__eyebrow">{label}</span>
      <div className="kpi-tile__value mono">{value}</div>
      {meta ? <div className="kpi-tile__meta">{meta}</div> : null}
    </div>
  );
}
