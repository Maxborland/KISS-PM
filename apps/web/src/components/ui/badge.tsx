import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap",
    "rounded-[var(--radius-full)] border font-medium leading-none",
    "h-5 min-h-5 px-2 text-[length:var(--text-sm)]",
    "transition-colors"
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
        secondary: "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
        primary: "border-transparent bg-[var(--accent)] text-white",
        success: "border-transparent bg-[var(--success-soft)] text-[var(--success-text)]",
        warning: "border-transparent bg-[var(--warning-soft)] text-[var(--warning-text)]",
        danger: "border-transparent bg-[var(--danger-soft)] text-[var(--danger-text)]",
        destructive: "border-transparent bg-[var(--danger-soft)] text-[var(--danger-text)]",
        info: "border-transparent bg-[var(--info-soft)] text-[color-mix(in_oklab,var(--info),black_30%)]",
        violet: "border-transparent bg-[var(--violet-soft)] text-[color-mix(in_oklab,var(--violet),black_24%)]",
        accent: "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]",
        outline: "border-[var(--border-strong)] bg-transparent text-[var(--text)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
