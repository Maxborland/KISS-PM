import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type IconButtonProps = ComponentProps<"button"> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, children, className, type = "button", ...props }: IconButtonProps) {
  return (
    <button type={type} className={cn("icon-btn", className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
