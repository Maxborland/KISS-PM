import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const skeletonVariants = cva("skeleton", {
  variants: {
    variant: {
      default: "",
      text: "skeleton--text",
      title: "skeleton--text skeleton--title",
      avatar: "skeleton--avatar",
      circle: "skeleton--circle",
      row: "skeleton--bar",
      block: "skeleton--block",
      chip: "skeleton--chip"
    },
    width: {
      auto: "",
      sm: "skeleton--w-sm",
      md: "skeleton--w-md",
      lg: "skeleton--w-lg",
      full: "skeleton--w-full"
    }
  },
  defaultVariants: { variant: "default", width: "auto" }
});

export type SkeletonProps = ComponentProps<"div"> & VariantProps<typeof skeletonVariants>;

function Skeleton({ className, variant, width, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(skeletonVariants({ variant, width }), className)}
      {...props}
    />
  );
}

/** Композиция: title + 3 строки. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      <Skeleton variant="title" width="md" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? "md" : "lg"} />
      ))}
    </div>
  );
}

/** Композиция: avatar + 2 строки. */
function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-[var(--space-3)]", className)}>
      <Skeleton variant="avatar" />
      <div className="flex-1 flex flex-col gap-[var(--space-2)]">
        <Skeleton variant="text" width="md" />
        <Skeleton variant="text" width="sm" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonRow, skeletonVariants };
