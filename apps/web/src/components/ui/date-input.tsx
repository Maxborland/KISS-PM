"use client";

import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type DateInputProps = ComponentProps<"input">;

/** Date field styled via design tokens; full calendar popover — Phase 2+ slice. */
export function DateInput({ className, type = "date", ...props }: DateInputProps) {
  return <Input type={type} className={cn("date-input", className)} {...props} />;
}
