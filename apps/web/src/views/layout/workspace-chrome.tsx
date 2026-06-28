import type { ReactNode } from "react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { AppShell } from "@/shell/app-shell";
import { AppSidebar } from "@/shell/app-sidebar";
import { AppTopbar } from "@/shell/app-topbar";
import { TopbarBreadcrumbs } from "@/shell/topbar-breadcrumbs";
import { UserMenu, type UserMenuUser } from "@/shell/user-menu";
import type { ScreenMeta } from "@/views/catalog";
import { DEFAULT_USER, SIDEBAR_GROUPS } from "@/views/config/sidebar-nav";

export type WorkspaceChromeProps = {
  meta: Pick<ScreenMeta, "breadcrumb" | "activeNav">;
  children: ReactNode;
  topbarActions?: ReactNode;
  showDefaultActions?: boolean;
  /** Реальный авторизованный пользователь (прод). Если не передан — Storybook-режим (мок-стек). */
  user?: UserMenuUser;
};

export function WorkspaceChrome({
  meta,
  children,
  topbarActions,
  showDefaultActions = true,
  user
}: WorkspaceChromeProps) {
  const actions =
    topbarActions ??
    (showDefaultActions ? (
      user ? (
        <UserMenu user={user} />
      ) : (
        <BemAvatarStack more="+2">
          <BemAvatar initials="ИИ" color="c1" />
          <BemAvatar initials="АП" color="c3" />
          <BemAvatar initials="КБ" color="c4" />
        </BemAvatarStack>
      )
    ) : null);

  const sidebarUser = user ? { ...user, email: user.email ?? "" } : DEFAULT_USER;

  return (
    <AppShell
      sidebar={<AppSidebar groups={SIDEBAR_GROUPS} user={sidebarUser} />}
      topbar={<AppTopbar breadcrumbs={<TopbarBreadcrumbs items={meta.breadcrumb} />} actions={actions} />}
    >
      {children}
    </AppShell>
  );
}
