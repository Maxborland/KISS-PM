import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const chipVariants = cva("chip", {
  variants: {
    variant: {
      success: "chip--success",
      info: "chip--info",
      warning: "chip--warning",
      danger: "chip--danger",
      violet: "chip--violet"
    }
  },
  defaultVariants: { variant: "info" }
});

export type ChipProps = VariantProps<typeof chipVariants> & {
  children: ReactNode;
  className?: string;
};

export function Chip({ variant, children, className }: ChipProps) {
  return <span className={cn(chipVariants({ variant }), className)}>{children}</span>;
}
