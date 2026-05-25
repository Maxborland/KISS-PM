import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type Crumb = { label: string; current?: boolean };

export function TopbarBreadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav className={cn("app-topbar__breadcrumbs", className)} aria-label="Хлебные крошки">
      {items.map((item, i) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          {i > 0 ? <ChevronRight className="crumb-sep size-3.5" aria-hidden /> : null}
          {item.current ? (
            <span className="u-text-strong">{item.label}</span>
          ) : (
            <a href="#" onClick={(e) => e.preventDefault()}>
              {item.label}
            </a>
          )}
        </span>
      ))}
    </nav>
  );
}

export function TopbarBreadcrumbsSlot({ children }: { children: ReactNode }) {
  return <nav className="app-topbar__breadcrumbs">{children}</nav>;
}
