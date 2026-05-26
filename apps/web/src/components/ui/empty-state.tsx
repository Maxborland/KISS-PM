import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** L1 inline · L2 panel · L3 page section · L4 full screen */
  level?: StateLevel;
  className?: string;
};

export function EmptyState({ title, description, action, level = "L3", className }: EmptyStateProps) {
  return (
    <div className={cn(stateLevelModifier("state-empty", level), className)} role="status">
      <p className="state-empty__title">{title}</p>
      {description ? <p className="state-empty__desc">{description}</p> : null}
      {action ? <div className="state-empty__actions">{action}</div> : null}
    </div>
  );
}
