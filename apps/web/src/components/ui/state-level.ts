import { cn } from "@/lib/cn";

/** L1 inline · L2 panel · L3 page section · L4 full product screen */
export const STATE_LEVELS = ["L1", "L2", "L3", "L4"] as const;

export type StateLevel = (typeof STATE_LEVELS)[number];

export function stateLevelModifier(baseClass: string, level: StateLevel = "L3"): string {
  return cn(baseClass, `${baseClass}--${level.toLowerCase()}`);
}
