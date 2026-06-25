import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { cn } from "@/lib/cn";

const NAV: { title: string; items: { label: string; badge?: string }[] }[] = [
  {
    title: "Работа",
    items: [
      { label: "Мои задачи", badge: "12" },
      { label: "Проекты", badge: "8" },
      { label: "Сделки", badge: "37" },
      { label: "Ресурсы", badge: "42" }
    ]
  },
  { title: "Аналитика", items: [{ label: "Загрузка" }, { label: "KPI" }] },
  // Аддитивная nav-группа «Коммуникации» (handoff-каркас): не меняет существующие active/badge.
  { title: "Коммуникации", items: [{ label: "Коммуникации" }] },
  // Аддитивная nav-группа «Администрирование» (handoff-каркас, ПОСЛЕ «Коммуникации»): один пункт, не трогает существующие active/badge.
  { title: "Администрирование", items: [{ label: "Администрирование" }] }
];

/**
 * WorkspaceShell — общий каркас рабочей области (design v4): левая навигация
 * + глобальная панель сверху. Контент (шапка проекта/отчёта + поверхность) —
 * children. Используется и DeliveryFrame (проект), и ReportingFrame (аналитика).
 *
 * Прототип: навигация/поиск/аватар не подключены (handoff-каркас).
 */
export function WorkspaceShell({ activeNav, children }: { activeNav: string; children: ReactNode }) {
  return (
    <div className="kiss-v4 flex min-h-screen w-full text-[length:var(--text-md)]">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] md:flex">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--text-strong)] text-[length:var(--text-sm)] font-bold text-white">К</span>
          <span className="font-[family-name:var(--font-display)] text-[length:var(--text-md)] font-bold text-[var(--text-strong)]">KISS PM</span>
        </div>
        <nav className="flex flex-col gap-4 px-2 py-1.5">
          {NAV.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <div className="px-2.5 pb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">{group.title}</div>
              {group.items.map((item) => {
                const active = item.label === activeNav;
                return (
                  <span
                    key={item.label}
                    title="Демо-прототип: навигация подключится в рабочем приложении"
                    className={cn(
                      "flex cursor-default items-center justify-between rounded-[var(--radius-md)] px-2.5 py-1.5 text-[length:var(--text-sm)]",
                      active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "font-medium text-[var(--muted-strong)]"
                    )}
                  >
                    {item.label}
                    {item.badge ? <span className="v4-num text-[length:var(--text-xs)] font-semibold text-[var(--muted-soft)]">{item.badge}</span> : null}
                  </span>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto px-4 py-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">v0.1 · прототип</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4">
          <label className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-[var(--muted)]">
            <Search className="size-4 shrink-0" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent text-[length:var(--text-sm)] text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)]"
              placeholder="Найти задачу или ресурс"
              disabled
              title="Демо-прототип: поиск подключится к рабочему приложению"
            />
          </label>
          <BemAvatar initials="КБ" color="c4" size="sm" />
        </header>
        {children}
      </div>
    </div>
  );
}
