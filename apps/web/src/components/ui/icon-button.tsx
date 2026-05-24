import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center cursor-pointer",
    "rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0"
  ].join(" "),
  {
    variants: {
      variant: {
        ghost: "bg-transparent text-[var(--muted-strong)] hover:bg-[var(--panel-strong)] hover:text-[var(--text)]",
        soft: "bg-[var(--panel-strong)] text-[var(--text)] hover:bg-[var(--panel-elevated)] border border-[var(--border)]",
        solid: "bg-[var(--text-strong)] text-white hover:bg-[var(--accent)] border border-transparent",
        outline:
          "border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--panel-strong)]",
        destructive:
          "bg-transparent text-[var(--danger)] hover:bg-[var(--danger-soft)] border border-transparent"
      },
      size: {
        sm: "size-7 [&_svg]:size-3.5",
        md: "size-9 [&_svg]:size-4",
        lg: "size-10 [&_svg]:size-5"
      }
    },
    defaultVariants: { variant: "ghost", size: "md" }
  }
);

export type IconButtonProps = ComponentProps<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    label: string;
    children: ReactNode;
  };

export function IconButton({
  label,
  children,
  className,
  type = "button",
  variant,
  size,
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(iconButtonVariants({ variant, size }), className)}
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      {children}
    </button>
  );
}

export { iconButtonVariants };
