import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const alertVariants = cva(
  "relative w-full rounded-[var(--radius-md)] border p-[var(--space-4)] [&>svg~*]:pl-[var(--space-7)] [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-[var(--space-4)] [&>svg]:top-[var(--space-4)] [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--panel)] text-[var(--text)] border-[var(--border)]",
        destructive:
          "bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger)]",
        info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]",
        warning: "bg-[var(--warning-soft)] text-[var(--warning-text)] border-[var(--warning)]",
        danger: "bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "mb-1 font-[family-name:var(--font-display)] text-[length:var(--text-h3)] font-semibold leading-[var(--lh-h3)] text-[var(--text-strong)]",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[length:var(--text-md)] leading-[var(--lh-md)] text-[var(--muted-strong)] [&_p]:leading-[var(--lh-md)]",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
