"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { cn } from "@/lib/cn";

export type SidebarItem = {
  label: string;
  href?: string;
  soon?: boolean;
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

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ workspace = "acme.studio", groups, user }: AppSidebarProps) {
  const pathname = usePathname() ?? "";
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
          {g.items.map((item) => {
            const active = item.href ? isActive(pathname, item.href) : false;
            const badge = item.soon ? (
              <span className="app-sidebar__item-badge opacity-70">скоро</span>
            ) : item.badge ? (
              <span className={cn("app-sidebar__item-badge", item.alert && "app-sidebar__item-badge--alert")}>{item.badge}</span>
            ) : null;

            if (item.soon || !item.href) {
              return (
                <span
                  key={item.label}
                  aria-disabled="true"
                  title="Скоро"
                  className={cn("app-sidebar__item cursor-default opacity-55", item.nested && "app-sidebar__item--nested")}
                >
                  {item.label}
                  {badge}
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("app-sidebar__item", item.nested && "app-sidebar__item--nested", active && "is-active")}
              >
                {item.label}
                {badge}
              </Link>
            );
          })}
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
