import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Filtered / no-results — compact state-empty */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("state-empty", className)}>
      <p className="state-empty__title">{title}</p>
      {description ? <p className="state-empty__text">{description}</p> : null}
      {action ? <div className="state-empty__actions">{action}</div> : null}
    </div>
  );
}
