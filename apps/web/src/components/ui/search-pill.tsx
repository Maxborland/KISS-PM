"use client";

import type { ComponentProps } from "react";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";

export type SearchPillProps = Omit<ComponentProps<"input">, "type"> & {
  shortcut?: string;
};

export function SearchPill({ className, placeholder = "Поиск…", shortcut = "⌘K", ...props }: SearchPillProps) {
  return (
    <label className={cn("search-pill", className)}>
      <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <input type="search" placeholder={placeholder} {...props} />
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </label>
  );
}
