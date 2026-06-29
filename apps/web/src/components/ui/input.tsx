import * as React from "react";

import { cn } from "@/lib/cn";
import { inputBase } from "@/components/ui/cva-shared";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputBase,
        "aria-invalid:border-[var(--danger)] aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger),transparent_85%)]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
