import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type CellStackProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Truncate title/subtitle with ellipsis and expose the full text via `title=` (Principle 1). */
  truncate?: boolean;
  className?: string;
};

// Tailwind-native replacement for the legacy BEM `.cell-stack` (shadcn+TW direction).
// Spec mirrors the old bem.css rules: gap 10px, 28px icon tile, title text-md/600, sub text-sm/muted.
export function CellStack({ title, subtitle, icon, truncate, className }: CellStackProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {icon ? (
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[var(--muted-strong)]">
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col leading-[1.3]">
        <span
          className={cn(
            "text-[length:var(--text-md)] leading-[var(--lh-md)] font-semibold text-[var(--text)]",
            truncate && "truncate"
          )}
          title={truncate ? title : undefined}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            className={cn(
              "text-[length:var(--text-sm)] leading-[var(--lh-sm)] text-[var(--muted)]",
              truncate && "truncate"
            )}
            title={truncate ? subtitle : undefined}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
