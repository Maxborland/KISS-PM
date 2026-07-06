"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { GlobalSearch } from "@/delivery/ui/global-search";
import { ShellUserMenu } from "@/auth/avatar-menu/shell-user-menu";
import { useSessionUser } from "@/shell/use-session-user";

// href — реальный роут; requires — права, при отсутствии ВСЕХ из которых пункт скрыт
// (permission-aware навигация: пункты не должны вести в 403, G8-04). Мёртвые
// заглушки «Ресурсы»/«KPI» убраны: их роутов нет (G8-10) — вернём вместе с разделами.
type NavItem = { label: string; href: string; requires?: string[] };
const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Работа",
    items: [
      { label: "Мои задачи", href: "/my-work", requires: ["tenant.projects.read"] },
      { label: "Проекты", href: "/projects", requires: ["tenant.projects.read"] },
      { label: "Сделки", href: "/crm/deals", requires: ["tenant.opportunities.read"] }
    ]
  },
  { title: "Аналитика", items: [{ label: "Дашборд", href: "/dashboard", requires: ["tenant.projects.read", "tenant.opportunities.read"] }] },
  { title: "Коммуникации", items: [{ label: "Коммуникации", href: "/communications/chat", requires: ["tenant.communications.read"] }] },
  { title: "Администрирование", items: [{ label: "Администрирование", href: "/admin", requires: ["tenant.access_profiles.read", "tenant.access_profiles.manage", "tenant.users.read", "tenant.users.manage", "tenant.audit_events.read", "tenant.workspace_config.read", "tenant.workspace_config.manage"] }] }
];

/**
 * WorkspaceShell — общий каркас рабочей области (design v4): левая навигация
 * + глобальная панель сверху. Контент (шапка проекта/отчёта + поверхность) —
 * children. Используется и DeliveryFrame (проект), и ReportingFrame (аналитика).
 *
 * Навигация, глобальный поиск (GET /api/workspace/search) и меню пользователя — живые.
 */
export function WorkspaceShell({ activeNav, children }: { activeNav: string; children: ReactNode }) {
  // Пункт виден, если у роли есть хотя бы одно из requires (пока права не
  // загрузились, показываем всё — иначе меню «мигает» на каждом переходе).
  const user = useSessionUser();
  const perms = user?.permissions ?? null;
  const nav = NAV
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.requires || perms === null || i.requires.some((p) => perms.includes(p)))
    }))
    .filter((g) => g.items.length > 0);
  return (
    <div className="flex min-h-screen w-full bg-[var(--canvas)] text-[length:var(--text-md)]">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] md:flex">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--text-strong)] text-[length:var(--text-sm)] font-bold text-white">К</span>
          <span className="font-[family-name:var(--font-display)] text-[length:var(--text-md)] font-bold text-[var(--text-strong)]">KISS PM</span>
        </div>
        <nav className="flex flex-col gap-4 px-2 py-1.5">
          {nav.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <div className="px-2.5 pb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">{group.title}</div>
              {group.items.map((item) => {
                const active = item.label === activeNav;
                const cls = cn(
                  "flex items-center justify-between rounded-[var(--radius-md)] px-2.5 py-1.5 text-[length:var(--text-sm)] hover:bg-[var(--panel-subtle)]",
                  active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "font-medium text-[var(--muted-strong)]"
                );
                return <Link key={item.label} href={item.href} className={cls}>{item.label}</Link>;
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4">
          <GlobalSearch />
          <ShellUserMenu />
        </header>
        {children}
      </div>
    </div>
  );
}
