import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type KbdProps = {
  children: ReactNode;
  className?: string;
  /** Размер: sm — для inline (12px), md — стандарт (20px). */
  size?: "sm" | "md";
};

/** Одна клавиша. Используйте `<KbdGroup>` для комбинаций. */
export function Kbd({ children, className, size = "md" }: KbdProps) {
  return <kbd className={cn("kbd", size === "sm" && "kbd--sm", className)}>{children}</kbd>;
}

/** Комбинация: Cmd + K, Shift + Enter и т.п. */
export function KbdGroup({
  keys,
  separator = "+",
  size = "md",
  className
}: {
  keys: ReactNode[];
  separator?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("kbd-group", className)}>
      {keys.map((k, i) => (
        <span key={i} className="kbd-group__pair">
          {i > 0 ? <span className="kbd-group__sep" aria-hidden>{separator}</span> : null}
          <Kbd size={size}>{k}</Kbd>
        </span>
      ))}
    </span>
  );
}
