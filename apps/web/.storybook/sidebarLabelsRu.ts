/** RU подписи узлов sidebar Storybook. Ключ — `item.name` из дерева (EN), id/url не меняются. */

export const SIDEBAR_ROOT_RU: Record<string, string> = {
  "API Contract": "API Contract",
  Composites: "Композиты",
  Flows: "Сценарии",
  FOUNDATIONS: "Основы",
  Foundations: "Основы",
  Patterns: "Паттерны",
  Primitives: "Примитивы",
  Screens: "Экраны",
  UI: "UI",
  Widgets: "Виджеты",
  VIEWS: "Представления",
  Views: "Представления",
  CATALOG: "Каталог",
  Catalog: "Каталог"
};

export const SIDEBAR_GROUP_RU: Record<string, string> = {
  Admin: "Администрирование",
  Alert: "Оповещение",
  Avatar: "Аватар",
  AvatarGroup: "Группа аватаров",
  Badge: "Бейдж",
  BannerInline: "Встроенный баннер",
  Breadcrumb: "Хлебные крошки",
  Button: "Кнопка",
  Card: "Карточка",
  Checkbox: "Флажок",
  Chip: "Чип",
  Colors: "Цвета",
  Command: "Команды",
  CommandDialog: "Командное окно",
  Composites: "Композиты",
  ContextMenu: "Контекстное меню",
  DatePicker: "Выбор даты",
  Density: "Плотность",
  Depth: "Глубина",
  Dialog: "Диалог",
  DropdownMenu: "Выпадающее меню",
  EmptyState: "Пустое состояние",
  ErrorState: "Ошибка",
  Flows: "Сценарии",
  ForbiddenState: "Нет доступа",
  Form: "Форма",
  Funnel: "Воронка",
  Gantt: "Гант",
  GanttBarDemo: "Бар Ганта",
  Iconography: "Иконки",
  Interactions: "Взаимодействия",
  Kbd: "Клавиша",
  KbdShortcut: "Сочетание клавиш",
  Kanban: "Канбан",
  Label: "Подпись поля",
  LoadingState: "Загрузка",
  MoneyValue: "Деньги",
  ParticipantList: "Участники",
  Patterns: "Паттерны",
  Primitives: "Примитивы",
  Regression: "Регрессии",
  ResourceMatrix: "Матрица ресурсов",
  Typography: "Типографика",
  Screens: "Экраны",
  Showcase: "Витрина",
  Spacing: "Отступы",
  "All Components": "Все компоненты"
};

/** Второй сегмент title `UI/*` */
export const UI_COMPONENT_RU: Record<string, string> = {
  Alert: "Оповещение",
  Avatar: "Аватар",
  Badge: "Бейдж",
  BannerInline: "Строка баннера",
  Breadcrumb: "Хлебные крошки",
  Button: "Кнопка",
  Card: "Карточка",
  Checkbox: "Флажок",
  Chip: "Чип",
  Combobox: "Комбобокс",
  Command: "Команда",
  CommandDialog: "Диалог команд",
  ContextMenu: "Контекстное меню",
  DatePicker: "Выбор даты",
  Dialog: "Диалог",
  DropdownMenu: "Выпадающее меню",
  EmptyState: "Пустое состояние",
  ErrorState: "Ошибка",
  ForbiddenState: "Нет доступа",
  Form: "Форма",
  IconButton: "Кнопка-иконка",
  IlluState: "Иллюстрация",
  IconPill: "Иконка с подписью",
  Input: "Поле ввода",
  Kbd: "Клавиша",
  KbdShortcut: "Сочетание клавиш",
  Label: "Подпись",
  LoadingState: "Загрузка",
  NumericValue: "Число",
  PageIntro: "Вступление",
  Pagination: "Пагинация",
  Popover: "Всплывающее окно",
  ProgressBar: "Прогресс",
  ProgressRing: "Кольцевой прогресс",
  RadioGroup: "Группа радиокнопок",
  ScrollArea: "Прокрутка",
  SearchPill: "Поиск",
  Segmented: "Сегменты",
  Select: "Выбор",
  Separator: "Разделитель",
  Sheet: "Боковая панель",
  Skeleton: "Скелетон",
  Sonner: "Уведомления",
  Sparkline: "Мини-график",
  StatusDot: "Точка статуса",
  Switch: "Переключатель",
  Table: "Таблица",
  Tabs: "Вкладки",
  Textarea: "Многострочное поле",
  Tooltip: "Подсказка",
  TrendArrow: "Стрелка тренда"
};

function isTopLevelSection(item: { name: string; type: string }): boolean {
  return item.type === "root" || item.type === "group";
}

export function renderSidebarLabelRu(item: { name: string; type: string }): string {
  if (item.type === "docs" && item.name === "Docs") {
    return "Документация";
  }
  if (item.type === "story" && item.name === "Variants") {
    return "Варианты";
  }
  // SB8: сегменты title (`Foundations`, `Views`) приходят как `group`, не только `root`.
  if (isTopLevelSection(item)) {
    const root = SIDEBAR_ROOT_RU[item.name];
    if (root) return root;
  }
  const group = SIDEBAR_GROUP_RU[item.name];
  if (group) return group;
  const component = UI_COMPONENT_RU[item.name];
  if (component) return component;
  return item.name;
}
