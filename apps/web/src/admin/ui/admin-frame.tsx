"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useSessionUser } from "@/shell/use-session-user";

const ADMIN_TAB_HREF: Record<string, string> = {
  "Пользователи": "/admin/users",
  "Роли": "/admin/roles",
  "Безопасность": "/admin/security",
  "Аудит": "/admin/audit"
};

/**
 * AdminFrame — продуктовый каркас области «Администрирование» (зеркало CrmFrame).
 * Сверху — заголовок области и табы [Пользователи, Роли, Безопасность]. Слева — общий
 * WorkspaceShell с активным пунктом «Администрирование».
 * Прототип: переключение табов не подключено (handoff-каркас) — как в CRM/Delivery.
 */
export const ADMIN_TABS = ["Пользователи", "Роли", "Безопасность", "Аудит"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

// Права, любое из которых открывает админку (зеркало гейта пункта навигации).
const ADMIN_PERMISSIONS = [
  "tenant.access_profiles.read",
  "tenant.access_profiles.manage",
  "tenant.users.read",
  "tenant.users.manage",
  "tenant.audit_events.read",
  // Вкладка «Безопасность» живёт на правах конфигурации воркспейса — роль
  // только с ними тоже должна попадать в админку (ревью PR #224).
  "tenant.workspace_config.read",
  "tenant.workspace_config.manage"
];

export function AdminFrame({
  activeTab,
  title,
  subtitle,
  actions,
  children
}: {
  activeTab: AdminTab;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  // Прямой заход не-админа по URL: цельный экран «нет доступа» вместо полного
  // админ-хрома с ошибкой в каждой вкладке (G8-05). Пока сессия не загрузилась
  // (null — в т.ч. Storybook), рендерим как обычно.
  const user = useSessionUser();
  if (user && !ADMIN_PERMISSIONS.some((p) => user.permissions.includes(p))) {
    return (
      <WorkspaceShell activeNav="Администрирование">
        <main className="grid min-h-[60vh] flex-1 place-items-center bg-[var(--canvas)] p-6">
          <ForbiddenState
            title="Администрирование недоступно"
            description="Этот раздел виден только ролям с правами управления рабочей областью. Если доступ нужен — обратитесь к администратору."
          />
        </main>
      </WorkspaceShell>
    );
  }
  return (
    <WorkspaceShell activeNav="Администрирование">
      {/* Заголовок области */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 pt-3 pb-3 md:px-6">
        <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[length:var(--text-xs)] font-bold uppercase tracking-[0.04em] text-[var(--muted-strong)]">Admin</span>
        <div className="mr-auto min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-[length:var(--text-22)] font-extrabold leading-tight tracking-[-0.025em] text-[var(--text-strong)]">{title ?? "Администрирование"}</h1>
          {subtitle ? <p className="truncate text-[length:var(--text-sm)] text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {/* Табы */}
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] px-2 md:px-4">
        {ADMIN_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <Link
              key={tab}
              href={ADMIN_TAB_HREF[tab] ?? "/admin"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)]",
                active ? "text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text-strong)]"
              )}
            >
              {tab}
              {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" /> : null}
            </Link>
          );
        })}
      </nav>

      {/* Контент */}
      <main className="min-w-0 flex-1 overflow-auto bg-[var(--canvas)] p-4 md:p-6">{children}</main>
    </WorkspaceShell>
  );
}
