"use client";

import type { ReactNode } from "react";

import { PageIntroActions } from "@/shell/page-intro-actions";
import { PageIntro } from "@/views/layout/page-intro";
import { useScreenRouteMeta } from "@/views/layout/screen-route-context";

export type RoutePageIntroProps = {
  title?: string;
  lead?: string;
  actions?: ReactNode;
};

function mergeActions(registryActions: ReactNode, localActions?: ReactNode): ReactNode {
  if (registryActions && localActions) {
    return (
      <div className="btn-group">
        {registryActions}
        {localActions}
      </div>
    );
  }
  return registryActions ?? localActions ?? null;
}

/** PageIntro с заголовком/lead из реестра маршрута и CTA из `pageIntroActions`. */
export function RoutePageIntro({ title, lead, actions }: RoutePageIntroProps) {
  const meta = useScreenRouteMeta();
  const registryActions = meta.pageIntroActions === "create-export" ? <PageIntroActions /> : null;

  return (
    <PageIntro
      title={title ?? meta.pageTitle}
      lead={lead ?? meta.lead}
      actions={mergeActions(registryActions, actions)}
    />
  );
}
