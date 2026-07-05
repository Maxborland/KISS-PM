import type { ReactNode } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { DEMO_NAV_TITLE, PROTOTYPE_LABEL } from "@/views/lib/demo";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

export type SidebarItem = {
  label: string;
  active?: boolean;
  nested?: boolean;
  badge?: string;
  alert?: boolean;
};

export type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

export type AppSidebarProps = {
  workspace?: string;
  groups: SidebarGroup[];
  user?: { initials: string; name: string; email: string; color?: "c1" | "c2" | "c3" | "c4" | "c5" };
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
      {prototypeNotesEnabled ? (
        <Chip variant="warning" className="app-sidebar__proto">
          {PROTOTYPE_LABEL}
        </Chip>
      ) : null}
      {groups.map((g) => (
        <div key={g.title} className="app-sidebar__group">
          <div className="app-sidebar__group-title">{g.title}</div>
          {g.items.map((item) => (
            // Прототип: навигация не подключена. Рендерим как неинтерактивный
            // пункт (не fake-ссылка href="#"), активный пункт подсвечен снаружи.
            <span
              key={item.label}
              className={cn(
                "app-sidebar__item app-sidebar__item--demo",
                item.nested && "app-sidebar__item--nested",
                item.active && "is-active"
              )}
              aria-current={item.active ? "page" : undefined}
              title={prototypeNotesEnabled ? DEMO_NAV_TITLE : undefined}
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
            </span>
          ))}
        </div>
      ))}
      {user ? (
        <div className="app-sidebar__footer">
          <div className="app-sidebar__user">
            <BemAvatar initials={user.initials} color={user.color ?? "c4"} size="md" />
            <div className="app-sidebar__user-meta">
              <span className="app-sidebar__user-name">{user.name}</span>
              <span className="app-sidebar__user-mail">{user.email}</span>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
