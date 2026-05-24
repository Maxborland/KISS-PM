import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius-md)] text-[var(--text-base)] font-medium",
    "transition-colors duration-[var(--duration-fast)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-[var(--accent)]",
        primary:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-[var(--accent)]",
        accent:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-[var(--accent)]",
        destructive:
          "bg-[var(--danger)] text-white hover:bg-[var(--danger-text)] border border-[var(--danger)]",
        outline:
          "border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--panel-strong)]",
        secondary:
          "bg-[var(--panel)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--panel-strong)]",
        ghost:
          "text-[var(--muted-strong)] hover:bg-[var(--panel-strong)] hover:text-[var(--text)] border border-transparent",
        link: "text-[var(--accent)] underline-offset-4 hover:underline border-0 bg-transparent p-0 h-auto"
      },
      size: {
        default: "h-[var(--row-h)] px-[14px] text-[var(--text-sm)]",
        sm: "h-[30px] px-[10px] text-[var(--text-xs)]",
        md: "h-[var(--row-h)] px-[14px] text-[var(--text-sm)]",
        lg: "h-[40px] px-[18px] text-[var(--text-sm)] rounded-[var(--radius-lg)]",
        icon: "h-[var(--row-h)] w-[var(--row-h)] p-0",
        xs: "h-[30px] px-[10px] text-[var(--text-xs)]"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
