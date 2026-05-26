import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type ForbiddenStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: StateLevel;
  className?: string;
};

export function ForbiddenState({
  title,
  description,
  action,
  level = "L3",
  className
}: ForbiddenStateProps) {
  return (
    <div
      className={cn(stateLevelModifier("state-empty", level), "state-empty--forbidden", className)}
      role="alert"
    >
      <div className="state-empty__icon" aria-hidden />
      <p className="state-empty__title">{title}</p>
      {description ? <p className="state-empty__desc">{description}</p> : null}
      {action ? <div className="state-empty__actions">{action}</div> : null}
    </div>
  );
}
