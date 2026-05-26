import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";

export type IlluStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: StateLevel;
  className?: string;
};

export function IlluState({ title, description, action, level = "L3", className }: IlluStateProps) {
  return (
    <div className={cn(stateLevelModifier("state-illu", level), className)} role="status">
      <div className="state-illu__art" aria-hidden />
      <p className="state-illu__title">{title}</p>
      {description ? <p className="state-illu__text">{description}</p> : null}
      {action ? <div className="state-illu__actions">{action}</div> : null}
    </div>
  );
}
