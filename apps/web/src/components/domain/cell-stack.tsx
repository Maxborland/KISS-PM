import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type CellStackProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
};

export function CellStack({ title, subtitle, icon, className }: CellStackProps) {
  return (
    <div className={cn("cell-stack", className)}>
      {icon ? <span className="cell-stack__icon">{icon}</span> : null}
      <div className="cell-stack__main">
        <span className="cell-stack__title">{title}</span>
        {subtitle ? <span className="cell-stack__sub">{subtitle}</span> : null}
      </div>
    </div>
  );
}
