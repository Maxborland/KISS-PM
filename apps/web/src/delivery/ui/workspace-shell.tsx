"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { ShellUserMenu } from "@/auth/avatar-menu/shell-user-menu";
import { useSessionUser } from "@/shell/use-session-user";

// href задан → пункт кликабелен (реальный роут). Без href — пока не подключённый раздел.
const NAV: { title: string; items: { label: string; href?: string }[] }[] = [
  {
    title: "Работа",
    items: [
      { label: "Мои задачи", href: "/my-work" },
      { label: "Проекты", href: "/projects" },
      { label: "Сделки", href: "/crm/deals" },
      { label: "Ресурсы" }
    ]
  },
  { title: "Аналитика", items: [{ label: "Дашборд", href: "/dashboard" }, { label: "KPI" }] },
  { title: "Коммуникации", items: [{ label: "Коммуникации", href: "/communications/chat" }] },
  { title: "Администрирование", items: [{ label: "Администрирование", href: "/admin" }] }
];

/**
 * WorkspaceShell — общий каркас рабочей области (design v4): левая навигация
 * + глобальная панель сверху. Контент (шапка проекта/отчёта + поверхность) —
 * children. Используется и DeliveryFrame (проект), и ReportingFrame (аналитика).
 *
 * Прототип: навигация/поиск/аватар не подключены (handoff-каркас).
 */
const ADMIN_PERMISSIONS = [
  "tenant.access_profiles.read",
  "tenant.access_profiles.manage",
  "tenant.users.read",
  "tenant.users.manage",
  "tenant.audit.read"
];

export function WorkspaceShell({ activeNav, children }: { activeNav: string; children: ReactNode }) {
  // SHELL-03: группа «Администрирование» видна только ролям с admin-правами.
  const perms = useSessionUser()?.permissions ?? [];
  const nav = NAV.filter((g) => g.title !== "Администрирование" || ADMIN_PERMISSIONS.some((p) => perms.includes(p)));
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
                  "flex items-center justify-between rounded-[var(--radius-md)] px-2.5 py-1.5 text-[length:var(--text-sm)]",
                  active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "font-medium text-[var(--muted-strong)]",
                  item.href ? "hover:bg-[var(--panel-subtle)]" : "cursor-default text-[var(--muted-soft)]"
                );
                return item.href ? (
                  <Link key={item.label} href={item.href} className={cls}>{item.label}</Link>
                ) : (
                  <span key={item.label} className={cls} title="Раздел появится в приложении">{item.label}</span>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4">
          <label className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-[var(--muted)]">
            <Search className="size-4 shrink-0" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent text-[length:var(--text-sm)] text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)]"
              placeholder="Найти задачу или ресурс"
              disabled
              title="Поиск появится в следующей версии"
            />
          </label>
          <ShellUserMenu />
        </header>
        {children}
      </div>
    </div>
  );
}
