import type { ReactNode } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { cn } from "@/lib/cn";
import type { SidebarGroup } from "@/shell/sidebar-types";

export type { SidebarGroup, SidebarItem } from "@/shell/sidebar-types";

export type AppSidebarProps = {
  workspace?: string;
  groups: SidebarGroup[];
  user?: { initials: string; name: string; email: string; positionName?: string; color?: "c1" | "c2" | "c3" | "c4" | "c5" };
};

export function AppSidebar({ workspace = "acme.studio", groups, user }: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <span className="brand-mark">К</span>
        <span className="app-sidebar__brand-text">
          <span className="app-sidebar__brand-title">KISS PM</span>
          <span className="app-sidebar__brand-meta">{workspace}</span>
        </span>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="app-sidebar__group">
          <div className="app-sidebar__group-title">{g.title}</div>
          {g.items.map((item) => (
            <a
              key={item.label}
              href="#"
              className={cn(
                "app-sidebar__item",
                item.nested && "app-sidebar__item--nested",
                item.active && "is-active"
              )}
              onClick={(e) => e.preventDefault()}
            >
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    "app-sidebar__item-badge",
                    item.alert && "app-sidebar__item-badge--alert"
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
        <div className="app-sidebar__footer">
          <div className="app-sidebar__user">
            <BemAvatar initials={user.initials} color={user.color ?? "c4"} size="md" />
            <div className="app-sidebar__user-meta">
              <span className="app-sidebar__user-name">{user.name}</span>
              <span className="app-sidebar__user-mail">
                {user.positionName ? `${user.positionName} · ` : ""}{user.email}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
