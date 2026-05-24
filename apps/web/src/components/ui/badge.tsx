import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-[var(--radius-full)] border px-[var(--space-2)] py-[2px] text-[var(--text-xs)] font-semibold whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
        secondary: "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
        success: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success-text)]",
        warning: "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)]",
        danger: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]",
        destructive: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]",
        info: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]",
        violet: "border-[var(--violet)] bg-[var(--violet-soft)] text-[var(--violet)]",
        accent: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
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
