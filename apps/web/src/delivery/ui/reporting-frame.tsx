import type { ReactNode } from "react";
import { BarChart3, ChevronRight } from "lucide-react";

import { WorkspaceShell } from "@/delivery/ui/workspace-shell";

/**
 * ReportingFrame — каркас аналитической поверхности (раздел «Аналитика → Загрузка»).
 * Тот же WorkspaceShell, но вместо шапки проекта и табов — заголовок отчёта,
 * хлебные крошки и слот controls (например, переключатель скоупа компания/команда).
 * Используется для портфельной ресурсной загрузки (тот же компонент, что и в проекте).
 */
export function ReportingFrame({
  title,
  subtitle,
  controls,
  children
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <WorkspaceShell activeNav="Загрузка">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 pt-3 pb-3 md:px-6">
        <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[var(--muted-strong)]"><BarChart3 className="size-4" aria-hidden /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
            Аналитика <ChevronRight className="size-3" aria-hidden /> Загрузка
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-22)] font-extrabold leading-tight tracking-[-0.025em] text-[var(--text-strong)]">{title}</h1>
            {subtitle ? <span className="text-[length:var(--text-sm)] text-[var(--muted)]">{subtitle}</span> : null}
          </div>
        </div>
        {controls ? <div className="ml-auto flex items-center gap-2">{controls}</div> : null}
      </div>
      <main className="min-w-0 flex-1 overflow-auto bg-[var(--canvas)] p-4 md:p-6">{children}</main>
    </WorkspaceShell>
  );
}
