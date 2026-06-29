import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Bento — модульная сетка (design v4). Философия «модульность ↔ коммиты»:
 * каждый модуль — самостоятельная карточка с заголовком, телом и действиями.
 * 12-колоночная на десктопе, в одну колонку на узких экранах.
 */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4", className)}>{children}</div>;
}

const SPAN: Record<number, string> = {
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  12: "md:col-span-12"
};

export type BentoCardProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** Ширина в 12-колоночной сетке (десктоп). */
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  /** Убрать внутренние отступы тела (для таблиц/списков впритык). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function BentoCard({
  title,
  subtitle,
  actions,
  footer,
  span = 6,
  flush,
  className,
  bodyClassName,
  children
}: BentoCardProps) {
  return (
    <section
      className={cn(
        "hover-lift flex min-w-0 flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]",
        SPAN[span],
        className
      )}
    >
      {title || actions ? (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="truncate font-[family-name:var(--font-display)] text-[length:var(--text-15)] font-bold leading-tight tracking-[-0.015em] text-[var(--text-strong)]">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-[length:var(--text-sm)] text-[var(--muted-soft)]">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? "" : "px-4 pb-4", title || actions ? "" : flush ? "" : "pt-4", "min-w-0 flex-1", bodyClassName)}>
        {children}
      </div>
      {footer ? (
        <footer className="border-t border-[var(--border-subtle)] px-4 py-2.5 text-[length:var(--text-sm)] text-[var(--muted)]">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/** KPI-плитка: метка, крупное число, дельта. Плоская, без градиентов. */
export function StatTile({
  label,
  value,
  delta,
  tone = "default"
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const deltaTone = {
    default: "text-[var(--muted)]",
    success: "text-[var(--success-text)]",
    warning: "text-[var(--warning-text)]",
    danger: "text-[var(--danger-text)]"
  }[tone];
  const valueTone = {
    default: "text-[var(--text-strong)]",
    success: "text-[var(--success-text)]",
    warning: "text-[var(--warning-text)]",
    danger: "text-[var(--danger-text)]"
  }[tone];
  return (
    <div className="hover-lift flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 shadow-[var(--shadow-card)]">
      <span className="truncate text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.07em] text-[var(--muted-soft)]">
        {label}
      </span>
      <span
        className={cn(
          "v4-num font-[family-name:var(--font-display)] text-[length:var(--text-h1)] font-extrabold leading-none tracking-[-0.025em]",
          valueTone
        )}
      >
        {value}
      </span>
      {delta ? <span className={cn("v4-num text-[length:var(--text-sm)] font-medium", deltaTone)}>{delta}</span> : null}
    </div>
  );
}
