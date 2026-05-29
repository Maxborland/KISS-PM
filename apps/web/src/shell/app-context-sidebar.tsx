import type { ReactNode } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { cn } from "@/lib/cn";
import type { SidebarGroup } from "@/shell/sidebar-types";
import { TenantSwitcher } from "@/shell/tenant-switcher";

export type AppContextSidebarProps = {
  groups: SidebarGroup[];
  user?: {
    initials: string;
    name: string;
    email: string;
    positionName?: string;
    color?: "c1" | "c2" | "c3" | "c4" | "c5";
  };
  footer?: ReactNode;
};

export function AppContextSidebar({ groups, user, footer }: AppContextSidebarProps) {
  return (
    <aside className="app-context-sidebar">
      <div className="app-context-sidebar__head">
        <TenantSwitcher />
      </div>
      {groups.map((g) => (
        <div key={g.title} className="app-context-sidebar__group">
          <div className="app-context-sidebar__group-title">{g.title}</div>
          {g.items.map((item) => (
            <a
              key={item.label}
              href="#"
              className={cn(
                "app-context-sidebar__item",
                item.nested && "app-context-sidebar__item--nested",
                item.active && "is-active"
              )}
              onClick={(e) => e.preventDefault()}
            >
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    "app-context-sidebar__item-badge",
                    item.alert && "app-context-sidebar__item-badge--alert"
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      ))}
      {user ? (
        <div className="app-context-sidebar__footer">
          {footer}
          <div className="app-context-sidebar__user">
            <BemAvatar initials={user.initials} color={user.color ?? "c4"} size="md" />
            <div className="app-context-sidebar__user-meta">
              <span className="app-context-sidebar__user-name">{user.name}</span>
              <span className="app-context-sidebar__user-mail">
                {user.positionName ? `${user.positionName} · ` : ""}
                {user.email}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
