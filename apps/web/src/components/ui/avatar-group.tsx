import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type AvatarGroupItem = {
  id: string;
  initials: string;
  title?: string;
};

export type AvatarGroupProps = {
  items: AvatarGroupItem[];
  max?: number;
  size?: "sm" | "default";
  className?: string;
  moreLabel?: (count: number) => string;
};

/** Группа аватаров с overflow «+N» (Radix/shadcn Avatar). */
export function AvatarGroup({
  items,
  max = 4,
  size = "sm",
  className,
  moreLabel = (n) => `+${n}`
}: AvatarGroupProps) {
  const visible = items.slice(0, max);
  const overflow = Math.max(0, items.length - max);

  return (
    <span className={cn("avatar-group", className)} role="group" aria-label="Участники">
      {visible.map((item) => (
        <Avatar key={item.id} size={size} title={item.title ?? item.initials}>
          <AvatarFallback>{item.initials}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span className="avatar-group__more" aria-label={`Ещё ${overflow}`}>
          {moreLabel(overflow)}
        </span>
      ) : null}
    </span>
  );
}

export function AvatarGroupFromChildren({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("avatar-group", className)}>{children}</span>;
}
