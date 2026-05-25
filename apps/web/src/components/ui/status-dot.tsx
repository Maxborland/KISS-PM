import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const statusDotVariants = cva("status-dot", {
  variants: {
    tone: {
      success: "status-dot--success",
      warning: "status-dot--warning",
      danger: "status-dot--danger",
      info: "status-dot--info",
      muted: "status-dot--muted"
    },
    size: {
      sm: "status-dot--sm",
      md: "status-dot--md"
    }
  },
  defaultVariants: { tone: "info", size: "md" }
});

export type StatusDotProps = VariantProps<typeof statusDotVariants> & {
  label: string;
  className?: string;
};

/** Индикатор статуса с текстовой подписью для списков и карточек. */
export function StatusDot({ tone, size, label, className }: StatusDotProps) {
  return (
    <span className={cn("status-dot-wrap", className)}>
      <span
        className={cn(statusDotVariants({ tone, size }))}
        role="status"
        aria-label={label}
      />
      <span className="status-dot-wrap__label">{label}</span>
    </span>
  );
}
