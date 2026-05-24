/** RU подписи узлов sidebar Storybook. Ключ — `item.name` из дерева (EN), id/url не меняются. */

export const SIDEBAR_ROOT_RU: Record<string, string> = {
  FOUNDATIONS: "Основы",
  Foundations: "Основы",
  UI: "UI",
  VIEWS: "Представления",
  Views: "Представления",
  CATALOG: "Каталог",
  Catalog: "Каталог"
};

export const SIDEBAR_GROUP_RU: Record<string, string> = {
  Colors: "Цвета",
  Typography: "Типографика",
  Screens: "Экраны",
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
  Input: "Поле ввода",
  Kbd: "Клавиша",
  Label: "Подпись",
  LoadingState: "Загрузка",
  PageIntro: "Вступление",
  Pagination: "Пагинация",
  Popover: "Всплывающее окно",
  RadioGroup: "Группа радиокнопок",
  ScrollArea: "Прокрутка",
  SearchPill: "Поиск",
  Segmented: "Сегменты",
  Select: "Выбор",
  Separator: "Разделитель",
  Sheet: "Боковая панель",
  Skeleton: "Скелетон",
  Sonner: "Уведомления",
  Switch: "Переключатель",
  Table: "Таблица",
  Tabs: "Вкладки",
  Textarea: "Многострочное поле",
  Tooltip: "Подсказка"
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
