"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { cn } from "@/lib/cn";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useUnreadSummary } from "@/communications/lib/use-comms";
import { useWorkspaceRealtime } from "@/communications/lib/use-realtime";

/**
 * CommsFrame — продуктовый каркас области «Коммуникации» (зеркало CrmFrame).
 * Сверху — заголовок области и табы (Чат/Каналы/Звонки/Встречи/Уведомления),
 * подключённые к реальным роутам /communications/<slug>.
 */
const COMMS_TAB_SLUGS = {
  "Чат": "chat",
  "Каналы": "channels",
  "Звонки": "calls",
  "Встречи": "meetings",
  "Уведомления": "notifications"
} as const;
export const COMMS_TABS = Object.keys(COMMS_TAB_SLUGS) as (keyof typeof COMMS_TAB_SLUGS)[];
export type CommsTab = (typeof COMMS_TABS)[number];

export function CommsFrame({
  activeTab,
  title,
  subtitle,
  actions,
  children
}: {
  activeTab: CommsTab;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  // Бейджи непрочитанного: notifications → таб «Уведомления», conversations → таб «Чат».
  const unread = useUnreadSummary();
  const summary = unread.data;
  // P4.1 realtime: в live-режиме новое уведомление прилетает push'ем (SSE, канал
  // пользователя) → перечитываем сводку непрочитанного. В mock (Storybook) — no-op.
  useWorkspaceRealtime({ onNotification: () => { void unread.reload(); } });
  return (
    <WorkspaceShell activeNav="Коммуникации">
      {/* Заголовок области */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 pt-3 pb-3 md:px-6">
        <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[var(--muted-strong)]">
          <MessagesSquare className="size-4" aria-hidden />
        </span>
        <div className="mr-auto min-w-0">
          <h1 className="truncate font-[family-name:var(--font-display)] text-[length:var(--text-22)] font-extrabold leading-tight tracking-[-0.025em] text-[var(--text-strong)]">{title ?? "Коммуникации"}</h1>
          {subtitle ? <p className="truncate text-[length:var(--text-sm)] text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {/* Табы */}
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] px-2 md:px-4">
        {COMMS_TABS.map((tab) => {
          const active = tab === activeTab;
          const count = tab === "Уведомления" ? summary?.notifications ?? 0 : tab === "Чат" ? summary?.conversations ?? 0 : 0;
          return (
            <Link
              key={tab}
              href={`/communications/${COMMS_TAB_SLUGS[tab]}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)]",
                active ? "text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text-strong)]"
              )}
            >
              {tab}
              {count ? <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[length:var(--text-2xs)] font-semibold leading-[1.1rem] text-white">{count > 99 ? "99+" : count}</span> : null}
              {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" /> : null}
            </Link>
          );
        })}
        {prototypeNotesEnabled ? (
          <span className="ml-auto hidden items-center gap-1.5 pr-2 text-[length:var(--text-sm)] text-[var(--success-text)] md:flex">
            <span className="v4-pulse size-1.5 rounded-full bg-[var(--success)]" />
            Сохранено
          </span>
        ) : null}
      </nav>

      {/* Контент */}
      <main className="min-w-0 flex-1 overflow-auto bg-[var(--canvas)] p-4 md:p-6">{children}</main>
    </WorkspaceShell>
  );
}
