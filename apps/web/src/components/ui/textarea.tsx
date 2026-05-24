import * as React from "react";

import { cn } from "@/lib/cn";
import { inputBase } from "@/components/ui/cva-shared";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputBase, "min-h-[80px] resize-y py-[var(--space-2)] h-auto", className)}
      {...props}
    />
  );
}

export { Textarea };
