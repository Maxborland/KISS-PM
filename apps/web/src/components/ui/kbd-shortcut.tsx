import type { ReactNode } from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";

export type KbdShortcutProps = {
  keys: ReactNode[];
  description?: string;
  separator?: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

/** Подпись горячей клавиши для toolbars и command palette hints. */
export function KbdShortcut({ keys, description, separator = "+", size = "md", className }: KbdShortcutProps) {
  const combo = keys.map(String).join(separator === "+" ? " + " : ` ${String(separator)} `);

  return (
    <span className={cn("kbd-shortcut", className)}>
      <KbdGroup keys={keys} separator={separator} size={size} />
      {description ? (
        <span className="kbd-shortcut__desc" aria-label={`Сочетание ${combo}: ${description}`}>
          {description}
        </span>
      ) : (
        <span className="u-sr-only">{`Сочетание ${combo}`}</span>
      )}
    </span>
  );
}

/** Одиночная клавиша с подписью. */
export function KbdShortcutSingle({
  keyLabel,
  description,
  className
}: {
  keyLabel: ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <span className={cn("kbd-shortcut", className)}>
      <Kbd size="md">{keyLabel}</Kbd>
      {description ? <span className="kbd-shortcut__desc">{description}</span> : null}
    </span>
  );
}
