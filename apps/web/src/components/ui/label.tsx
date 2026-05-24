"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

export type LabelProps = React.ComponentProps<typeof LabelPrimitive.Root> & {
  /** Показывает красную звёздочку (aria-hidden), сохраняя `aria-required` на input. */
  required?: boolean;
  /** Скрывает визуально, но сохраняет для скринридера. */
  srOnly?: boolean;
};

function Label({ className, required, srOnly, children, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "inline-flex items-center gap-1 text-[length:var(--text-md)] leading-[var(--lh-md)] font-medium text-[var(--text-strong)] select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        srOnly && "sr-only",
        className
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-[var(--danger)] ml-0.5" aria-hidden>
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
}

export { Label };
