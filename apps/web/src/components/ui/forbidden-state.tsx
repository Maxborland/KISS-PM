import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ForbiddenStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function ForbiddenState({ title, description, action, className }: ForbiddenStateProps) {
  return (
    <div className={cn("state-empty state-empty--forbidden", className)}>
      <div className="state-empty__icon" aria-hidden />
      <p className="state-empty__title">{title}</p>
      {description ? <p className="state-empty__desc">{description}</p> : null}
      {action ? <div className="state-empty__actions">{action}</div> : null}
    </div>
  );
}
