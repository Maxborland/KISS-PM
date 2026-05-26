import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type PriorityLevel = "urgent" | "critical" | "high" | "normal" | "med" | "low";

export type PriorityFlagProps = HTMLAttributes<HTMLSpanElement> & {
  level: PriorityLevel;
  label: string;
};

export function PriorityFlag({ level, label, className, ...props }: PriorityFlagProps) {
  return (
    <span className={cn("priority-flag", `priority-flag--${level}`, className)} {...props}>
      {label}
    </span>
  );
}
