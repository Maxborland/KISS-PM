import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PageIntroProps = {
  title: string;
  lead?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageIntro({ title, lead, actions, className }: PageIntroProps) {
  return (
    <div className={cn("page-intro", className)}>
      <div className="u-grow">
        <h1 className="page-intro__title display">{title}</h1>
        {lead ? <p className="page-intro__lead">{lead}</p> : null}
      </div>
      {actions ? <div className="btn-group">{actions}</div> : null}
    </div>
  );
}
