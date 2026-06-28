import type { SidebarGroup } from "@/shell/app-sidebar";

export const DEFAULT_USER = {
  initials: "КБ",
  name: "Камил Бачанек",
  email: "kamil@acme.studio",
  color: "c4" as const
};

/**
 * Прод-навигация (гибрид): реальные построенные роуты активны; ближайшие comms-витрины
 * (Фаза 5) показаны как «скоро» (disabled); орфаны без экранов убраны.
 * Активный пункт определяется по pathname в AppSidebar, не по label.
 */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: "Обзор",
    items: [
      { label: "Дашборд", href: "/dashboard" },
      { label: "Моя работа", href: "/my-work" },
      { label: "Проекты", href: "/projects" },
      { label: "Сделки", href: "/deals" }
    ]
  },
  {
    title: "Общение",
    items: [
      { label: "Чаты", soon: true },
      { label: "Звонки", soon: true },
      { label: "Встречи", soon: true },
      { label: "Уведомления", soon: true }
    ]
  },
  {
    title: "Управление",
    items: [
      { label: "Агент", href: "/agent" },
      { label: "Пользователи", href: "/admin" },
      { label: "Настройки", href: "/settings" }
    ]
  }
];

/** Плоский список навигируемых пунктов (для командной палитры). */
export const NAV_LINKS = SIDEBAR_GROUPS.flatMap((group) =>
  group.items.filter((item): item is typeof item & { href: string } => Boolean(item.href) && !item.soon)
);
