import type { SidebarGroup } from "@/shell/app-sidebar";

export const DEFAULT_USER = {
  initials: "КБ",
  name: "Камил Бачанек",
  email: "kamil@acme.studio",
  color: "c4" as const
};

const BASE_GROUPS: SidebarGroup[] = [
  {
    title: "Обзор",
    items: [
      { label: "Дашборд" },
      { label: "Календарь" },
      { label: "Задачи" },
      { label: "Бэклог", nested: true, badge: "24" },
      { label: "В работе", nested: true, badge: "4" },
      { label: "Проверка", nested: true, badge: "7" },
      { label: "Готово", nested: true, badge: "13" }
    ]
  },
  {
    title: "Инструменты",
    items: [
      { label: "Уведомления", badge: "7", alert: true },
      { label: "Входящие" },
      { label: "Интеграции" },
      { label: "Отчёты" }
    ]
  },
  {
    title: "Метрики",
    items: [
      { label: "Активные", badge: "1" },
      { label: "Прошлые" }
    ]
  }
];

/** Sidebar с подсветкой пункта как в HTML mockup design-v2 */
export function sidebarGroupsForActive(activeLabel?: string): SidebarGroup[] {
  if (!activeLabel) {
    return BASE_GROUPS;
  }
  return BASE_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      active: item.label === activeLabel
    }))
  }));
}
