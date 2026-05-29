"use client";

import { cn } from "@/lib/cn";

/** Порядок: перегруз → нагрузка → календарь → фон (иерархия внимания). */
const ITEMS: Array<{ label: string; modifier: string }> = [
  { label: "Перегруз > 15ч", modifier: "rmatrix-legend__swatch--over" },
  { label: "Высокая > 10ч", modifier: "rmatrix-legend__swatch--high" },
  { label: "Норма ≤ 8ч", modifier: "rmatrix-legend__swatch--normal" },
  { label: "Свободно", modifier: "rmatrix-legend__swatch--free" },
  { label: "Выходной", modifier: "rmatrix-legend__swatch--weekend" },
  { label: "Отпуск", modifier: "rmatrix-legend__swatch--vacation" },
  { label: "Праздник", modifier: "rmatrix-legend__swatch--holiday" }
];

export function ResourceMatrixLegend({ className }: { className?: string }) {
  return (
    <div className={cn("rmatrix-legend", className)} role="list" aria-label="Легенда нагрузки">
      {ITEMS.map((item) => (
        <span key={item.label} className="rmatrix-legend__item" role="listitem">
          <span className={cn("rmatrix-legend__swatch", item.modifier)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
