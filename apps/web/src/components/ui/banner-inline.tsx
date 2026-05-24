import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const bannerVariants = cva("banner-inline", {
  variants: {
    variant: {
      info: "banner-inline--info",
      warn: "banner-inline--warn",
      danger: "banner-inline--danger"
    }
  },
  defaultVariants: { variant: "info" }
});

export type BannerInlineProps = VariantProps<typeof bannerVariants> & {
  children: ReactNode;
  className?: string;
};

export function BannerInline({ variant, children, className }: BannerInlineProps) {
  return <div className={cn(bannerVariants({ variant }), className)}>{children}</div>;
}
