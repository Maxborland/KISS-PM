"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { GlobalSearch } from "@/delivery/ui/global-search";
import { ShellUserMenu } from "@/auth/avatar-menu/shell-user-menu";
import { useSessionUser } from "@/shell/use-session-user";

// href — реальный роут; requires — права, при отсутствии ВСЕХ из которых пункт скрыт
// (permission-aware навигация: пункты не должны вести в 403, G8-04). Мёртвые
// заглушки «Ресурсы»/«KPI» убраны: их роутов нет (G8-10) — вернём вместе с разделами.
type NavItem = { label: string; href: string; requires?: string[] };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
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

function WorkspaceNavigation({
  activeNav,
  nav,
  onNavigate
}: {
  activeNav: string;
  nav: NavGroup[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Основная навигация" className="flex flex-col gap-4 px-2 py-1.5">
      {nav.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <div className="px-2.5 pb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">
            {group.title}
          </div>
          {group.items.map((item) => {
            const active = item.label === activeNav;
            const cls = cn(
              "flex items-center justify-between rounded-[var(--radius-md)] px-2.5 py-1.5 text-[length:var(--text-sm)] hover:bg-[var(--panel-subtle)] [@media(pointer:coarse)]:min-h-[var(--touch-target)] [@media(pointer:coarse)]:py-2",
              active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "font-medium text-[var(--muted-strong)]"
            );
            return (
              <Link key={item.label} href={item.href} className={cls} {...(onNavigate ? { onClick: onNavigate } : {})}>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const mobileNavCloseRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileNavCloseRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        window.requestAnimationFrame(() => mobileNavToggleRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        mobileNavRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  const closeMobileNav = (restoreFocus: boolean) => {
    setMobileNavOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileNavToggleRef.current?.focus());
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--canvas)] text-[length:var(--text-md)]">
      {mobileNavOpen ? (
        <div className="sheet-backdrop md:hidden" aria-hidden onClick={() => closeMobileNav(true)} />
      ) : null}
      <aside
        ref={mobileNavRef}
        id="workspace-navigation"
        aria-label="Навигация рабочей области"
        className={cn(
          "fixed inset-y-0 left-0 z-[calc(var(--z-modal)+1)] w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-xl)] md:static md:z-auto md:flex md:shadow-none",
          mobileNavOpen ? "flex" : "hidden md:flex"
        )}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--text-strong)] text-[length:var(--text-sm)] font-bold text-white">К</span>
          <span className="font-[family-name:var(--font-display)] text-[length:var(--text-md)] font-bold text-[var(--text-strong)]">KISS PM</span>
          <button
            ref={mobileNavCloseRef}
            type="button"
            aria-label="Закрыть меню"
            onClick={() => closeMobileNav(true)}
            className="ml-auto grid size-[var(--touch-target)] place-items-center rounded-[var(--radius-md)] text-[var(--muted-strong)] hover:bg-[var(--panel-subtle)] md:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <WorkspaceNavigation activeNav={activeNav} nav={nav} onNavigate={() => closeMobileNav(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4">
          <button
            ref={mobileNavToggleRef}
            type="button"
            aria-label="Открыть навигацию"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="grid size-[var(--touch-target)] shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--muted-strong)] hover:bg-[var(--panel-subtle)] md:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <GlobalSearch />
          <ShellUserMenu />
        </header>
        {children}
      </div>
    </div>
  );
}
