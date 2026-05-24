"use client";

import { cn } from "@/lib/cn";
import type { ResourceMatrixData } from "./types";

const RU_NUMBER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

function fmt(n: number) {
  return RU_NUMBER.format(n);
}

export function ResourceMatrixStats({
  stats,
  className
}: {
  stats: ResourceMatrixData["stats"];
  className?: string;
}) {
  return (
    <div className={cn("rmatrix-stats", className)} role="group" aria-label="Сводка матрицы">
      <Item label="Ёмкость" value={`${fmt(stats.capacityHours)} ч`} />
      <Item label="Назначено" value={`${fmt(stats.assignedHours)} ч`} accent />
      <Item
        label="Загрузка"
        value={`${stats.loadPct}%`}
        warning={stats.loadPct >= 90 && stats.loadPct < 100}
        danger={stats.loadPct >= 100}
      />
      <Item label="Свободно" value={`${fmt(stats.freeHours)} ч`} danger={stats.freeHours < 500} />
      <Item label="Сотрудников" value={String(stats.employees)} />
      <div className="rmatrix-stats__bar" aria-hidden>
        <div
          className="rmatrix-stats__bar-fill"
          style={{ width: `${Math.min(stats.loadPct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  accent,
  warning,
  danger
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rmatrix-stats__item">
      <span className="rmatrix-stats__label">{label}</span>
      <span
        className={cn(
          "rmatrix-stats__value",
          accent && "rmatrix-stats__value--accent",
          warning && "rmatrix-stats__value--warning",
          danger && "rmatrix-stats__value--danger"
        )}
      >
        {value}
      </span>
    </div>
  );
}
