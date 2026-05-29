import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type KpiAccentTone = "warm" | "cool";

export type KpiAccentTileProps = {
  tone: KpiAccentTone;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
};

/**
 * Акцентная KPI-плитка дашборда: одна поверхность, читаемый контент на белом фоне,
 * градиент только как верхняя полоска и лёгкий блик — без вложенной «карточки в карточке».
 */
export function KpiAccentTile({ tone, label, value, meta, className }: KpiAccentTileProps) {
  return (
    <article
      className={cn("kpi-accent-tile", `kpi-accent-tile--${tone}`, className)}
      data-kpi-accent={tone}
    >
      <div className="kpi-accent-tile__bar" aria-hidden />
      <div className="kpi-accent-tile__body">
        <span className="kpi-accent-tile__label">{label}</span>
        <div className="kpi-accent-tile__value mono">{value}</div>
        {meta ? <div className="kpi-accent-tile__meta">{meta}</div> : null}
      </div>
    </article>
  );
}
