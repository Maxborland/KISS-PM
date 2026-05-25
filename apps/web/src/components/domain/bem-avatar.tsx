import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type BemAvatarColor = "c1" | "c2" | "c3" | "c4" | "c5";
export type BemAvatarSize = "sm" | "md" | "lg" | "xl";

export type BemAvatarProps = HTMLAttributes<HTMLSpanElement> & {
  initials: string;
  color?: BemAvatarColor;
  size?: BemAvatarSize;
};

export function BemAvatar({ initials, color = "c1", size, className, ...props }: BemAvatarProps) {
  return (
    <span className={cn("avatar", `avatar--${color}`, size && `avatar--${size}`, className)} {...props}>
      {initials}
    </span>
  );
}

export function BemAvatarStack({
  className,
  children,
  more
}: HTMLAttributes<HTMLSpanElement> & { more?: string }) {
  return (
    <span className={cn("avatar-stack", className)}>
      {children}
      {more ? <span className="avatar-stack__more">{more}</span> : null}
    </span>
  );
}
