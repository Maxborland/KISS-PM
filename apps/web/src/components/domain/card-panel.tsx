import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type CardPanelProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  soft?: boolean;
  flush?: boolean;
  className?: string;
};

export function CardPanel({ title, subtitle, actions, children, soft, flush, className }: CardPanelProps) {
  return (
    <div className={cn("card", soft && "card--soft", className)}>
      {title ? (
        <div className="card__head">
          <div>
            <h3 className="card__title">{title}</h3>
            {subtitle ? <p className="card__sub">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn("card__body", flush && "card__body--flush")}>{children}</div>
    </div>
  );
}
