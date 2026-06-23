import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";

export type ProjectMeta = {
  name: string;
  code: string;
  status: string;
  statusTone?: "info" | "success" | "warning";
  planVersion: string;
  deadline: string;
  finish: string;
  /** Отклонение от baseline, напр. «+2 дня к baseline B2». */
  variance?: { label: string; tone: "warning" | "danger" | "success" };
};

export const DELIVERY_TABS = [
  "Обзор",
  "График",
  "Ресурсы",
  "Назначения",
  "Календари",
  "Сценарии",
  "Baseline",
  "Коммиты",
  "Настройки"
] as const;

export type DeliveryTab = (typeof DELIVERY_TABS)[number];

function toneClass(tone: ProjectMeta["statusTone"] | "danger" | "success" | "warning") {
  switch (tone) {
    case "success":
      return "bg-[var(--success-soft)] text-[var(--success-text)]";
    case "warning":
      return "bg-[var(--warning-soft)] text-[var(--warning-text)]";
    case "danger":
      return "bg-[var(--danger-soft)] text-[var(--danger-text)]";
    default:
      return "bg-[var(--accent-soft)] text-[var(--accent)]";
  }
}

function Pill({ children, tone }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--text-sm)] font-medium",
        toneClass(tone ?? "info")
      )}
    >
      {children}
    </span>
  );
}

/**
 * DeliveryFrame — продуктовый каркас Project Delivery (design v4).
 * Слева — навигация рабочей области, сверху — глобальная панель, ниже —
 * шапка проекта и табы поверхностей. Контент поверхности — children.
 *
 * Прототип: навигация/поиск/аватар не подключены (handoff-каркас).
 */
export function DeliveryFrame({
  project,
  activeTab,
  children
}: {
  project: ProjectMeta;
  activeTab: DeliveryTab;
  children: ReactNode;
}) {
  return (
    <WorkspaceShell activeNav="Проекты">
        {/* Project header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 pt-3 pb-3 md:px-6">
          <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[length:var(--text-sm)] font-bold text-[var(--muted-strong)]">
            {project.code.slice(0, 2)}
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-extrabold leading-tight tracking-[-0.025em] text-[var(--text-strong)]">
            {project.name}
          </h1>
          <Pill tone={project.statusTone ?? "info"}>{project.status}</Pill>
          <span className="text-[length:var(--text-sm)] text-[var(--muted)]">план {project.planVersion}</span>
          <span className="text-[length:var(--text-sm)] text-[var(--muted)]">
            Дедлайн <span className="v4-num text-[var(--muted-strong)]">{project.deadline}</span>
          </span>
          <span className="text-[length:var(--text-sm)] text-[var(--muted)]">
            Финиш <span className="v4-num text-[var(--muted-strong)]">{project.finish}</span>
          </span>
          {project.variance ? <Pill tone={project.variance.tone}>{project.variance.label}</Pill> : null}
        </div>

        {/* Tabs */}
        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--panel)] px-2 md:px-4">
          {DELIVERY_TABS.map((tab) => {
            const active = tab === activeTab;
            return (
              <span
                key={tab}
                aria-current={active ? "page" : undefined}
                title={active ? undefined : "Демо-прототип: переключение поверхностей появится в приложении"}
                className={cn(
                  "relative cursor-default whitespace-nowrap px-3 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)]",
                  active ? "text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text-strong)]"
                )}
              >
                {tab}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />
                ) : null}
              </span>
            );
          })}
          <span className="ml-auto hidden items-center gap-1.5 pr-2 text-[length:var(--text-sm)] text-[var(--success-text)] md:flex">
            <span className="v4-pulse size-1.5 rounded-full bg-[var(--success)]" />
            Сохранено
          </span>
        </nav>

        {/* Surface content */}
        <main className="min-w-0 flex-1 overflow-auto bg-[var(--canvas)] p-4 md:p-6">{children}</main>
    </WorkspaceShell>
  );
}
