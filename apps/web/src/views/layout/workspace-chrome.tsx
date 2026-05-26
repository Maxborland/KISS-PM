import type { ReactNode } from "react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { AppContextSidebar } from "@/shell/app-context-sidebar";
import { AppIconRail } from "@/shell/app-icon-rail";
import { AppShell } from "@/shell/app-shell";
import { AppTopbar } from "@/shell/app-topbar";
import { contextNavForSection } from "@/shell/navigation-registry";
import { TopbarBreadcrumbs } from "@/shell/topbar-breadcrumbs";
import type { ScreenMeta } from "@/views/catalog";
import { DEFAULT_USER } from "@/views/config/sidebar-nav";

export type WorkspaceChromeProps = {
  meta: Pick<ScreenMeta, "breadcrumb" | "railSection" | "contextActiveItem" | "topbarMode">;
  children: ReactNode;
  topbarActions?: ReactNode;
};

export function WorkspaceChrome({ meta, children, topbarActions }: WorkspaceChromeProps) {
  const topbarExtras =
    topbarActions ??
    (meta.topbarMode === "team" ? (
      <BemAvatarStack more="+2">
        <BemAvatar initials="ИИ" color="c1" />
        <BemAvatar initials="АП" color="c3" />
        <BemAvatar initials="КБ" color="c4" />
      </BemAvatarStack>
    ) : null);

  return (
    <AppShell
      iconRail={<AppIconRail activeSection={meta.railSection} />}
      contextSidebar={
        <AppContextSidebar
          groups={contextNavForSection(meta.railSection, meta.contextActiveItem)}
          user={DEFAULT_USER}
        />
      }
      topbar={
        <AppTopbar
          breadcrumbs={<TopbarBreadcrumbs items={meta.breadcrumb} />}
          actions={topbarExtras}
        />
      }
    >
      {children}
    </AppShell>
  );
}
