"use client";

import type { ComponentProps, ReactNode } from "react";
import { Loader2, Search } from "lucide-react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";

export type SearchPillProps = Omit<ComponentProps<"input">, "type" | "size"> & {
  /** `null` — без чипа клавиш. Строка — одиночная клавиша. Массив — комбинация. */
  shortcut?: string | string[] | null;
  size?: "sm" | "md";
  loading?: boolean;
  /** Дополнительная нода справа (например, пагинация). */
  trailing?: ReactNode;
};

export function SearchPill({
  className,
  placeholder = "Поиск…",
  shortcut = null,
  size = "md",
  loading = false,
  disabled,
  trailing,
  ...props
}: SearchPillProps) {
  return (
    <label
      className={cn(
        "search-pill",
        size === "sm" && "search-pill--sm",
        disabled && "search-pill--disabled",
        className
      )}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-[var(--muted)]" aria-hidden />
      ) : (
        <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
      )}
      <input type="search" placeholder={placeholder} disabled={disabled} {...props} />
      {trailing}
      {shortcut != null
        ? Array.isArray(shortcut)
          ? <KbdGroup keys={shortcut} size="sm" />
          : <Kbd size="sm">{shortcut}</Kbd>
        : null}
    </label>
  );
}
