import type { ReactNode } from "react";

export type PageIntroProps = {
  title: string;
  lead?: string;
  actions?: ReactNode;
};

export function PageIntro({ title, lead, actions }: PageIntroProps) {
  return (
    <div className="page-intro">
      <div>
        <h1 className="page-intro__title">{title}</h1>
        {lead ? <p className="page-intro__lead">{lead}</p> : null}
      </div>
      {actions ? <div className="btn-group">{actions}</div> : null}
    </div>
  );
}
