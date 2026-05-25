import type { ReactNode } from "react";
import { Download, Plus } from "lucide-react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/shell/app-shell";
import { AppSidebar } from "@/shell/app-sidebar";
import { AppTopbar } from "@/shell/app-topbar";
import { TopbarBreadcrumbs } from "@/shell/topbar-breadcrumbs";
import type { ScreenMeta } from "@/views/catalog";
import { DEFAULT_USER, sidebarGroupsForActive } from "@/views/config/sidebar-nav";

export type WorkspaceChromeProps = {
  meta: Pick<ScreenMeta, "breadcrumb" | "activeNav">;
  children: ReactNode;
  topbarActions?: ReactNode;
  showDefaultActions?: boolean;
};

export function WorkspaceChrome({
  meta,
  children,
  topbarActions,
  showDefaultActions = true
}: WorkspaceChromeProps) {
  const actions =
    topbarActions ??
    (showDefaultActions ? (
      <>
        <Button variant="secondary" size="sm" disabled title="Демо Storybook: экспорт подключится к API">
          <Download className="size-4" aria-hidden />
          Экспорт
        </Button>
        <Button variant="primary" size="sm" disabled title="Демо Storybook: создание сущности в продукте">
          <Plus className="size-4" aria-hidden />
          Создать
        </Button>
        <BemAvatarStack more="+2">
          <BemAvatar initials="ИИ" color="c1" />
          <BemAvatar initials="АП" color="c3" />
          <BemAvatar initials="КБ" color="c4" />
        </BemAvatarStack>
      </>
    ) : null);

  return (
    <AppShell
      sidebar={
        <AppSidebar groups={sidebarGroupsForActive(meta.activeNav)} user={DEFAULT_USER} />
      }
      topbar={
        <AppTopbar
          breadcrumbs={<TopbarBreadcrumbs items={meta.breadcrumb} />}
          actions={actions}
        />
      }
    >
      {children}
    </AppShell>
  );
}
