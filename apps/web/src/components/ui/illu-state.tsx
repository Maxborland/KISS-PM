import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type IlluStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function IlluState({ title, description, action, className }: IlluStateProps) {
  return (
    <div className={cn("state-illu", className)}>
      <div className="state-illu__art" aria-hidden />
      <p className="state-illu__title">{title}</p>
      {description ? <p className="state-illu__text">{description}</p> : null}
      {action ? <div className="state-illu__actions">{action}</div> : null}
    </div>
  );
}
