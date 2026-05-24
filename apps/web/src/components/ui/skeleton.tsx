import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const skeletonVariants = cva("skeleton", {
  variants: {
    variant: {
      default: "",
      text: "skeleton--text skeleton--w-lg",
      avatar: "h-8 w-8 rounded-[var(--radius-full)]",
      row: "skeleton--bar"
    }
  },
  defaultVariants: { variant: "default" }
});

function Skeleton({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return <div data-slot="skeleton" className={cn(skeletonVariants({ variant }), className)} {...props} />;
}

export { Skeleton, skeletonVariants };
